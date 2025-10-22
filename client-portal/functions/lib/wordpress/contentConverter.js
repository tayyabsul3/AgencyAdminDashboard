/**
 * Article to WordPress Post Conversion Service
 * Handles conversion of JSON article data to WordPress post format
 */

const { POST_STATUS } = require('./constants');

/**
 * Convert JSON article data to WordPress post format
 * @param {Object} articleData - The article JSON data
 * @param {Object} options - Conversion options
 * @param {string} [options.status='draft'] - Post status (draft, publish, private)
 * @param {number[]} [options.categories] - WordPress category IDs
 * @param {string[]} [options.tags] - Tag names
 * @param {boolean} [options.preserveFormatting=true] - Whether to preserve HTML formatting
 * @param {number} [options.featuredImageId] - WordPress media ID for featured image
 * @returns {Object} WordPress post data
 */
function convertJsonToWordPressPost(articleData, options = {}) {
  // Validate input
  if (!articleData || typeof articleData !== 'object') {
    throw new Error('Article data is required and must be an object');
  }

  if (!articleData.title) {
    throw new Error('Article must have a title');
  }

  // Set default options
  const {
    status = POST_STATUS.DRAFT,
    categories = [],
    tags = [],
    preserveFormatting = true,
    featuredImageId = null
  } = options;

  // Validate status
  if (!Object.values(POST_STATUS).includes(status)) {
    throw new Error(`Invalid post status: ${status}`);
  }

  // Extract title
  const title = articleData.title.trim();

  // Generate excerpt from subtitle or first section
  const excerpt = generateExcerpt(articleData);

  // Convert content to HTML
  const content = convertContentToHtml(articleData, preserveFormatting);

  // Build WordPress post data
  const wordpressPost = {
    title: title,
    content: content,
    excerpt: excerpt,
    status: status,
    format: 'standard'
  };

  // Add categories if provided
  if (Array.isArray(categories) && categories.length > 0) {
    wordpressPost.categories = categories.filter(cat => 
      typeof cat === 'number' && cat > 0
    );
  }

  // Add tags if provided
  if (Array.isArray(tags) && tags.length > 0) {
    wordpressPost.tags = tags.filter(tag => 
      typeof tag === 'string' && tag.trim().length > 0
    ).map(tag => tag.trim());
  }

  // Add featured image if provided
  if (featuredImageId && typeof featuredImageId === 'number') {
    wordpressPost.featured_media = featuredImageId;
  }

  // Add meta fields for additional article data
  wordpressPost.meta = generateMetaFields(articleData);

  return wordpressPost;
}

/**
 * Generate excerpt from article data
 * @param {Object} articleData - Article data
 * @returns {string} Generated excerpt
 */
function generateExcerpt(articleData) {
  // Try subtitle first
  if (articleData.subtitle && typeof articleData.subtitle === 'string') {
    return stripHtml(articleData.subtitle).substring(0, 155);
  }

  // Try metadata description
  if (articleData.metadata?.description) {
    return stripHtml(articleData.metadata.description).substring(0, 155);
  }

  // Try intro_md
  if (articleData.intro_md && typeof articleData.intro_md === 'string') {
    return stripHtml(articleData.intro_md).substring(0, 155);
  }

  // Try first section content
  if (articleData.sections && Array.isArray(articleData.sections) && articleData.sections.length > 0) {
    const firstSection = articleData.sections[0];
    if (firstSection.content) {
      return stripHtml(firstSection.content).substring(0, 155);
    }
  }

  // Fallback to title-based excerpt
  return `Learn about ${articleData.title.toLowerCase()} in this comprehensive guide.`;
}

/**
 * Convert article content to HTML format
 * @param {Object} articleData - Article data
 * @param {boolean} preserveFormatting - Whether to preserve formatting
 * @returns {string} HTML content
 */
function convertContentToHtml(articleData, preserveFormatting = true) {
  let html = '';

  // Add introduction if available
  if (articleData.intro_md) {
    html += convertMarkdownToHtml(articleData.intro_md);
    html += '\n\n';
  }

  // Add key takeaways if available
  if (articleData.keyTakeaways && Array.isArray(articleData.keyTakeaways) && articleData.keyTakeaways.length > 0) {
    html += '<h2>Key Takeaways</h2>\n';
    html += '<ul>\n';
    articleData.keyTakeaways.forEach(takeaway => {
      html += `<li>${escapeHtml(takeaway)}</li>\n`;
    });
    html += '</ul>\n\n';
  }

  // Add main sections
  if (articleData.sections && Array.isArray(articleData.sections)) {
    articleData.sections.forEach(section => {
      html += convertSectionToHtml(section, preserveFormatting);
    });
  }

  // Add tables if available
  if (articleData.tables && Array.isArray(articleData.tables)) {
    articleData.tables.forEach(table => {
      html += convertTableToHtml(table);
    });
  }

  // Add checklists if available
  if (articleData.checklists) {
    html += convertChecklistsToHtml(articleData.checklists);
  }

  // Add FAQs if available
  if (articleData.faqs && Array.isArray(articleData.faqs)) {
    html += convertFaqsToHtml(articleData.faqs);
  }

  // Add author bio if available
  if (articleData.authorBio || articleData.author) {
    html += convertAuthorBioToHtml(articleData.authorBio || articleData.author);
  }

  // Add call to action if available
  if (articleData.cta) {
    html += convertCtaToHtml(articleData.cta);
  }

  return html.trim();
}

/**
 * Convert a section to HTML
 * @param {Object} section - Section data
 * @param {boolean} preserveFormatting - Whether to preserve formatting
 * @returns {string} HTML content
 */
function convertSectionToHtml(section, preserveFormatting = true) {
  let html = '';

  // Add section title
  if (section.title || section.heading) {
    const title = section.title || section.heading;
    html += `<h2>${escapeHtml(title)}</h2>\n`;
  }

  // Add section content
  if (section.content) {
    if (preserveFormatting && typeof section.content === 'string') {
      // Convert markdown to HTML if it looks like markdown
      if (section.content.includes('**') || section.content.includes('*') || section.content.includes('#')) {
        html += convertMarkdownToHtml(section.content);
      } else {
        html += `<p>${escapeHtml(section.content).replace(/\n\n/g, '</p>\n<p>')}</p>\n`;
      }
    } else {
      html += `<p>${escapeHtml(String(section.content))}</p>\n`;
    }
  }

  // Add subsections if available
  if (section.subsections && Array.isArray(section.subsections)) {
    section.subsections.forEach(subsection => {
      if (subsection.title) {
        html += `<h3>${escapeHtml(subsection.title)}</h3>\n`;
      }
      if (subsection.content) {
        html += `<p>${escapeHtml(subsection.content)}</p>\n`;
      }
    });
  }

  html += '\n';
  return html;
}

/**
 * Convert table data to HTML
 * @param {Object} table - Table data
 * @returns {string} HTML table
 */
function convertTableToHtml(table) {
  if (!table.headers || !table.rows) {
    return '';
  }

  let html = '';
  
  if (table.title) {
    html += `<h3>${escapeHtml(table.title)}</h3>\n`;
  }

  html += '<table>\n';
  
  // Add headers
  html += '<thead>\n<tr>\n';
  table.headers.forEach(header => {
    html += `<th>${escapeHtml(header)}</th>\n`;
  });
  html += '</tr>\n</thead>\n';

  // Add rows
  html += '<tbody>\n';
  table.rows.forEach(row => {
    html += '<tr>\n';
    row.forEach(cell => {
      html += `<td>${escapeHtml(String(cell))}</td>\n`;
    });
    html += '</tr>\n';
  });
  html += '</tbody>\n</table>\n\n';

  return html;
}

/**
 * Convert checklists to HTML
 * @param {Object} checklists - Checklist data
 * @returns {string} HTML content
 */
function convertChecklistsToHtml(checklists) {
  let html = '';

  Object.keys(checklists).forEach(checklistKey => {
    const checklist = checklists[checklistKey];
    
    if (checklist.title) {
      html += `<h3>${escapeHtml(checklist.title)}</h3>\n`;
    }

    if (checklist.items && Array.isArray(checklist.items)) {
      html += '<ul class="checklist">\n';
      checklist.items.forEach(item => {
        html += `<li>${escapeHtml(item)}</li>\n`;
      });
      html += '</ul>\n\n';
    }
  });

  return html;
}

/**
 * Convert FAQs to HTML
 * @param {Array} faqs - FAQ data
 * @returns {string} HTML content
 */
function convertFaqsToHtml(faqs) {
  let html = '<h2>Frequently Asked Questions</h2>\n';

  faqs.forEach(faq => {
    if (faq.question && faq.answer) {
      html += `<h3>${escapeHtml(faq.question)}</h3>\n`;
      html += `<p>${escapeHtml(faq.answer)}</p>\n\n`;
    }
  });

  return html;
}

/**
 * Convert author bio to HTML
 * @param {Object|string} author - Author data
 * @returns {string} HTML content
 */
function convertAuthorBioToHtml(author) {
  if (typeof author === 'string') {
    return `<div class="author-bio">\n<p>${escapeHtml(author)}</p>\n</div>\n\n`;
  }

  if (typeof author === 'object' && author !== null) {
    let html = '<div class="author-bio">\n';
    
    if (author.name) {
      html += `<h3>About ${escapeHtml(author.name)}</h3>\n`;
    }
    
    if (author.bio || author.description) {
      html += `<p>${escapeHtml(author.bio || author.description)}</p>\n`;
    }
    
    html += '</div>\n\n';
    return html;
  }

  return '';
}

/**
 * Convert call to action to HTML
 * @param {Object} cta - CTA data
 * @returns {string} HTML content
 */
function convertCtaToHtml(cta) {
  if (!cta || typeof cta !== 'object') {
    return '';
  }

  let html = '<div class="call-to-action">\n';
  
  if (cta.title) {
    html += `<h3>${escapeHtml(cta.title)}</h3>\n`;
  }
  
  if (cta.description) {
    html += `<p>${escapeHtml(cta.description)}</p>\n`;
  }
  
  if (cta.buttonText && cta.buttonUrl) {
    html += `<p><a href="${escapeHtml(cta.buttonUrl)}" class="cta-button">${escapeHtml(cta.buttonText)}</a></p>\n`;
  }
  
  html += '</div>\n\n';
  return html;
}

/**
 * Generate meta fields for WordPress
 * @param {Object} articleData - Article data
 * @returns {Object} Meta fields
 */
function generateMetaFields(articleData) {
  const meta = {};

  // Add metadata if available
  if (articleData.metadata) {
    if (articleData.metadata.keywords && Array.isArray(articleData.metadata.keywords)) {
      meta.keywords = articleData.metadata.keywords.join(', ');
    }
    
    if (articleData.metadata.readingTime) {
      meta.reading_time = articleData.metadata.readingTime;
    }
    
    if (articleData.metadata.wordCount) {
      meta.word_count = articleData.metadata.wordCount;
    }
  }

  // Add original article data as JSON for reference
  meta.original_article_data = JSON.stringify(articleData);

  return meta;
}

/**
 * Basic markdown to HTML conversion
 * @param {string} markdown - Markdown text
 * @returns {string} HTML text
 */
function convertMarkdownToHtml(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }

  let html = markdown;

  // Convert headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Convert bold and italic
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Convert links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Convert line breaks to paragraphs
  html = html.replace(/\n\n/g, '</p>\n<p>');
  html = `<p>${html}</p>`;

  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, '');

  return html;
}

/**
 * Escape HTML characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  if (typeof text !== 'string') {
    return '';
  }

  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };

  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Strip HTML tags from text
 * @param {string} html - HTML text
 * @returns {string} Plain text
 */
function stripHtml(html) {
  if (typeof html !== 'string') {
    return '';
  }

  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Extract image references from article data
 * @param {Object} articleData - Article data
 * @returns {Array} Array of image objects with src, alt, and context
 */
function extractImagesFromArticle(articleData) {
  const images = [];
  
  // Helper function to extract images from text content
  function extractImagesFromText(text, context = '') {
    if (!text || typeof text !== 'string') return;
    
    // Match markdown image syntax: ![alt](src)
    const markdownImages = text.match(/!\[([^\]]*)\]\(([^)]+)\)/g);
    if (markdownImages) {
      markdownImages.forEach(match => {
        const [, alt, src] = match.match(/!\[([^\]]*)\]\(([^)]+)\)/);
        images.push({
          src: src.trim(),
          alt: alt.trim(),
          context: context,
          format: 'markdown'
        });
      });
    }
    
    // Match HTML img tags: <img src="..." alt="...">
    const htmlImages = text.match(/<img[^>]+>/g);
    if (htmlImages) {
      htmlImages.forEach(match => {
        const srcMatch = match.match(/src=["']([^"']+)["']/);
        const altMatch = match.match(/alt=["']([^"']+)["']/);
        
        if (srcMatch) {
          images.push({
            src: srcMatch[1].trim(),
            alt: altMatch ? altMatch[1].trim() : '',
            context: context,
            format: 'html'
          });
        }
      });
    }
  }
  
  // Extract from intro
  if (articleData.intro_md) {
    extractImagesFromText(articleData.intro_md, 'intro');
  }
  
  // Extract from sections
  if (articleData.sections && Array.isArray(articleData.sections)) {
    articleData.sections.forEach((section, index) => {
      const sectionContext = section.title || section.heading || `section-${index + 1}`;
      
      if (section.content) {
        extractImagesFromText(section.content, sectionContext);
      }
      
      // Extract from subsections
      if (section.subsections && Array.isArray(section.subsections)) {
        section.subsections.forEach((subsection, subIndex) => {
          const subsectionContext = `${sectionContext}-subsection-${subIndex + 1}`;
          if (subsection.content) {
            extractImagesFromText(subsection.content, subsectionContext);
          }
        });
      }
    });
  }
  
  // Extract from author bio
  if (articleData.authorBio && typeof articleData.authorBio === 'object' && articleData.authorBio.bio) {
    extractImagesFromText(articleData.authorBio.bio, 'author-bio');
  }
  
  // Remove duplicates based on src
  const uniqueImages = images.filter((image, index, self) => 
    index === self.findIndex(img => img.src === image.src)
  );
  
  return uniqueImages;
}

/**
 * Suggest featured image from article content
 * @param {Object} articleData - Article data
 * @returns {Object|null} Suggested featured image or null
 */
function suggestFeaturedImage(articleData) {
  const images = extractImagesFromArticle(articleData);
  
  if (images.length === 0) {
    return null;
  }
  
  // Prioritize images from intro or first section
  const priorityContexts = ['intro', 'section-1'];
  
  for (const context of priorityContexts) {
    const contextImage = images.find(img => img.context === context);
    if (contextImage) {
      return contextImage;
    }
  }
  
  // Return first image if no priority match
  return images[0];
}

/**
 * Validate article data structure
 * @param {Object} articleData - Article data to validate
 * @returns {Object} Validation result
 */
function validateArticleData(articleData) {
  const errors = [];
  const warnings = [];

  // Required fields
  if (!articleData) {
    errors.push('Article data is required');
    return { valid: false, errors, warnings };
  }

  if (!articleData.title || typeof articleData.title !== 'string' || articleData.title.trim().length === 0) {
    errors.push('Article must have a non-empty title');
  }

  // Check for content
  const hasContent = (
    (articleData.sections && Array.isArray(articleData.sections) && articleData.sections.length > 0) ||
    (articleData.intro_md && articleData.intro_md.trim().length > 0) ||
    (articleData.keyTakeaways && Array.isArray(articleData.keyTakeaways) && articleData.keyTakeaways.length > 0)
  );

  if (!hasContent) {
    warnings.push('Article has no content sections, intro, or key takeaways');
  }

  // Validate sections structure
  if (articleData.sections && Array.isArray(articleData.sections)) {
    articleData.sections.forEach((section, index) => {
      if (!section.title && !section.heading && !section.content) {
        warnings.push(`Section ${index + 1} has no title or content`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

module.exports = {
  convertJsonToWordPressPost,
  validateArticleData,
  generateExcerpt,
  convertContentToHtml,
  convertMarkdownToHtml,
  escapeHtml,
  stripHtml,
  extractImagesFromArticle,
  suggestFeaturedImage
};