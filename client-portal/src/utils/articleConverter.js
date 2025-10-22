/**
 * Converts a JSON article object into a styled Gutenberg-compatible HTML block
 * with customizable section ordering.
 * 
 * @param {object} json - The article JSON data.
 * @param {array|object} sectionOrderOrVideos - Can be either:
 *                                              - Array of section objects with id and label (for custom ordering)
 *                                              - Object with video data (for backward compatibility)
 *                                              - null/undefined (uses default order)
 * @param {object} existingVideos - Optional video data object keyed by faq-{index}
 * @returns {string} A string containing the complete HTML and embedded CSS.
 */
export function convertJsonToGutenbergHtml(json, sectionOrderOrVideos = null, existingVideos = null) {
  // Handle backward compatibility: if second param is an object (not array), treat it as videos
  let sectionOrder = null;
  let videos = existingVideos;
  
  if (sectionOrderOrVideos) {
    if (Array.isArray(sectionOrderOrVideos)) {
      sectionOrder = sectionOrderOrVideos;
    } else if (typeof sectionOrderOrVideos === 'object') {
      videos = sectionOrderOrVideos;
    }
  }
  // Helper function to bold the first sentence of a paragraph.
  const boldFirstSentence = (text) => {
    if (!text) return '';
    const firstPeriodIndex = text.indexOf('.');
    if (firstPeriodIndex !== -1) {
      return `<strong>${text.substring(0, firstPeriodIndex + 1)}</strong>${text.substring(firstPeriodIndex + 1)}`;
    }
    return `<strong>${text}</strong>`; // Bold the whole thing if no period.
  };

  // --- 1. Define The CSS Styles ---
  const css = `
<style>
  .article-container {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
    color: #333;
    line-height: 1.7;
  }
  .article-container h1, .article-container h2, .article-container h3, .article-container h4 {
    line-height: 1.3;
    margin-top: 1.5em;
    margin-bottom: 0.5em;
  }
  .article-container h1 {
    font-size: 28px;
    font-weight: 700;
  }
  .article-container .subtitle {
    font-size: 18px;
    font-style: italic;
    color: #555;
    margin-top: -0.5em;
    margin-bottom: 1.5em;
  }
  .article-container .section-heading {
    font-size: 22px;
    font-weight: 700;
    border-bottom: 2px solid #eee;
    padding-bottom: 0.3em;
  }
  .article-container .sub-section-heading {
    font-size: 18px;
    font-weight: 700;
    color: #444;
  }
  .article-container p {
    margin-bottom: 1em;
  }
  .article-container ul, .article-container ol {
    padding-left: 20px;
    margin-bottom: 1.5em;
  }
  .article-container li {
    margin-bottom: 0.5em;
  }
  .article-container .key-takeaways-list li {
     background: #f9f9f9;
     border-left: 3px solid #0073aa;
     padding: 10px 15px;
  }
  .article-container table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1.5em;
    font-size: 14px;
  }
  .article-container th, .article-container td {
    border: 1px solid #ddd;
    padding: 12px;
    text-align: left;
  }
  .article-container th {
    background-color: #f0f0f0;
    font-weight: 700;
  }
  .article-container .checklist {
    list-style-type: none;
    padding-left: 0;
  }
  .article-container .checklist li {
    position: relative;
    padding-left: 30px;
  }
  .article-container .checklist li::before {
    content: '☐';
    font-size: 20px;
    position: absolute;
    left: 0;
    top: -3px;
    color: #0073aa;
  }
  .article-container .faq-item {
    margin-bottom: 2em;
    padding-bottom: 1em;
  }
  .article-container .faq-question {
    font-size: 16px;
    font-weight: 700;
  }
  .article-container .real-results, .article-container .takeaway {
    margin-top: 1em;
    padding: 12px;
    border-left: 3px solid #ccc;
    font-size: 14px;
  }
  .article-container .real-results {
    background-color: #f5f5f5;
  }
  .article-container .takeaway {
    background-color: #f0f7ff;
    font-style: italic;
  }
  .article-container .back-to-toc a {
    font-size: 12px;
    text-decoration: none;
    color: #0073aa;
  }
  .article-container .toc-link {
    color: #0073aa;
    text-decoration: none;
    transition: color 0.3s ease;
  }
  .article-container .toc-link:hover {
    color: #005a87;
    text-decoration: underline;
  }
  html {
    scroll-behavior: smooth;
  }
  .article-container .faq-item:target {
    background-color: #fffbf0;
    border-left: 4px solid #0073aa;
    margin-left: -16px;
    padding-left: 16px;
    transition: all 0.3s ease;
  }
  .article-container .faq-item {
    scroll-margin-top: 100px;
  }
  .admin-bar .article-container .faq-item {
    scroll-margin-top: 132px;
  }
  body:has(.site-header[style*="sticky"]) .article-container .faq-item,
  body:has(.site-header[style*="fixed"]) .article-container .faq-item,
  body:has(header[style*="sticky"]) .article-container .faq-item,
  body:has(header[style*="fixed"]) .article-container .faq-item {
    scroll-margin-top: 120px;
  }
  @media (max-width: 768px) {
    .article-container .faq-item {
      scroll-margin-top: 80px;
    }
    .admin-bar .article-container .faq-item {
      scroll-margin-top: 126px;
    }
  }
  .article-container hr {
    border: 0;
    border-top: 2px solid #eee;
    margin: 2em 0;
  }
  .article-container .author-box {
    margin-top: 2em;
    padding: 1.5em;
    background: #f9f9f9;
    border-left: 3px solid #0073aa;
  }
  .article-container .author-name {
    font-weight: 700;
    font-size: 16px;
  }
  .article-container .cta-button {
    display: inline-block;
    background-color: #0073aa;
    color: #fff;
    padding: 12px 20px;
    text-decoration: none;
    border-radius: 4px;
    margin-top: 1.5em;
    text-align: center;
  }
  @media (max-width: 768px) {
    .article-container h1 { font-size: 24px; }
    .article-container .subtitle { font-size: 16px; }
    .article-container .section-heading { font-size: 20px; }
  }
</style>

<script>
(function() {
  function detectAndCompensateStickyHeaders() {
    const potentialHeaders = [
      '#wpadminbar',
      'header[style*="position: fixed"]',
      'header[style*="position: sticky"]',
      '.site-header[style*="position: fixed"]',
      '.site-header[style*="position: sticky"]',
      '#masthead[style*="position: fixed"]',
      '#masthead[style*="position: sticky"]',
      '.navbar-fixed-top',
      '.fixed-header',
      '.sticky-header'
    ];
    
    let totalHeight = 0;
    const detectedHeaders = [];
    
    potentialHeaders.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          if (element && element.offsetHeight > 0) {
            const styles = window.getComputedStyle(element);
            const position = styles.position;
            
            if ((position === 'fixed' || position === 'sticky') && 
                styles.display !== 'none' && 
                element.offsetHeight > 0) {
              
              if (!detectedHeaders.some(h => h.element === element)) {
                detectedHeaders.push({
                  element: element,
                  height: element.offsetHeight
                });
                totalHeight += element.offsetHeight;
              }
            }
          }
        });
      } catch (e) {}
    });
    
    const finalOffset = Math.max(totalHeight + 20, 80);
    
    const existingStyle = document.getElementById('faq-scroll-offset');
    if (existingStyle) {
      existingStyle.remove();
    }
    
    const style = document.createElement('style');
    style.id = 'faq-scroll-offset';
    style.textContent = \`
      .article-container .faq-item {
        scroll-margin-top: \${finalOffset}px !important;
      }
      @media (max-width: 768px) {
        .article-container .faq-item {
          scroll-margin-top: \${Math.max(finalOffset * 0.8, 60)}px !important;
        }
      }
    \`;
    document.head.appendChild(style);
    
    return finalOffset;
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', detectAndCompensateStickyHeaders);
  } else {
    detectAndCompensateStickyHeaders();
  }
  
  setTimeout(detectAndCompensateStickyHeaders, 1000);
  
  let resizeTimeout;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(detectAndCompensateStickyHeaders, 250);
  });
  
  window.addEventListener('load', function() {
    setTimeout(detectAndCompensateStickyHeaders, 500);
  });
})();
</script>
`;

  // --- 2. Section Generators ---
  const sectionGenerators = {
    title: () => {
      let html = '';
      html += `<h1>${json.title || ''}</h1>`;
      html += `<p class="subtitle">${json.subtitle || ''}</p>`;
      return html;
    },

    key_takeaways: () => {
      if (!json.key_takeaways || json.key_takeaways.length === 0) return '';
      let html = '';
      html += `<h2 class="section-heading">Quick Summary / Key Takeaways</h2>`;
      html += `<ul class="key-takeaways-list">`;
      json.key_takeaways.forEach(takeaway => {
        html += `<li>${takeaway}</li>`;
      });
      html += `</ul>`;
      return html;
    },

    intro: () => {
      if (!json.intro_md) return '';
      let html = '';
      html += `<h2 class="section-heading">Introduction</h2>`;
      const paragraphs = json.intro_md.split('\n\n');
      paragraphs.forEach((p, index) => {
        if (index === 0) {
          html += `<p>${boldFirstSentence(p)}</p>`;
        } else {
          html += `<p>${p}</p>`;
        }
      });
      return html;
    },

    tables: () => {
      if (!json.tables || json.tables.length === 0) return '';
      let html = '';
      json.tables.forEach(tableData => {
        html += `<h3 class="sub-section-heading">${tableData.title}</h3>`;
        html += `<table>`;
        html += `<thead><tr>${tableData.headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
        html += `<tbody>`;
        tableData.rows.forEach(row => {
          html += `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`;
        });
        html += `</tbody></table>`;
      });
      return html;
    },

    checklists: () => {
      if (!json.checklists) return '';
      let html = '';
      if (json.checklists.launch && json.checklists.launch.length > 0) {
        html += `<h3 class="sub-section-heading">Application Preparation Checklist</h3>`;
        html += `<ul class="checklist">`;
        json.checklists.launch.forEach(item => html += `<li>${item}</li>`);
        html += `</ul>`;
      }
      if (json.checklists.post_contest && json.checklists.post_contest.length > 0) {
        html += `<h3 class="sub-section-heading">Post-Arrival Checklist</h3>`;
        html += `<ul class="checklist">`;
        json.checklists.post_contest.forEach(item => html += `<li>${item}</li>`);
        html += `</ul>`;
      }
      return html;
    },

    toc: () => {
      if (!json.toc || json.toc.length === 0) return '';
      let html = '';
      html += `<h2 id="table-of-contents" class="section-heading">Table of Contents</h2>`;
      let questionCounter = 1;
      json.toc.forEach((section, sectionIndex) => {
        html += `<h3 class="sub-section-heading">Section ${sectionIndex + 1}: ${section.section_title}</h3>`;
        html += `<ol start="${questionCounter}">`;
        section.questions.forEach((question, qIndex) => {
          const faqIndex = questionCounter - 1;
          html += `<li><a href="#faq-${faqIndex}" class="toc-link">${question}</a></li>`;
          questionCounter++;
        });
        html += `</ol>`;
      });
      return html;
    },

    faqs: () => {
      if (!json.faqs || json.faqs.length === 0) return '';
      let html = '';
      html += `<h2 class="section-heading">Frequently Asked Questions</h2>`;
      let currentSection = '';
      let sectionNumber = 0;
      
      // Create a map to track section numbers from TOC
      const sectionNumberMap = new Map();
      if (json.toc && json.toc.length > 0) {
        json.toc.forEach((section, idx) => {
          sectionNumberMap.set(section.section_title, idx + 1);
        });
      }
      
      json.faqs.forEach((faq, index) => {
        if (faq.section_title !== currentSection) {
          currentSection = faq.section_title;
          sectionNumber++;
          const tocSectionNumber = sectionNumberMap.get(currentSection) || sectionNumber;
          html += `<h3 class="sub-section-heading">Section ${tocSectionNumber}: ${currentSection}</h3>`;
        }
        const faqId = `faq-${index}`;
        html += `<div class="faq-item" id="${faqId}">`;
        html += `<p class="faq-question"><strong>FAQ ${index + 1}: ${faq.question}</strong></p>`;
        html += `<p>${boldFirstSentence(faq.answer_md)}</p>`;
        if (faq.real_results) {
          html += `<div class="real-results"><strong>Real Results:</strong> ${faq.real_results}</div>`;
        }
        if (faq.takeaway) {
          html += `<div class="takeaway"><strong>Takeaway:</strong> ${faq.takeaway}</div>`;
        }
        
        // Check if video exists for this FAQ and inject it, otherwise add mount point
        const videoData = videos?.[faqId];
        if (videoData?.status === 'completed' && videoData?.videoUrl) {
          // Inject video HTML directly
          html += `
    <div class="faq-video-player" data-faq-id="${faqId}" style="margin-top: 1rem; padding: 1rem; background: rgba(0,0,0,0.02); border: 1px solid rgba(0,0,0,0.1); border-radius: 8px;">
      <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00D4FF" stroke-width="2">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        <span style="font-size: 0.9rem; font-weight: 600; color: #00D4FF;">AI Generated Video</span>
      </div>
      <video controls style="width: 100%; max-width: 600px; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" poster="${videoData.thumbnailUrl || ''}">
        <source src="${videoData.videoUrl}" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      ${videoData.duration ? `<div style="font-size: 0.8rem; color: #666; margin-top: 0.5rem;">Duration: ${Math.round(videoData.duration)}s</div>` : ''}
    </div>`;
        } else {
          // Add placeholder for React component mounting
          html += `<div class="faq-video-mount" data-faq-id="${faqId}"></div>`;
        }
        
        html += `<p class="back-to-toc"><a href="#table-of-contents">↑ Back to Table of Contents</a></p>`;
        html += `</div>`;

        if ((index + 1) % 5 === 0 && index < json.faqs.length - 1) {
          html += `<hr>`;
        }
      });
      return html;
    },

    author_cta: () => {
      if (!json.author && !json.cta) return '';
      let html = '<hr>';
      if (json.author) {
        html += `<div class="author-box">`;
        html += `<p class="author-name">${json.author.name || ''}</p>`;
        html += `<p>${json.author.bio || ''}</p>`;
        html += `</div>`;
      }
      if (json.cta) {
        html += `<p><a href="${json.cta.url}" class="cta-button">${json.cta.text}</a></p>`;
      }
      return html;
    },

    meta_description: () => {
      // Check both direct meta_description and nested metadata.meta_description
      const metaDescription = json.meta_description || (json.metadata && json.metadata.meta_description);
      if (!metaDescription) return '';
      let html = '<hr>';
      html += `<div class="meta-description-section" style="margin-top: 2rem; padding: 1.5rem; background: #f8f9fa; border-left: 4px solid #0073aa; border-radius: 4px;">`;
      html += `<h3 style="margin-top: 0; margin-bottom: 0.5rem; color: #0073aa; font-size: 1.1rem; font-weight: 600;">Article Summary</h3>`;
      html += `<p style="margin: 0; color: #555; font-size: 0.95rem; line-height: 1.6;">${metaDescription}</p>`;
      html += `</div>`;
      return html;
    }
  };

  // --- 3. Build The HTML Structure Using Custom Order ---
  let html = `<div class="article-container">`;

  // Default section order if none provided
  const defaultOrder = [
    { id: 'title' },
    { id: 'key_takeaways' },
    { id: 'intro' },
    { id: 'tables' },
    { id: 'checklists' },
    { id: 'toc' },
    { id: 'faqs' },
    { id: 'meta_description' }
  ];

  const order = sectionOrder && sectionOrder.length > 0 ? sectionOrder : defaultOrder;

  // Generate sections in the specified order
  order.forEach(section => {
    const generator = sectionGenerators[section.id];
    if (generator) {
      const sectionHtml = generator();
      if (sectionHtml) {
        html += sectionHtml;
      }
    }
  });

  html += `</div>`;

  // --- 4. Combine CSS and HTML ---
  return css + html;
}

/**
 * Get default section order
 * @returns {array} Default section order configuration
 */
export function getDefaultSectionOrder() {
  return [
    { id: 'title', label: 'Title & Subtitle', required: true, description: 'Article title and subtitle' },
    { id: 'key_takeaways', label: 'Key Takeaways', required: false, description: 'Summary bullets at the top' },
    { id: 'intro', label: 'Introduction', required: true, description: 'Opening paragraphs' },
    { id: 'tables', label: 'Tables', required: false, description: 'Data tables and comparisons' },
    { id: 'checklists', label: 'Checklists', required: false, description: 'Action checklists' },
    { id: 'toc', label: 'Table of Contents', required: false, description: 'Article outline' },
    { id: 'faqs', label: 'FAQs', required: false, description: 'Question and answer sections' },
    { id: 'meta_description', label: 'Article Summary', required: false, description: 'Meta description box' }
  ];
}
