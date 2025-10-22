// Utility to convert structured article JSON into a single Gutenberg-compatible HTML string
// Extracted from src/app/dashboard/create/keyword/page.js so it can be reused across the app

export function convertJsonToGutenbergHtml(json, existingVideos = null) {
  if (!json) return '<div></div>';

  const boldFirstSentence = (text) => {
    if (!text) return '';
    const firstPeriodIndex = text.indexOf('.');
    if (firstPeriodIndex !== -1) {
      return `<strong>${text.substring(0, firstPeriodIndex + 1)}</strong>${text.substring(firstPeriodIndex + 1)}`;
    }
  return `<strong>${text}</strong>`;
  };
  
  // Create a slug from text for use as an ID
  const createSlug = (text) => {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  // Helper function to add paragraph spacing every 3 sentences
  const addParagraphSpacing = (text) => {
    if (!text) return '';

    // Split text into sentences using regex that handles various punctuation
    const sentences = text.split(/(?<=[.!?])\s+/);

    // Group sentences into chunks of 3
    const paragraphs = [];
    for (let i = 0; i < sentences.length; i += 3) {
      const chunk = sentences.slice(i, i + 3);
      paragraphs.push(chunk.join(' '));
    }

    // Join paragraphs with HTML paragraph tags
    return paragraphs.map(p => `<p>${p}</p>`).join('');
  };

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
  .article-container table { width: 100%; border-collapse: collapse; margin-bottom: 1.5em; font-size: 14px; }
  .article-container th, .article-container td { border: 1px solid #ddd; padding: 12px; text-align: left; }
  .article-container th { background-color: #f0f0f0; font-weight: 700; }
  .article-container .checklist { list-style-type: none; padding-left: 0; }
  .article-container .checklist li { position: relative; padding-left: 30px; }
  .article-container .checklist li::before { content: '☐'; font-size: 20px; position: absolute; left: 0; top: -3px; color: #0073aa; }
  .article-container .faq-item { margin-bottom: 2em; padding-bottom: 1em; }
  .article-container .faq-question { font-size: 16px; font-weight: 700; }
  .article-container .real-results, .article-container .takeaway { margin-top: 1em; padding: 12px; border-left: 3px solid #ccc; font-size: 16px; }
  .article-container .real-results { background-color: #f5f5f5; }
  .article-container .takeaway { background-color: #f0f7ff; font-style: italic; }
  .article-container .back-to-toc a { font-size: 12px; text-decoration: none; color: #0073aa; }
  .article-container hr { border: 0; border-top: 2px solid #eee; margin: 2em 0; }
  .article-container .author-box { margin-top: 2em; padding: 1.5em; background: #f9f9f9; border-left: 3px solid #0073aa; }
  .article-container .author-name { font-weight: 700; font-size: 16px; }
  .article-container .cta-button { display: inline-block; background-color: #0073aa; color: #fff; padding: 12px 20px; text-decoration: none; border-radius: 4px; margin-top: 1.5em; text-align: center; }
  .article-container .toc-link { color: #0073aa; text-decoration: none; transition: color 0.3s ease; }
  .article-container .toc-link:hover { color: #005a87; text-decoration: underline; }
  html { scroll-behavior: smooth; }
  .article-container .faq-item:target { background-color: #fffbf0; border-left: 4px solid #0073aa; margin-left: -16px; padding-left: 16px; transition: all 0.3s ease; }
  
  /* Sticky Header Compensation - Multiple fallback strategies */
  .article-container .faq-item {
    scroll-margin-top: 100px; /* Base fallback for most themes */
  }
  
  /* WordPress admin bar compensation */
  .admin-bar .article-container .faq-item {
    scroll-margin-top: 132px; /* 32px admin bar + 100px theme header */
  }
  
  /* Common WordPress theme header compensation */
  body:has(.site-header[style*="sticky"]) .article-container .faq-item,
  body:has(.site-header[style*="fixed"]) .article-container .faq-item,
  body:has(header[style*="sticky"]) .article-container .faq-item,
  body:has(header[style*="fixed"]) .article-container .faq-item,
  body:has(.navbar-fixed-top) .article-container .faq-item,
  body:has(.fixed-header) .article-container .faq-item,
  body:has(.sticky-header) .article-container .faq-item {
    scroll-margin-top: 120px;
  }
  
  /* Responsive compensation */
  @media (max-width: 768px) { 
    .article-container h1 { font-size: 24px; } 
    .article-container .subtitle { font-size: 16px; } 
    .article-container .section-heading { font-size: 20px; }
    .article-container .faq-item { scroll-margin-top: 80px; } /* Smaller offset on mobile */
    .admin-bar .article-container .faq-item { scroll-margin-top: 126px; } /* 46px mobile admin bar + 80px */
  }
</style>

<script>
(function() {
  // Dynamic sticky header detection and compensation
  function detectAndCompensateStickyHeaders() {
    // Common selectors for WordPress sticky headers
    const potentialHeaders = [
      '#wpadminbar', // WordPress admin bar
      'header[style*="position: fixed"]',
      'header[style*="position: sticky"]',
      '.site-header[style*="position: fixed"]',
      '.site-header[style*="position: sticky"]',
      '#masthead[style*="position: fixed"]',
      '#masthead[style*="position: sticky"]',
      '.navbar-fixed-top',
      '.navbar-fixed',
      '.fixed-header',
      '.sticky-header',
      '.site-navigation[style*="position: fixed"]',
      '.site-navigation[style*="position: sticky"]',
      '.main-navigation[style*="position: fixed"]',
      '.main-navigation[style*="position: sticky"]',
      '[class*="sticky"][class*="header"]',
      '[class*="fixed"][class*="header"]'
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
            const zIndex = parseInt(styles.zIndex) || 0;
            
            // Check if element is actually sticky/fixed and visible
            if ((position === 'fixed' || position === 'sticky') && 
                styles.display !== 'none' && 
                styles.visibility !== 'hidden' &&
                element.offsetHeight > 0) {
              
              // Avoid counting the same element twice
              if (!detectedHeaders.some(h => h.element === element)) {
                detectedHeaders.push({
                  element: element,
                  height: element.offsetHeight,
                  selector: selector,
                  zIndex: zIndex
                });
                totalHeight += element.offsetHeight;
              }
            }
          }
        });
      } catch (e) {
        // Ignore selector errors for unsupported CSS
      }
    });
    
    // Add some padding for safety
    const finalOffset = Math.max(totalHeight + 20, 80);
    
    // Apply the calculated offset
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
    
    // Debug info (remove in production)
    if (detectedHeaders.length > 0) {
      console.log('QueryFuel: Detected sticky headers:', detectedHeaders.map(h => ({
        selector: h.selector,
        height: h.height,
        zIndex: h.zIndex
      })));
      console.log(\`QueryFuel: Applied scroll offset: \${finalOffset}px\`);
    }
    
    return finalOffset;
  }
  
  // Run detection when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', detectAndCompensateStickyHeaders);
  } else {
    detectAndCompensateStickyHeaders();
  }
  
  // Re-run detection after a short delay to catch dynamically loaded headers
  setTimeout(detectAndCompensateStickyHeaders, 1000);
  
  // Re-run on window resize in case header height changes
  let resizeTimeout;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(detectAndCompensateStickyHeaders, 250);
  });
  
  // Also run when images load (in case they affect header height)
  window.addEventListener('load', function() {
    setTimeout(detectAndCompensateStickyHeaders, 500);
  });
})();
</script>`;

  let html = `<div class="article-container">`;

  html += `<h1>${json.title || ''}</h1>`;
  html += `<p class="subtitle">${json.subtitle || ''}</p>`;

  if (json.key_takeaways && json.key_takeaways.length > 0) {
    html += `<h2 class="section-heading">Quick Summary / Key Takeaways</h2>`;
    html += `<ul class="key-takeaways-list">`;
    json.key_takeaways.forEach(t => { html += `<li>${t}</li>`; });
    html += `</ul>`;
  }

  if (json.intro_md) {
    html += `<h2 class="section-heading">Introduction</h2>`;
    const paragraphs = json.intro_md.split('\n\n');
    paragraphs.forEach((p, idx) => {
      if (idx === 0) {
        // Apply paragraph spacing to the first paragraph and bold first sentence
        const spacedContent = addParagraphSpacing(p);
        if (spacedContent) {
          // Replace the first <p> tag content with bold first sentence
          html += spacedContent.replace(/<p>(.*?)<\/p>/, (match, content) => `<p>${boldFirstSentence(content)}</p>`);
        } else {
          html += `<p>${boldFirstSentence(p)}</p>`;
        }
      } else {
        // Apply paragraph spacing to other paragraphs
        const spacedContent = addParagraphSpacing(p);
        html += spacedContent || `<p>${p}</p>`;
      }
    });
  }

  if (json.tables && json.tables.length > 0) {
    json.tables.forEach(tableData => {
      html += `<h3 class="sub-section-heading">${tableData.title}</h3>`;
      html += `<table>`;
      html += `<thead><tr>${tableData.headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
      html += `<tbody>`;
      tableData.rows.forEach(row => { html += `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`; });
      html += `</tbody></table>`;
    });
  }

  if (json.checklists) {
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
  }

  // Create a mapping of questions to FAQ indices for linking
  const questionToFaqMap = new Map();
  if (json.faqs && json.faqs.length > 0) {
    json.faqs.forEach((faq, index) => {
      const normalizedQuestion = faq.question?.toLowerCase().trim();
      if (normalizedQuestion) {
        questionToFaqMap.set(normalizedQuestion, index);
      }
    });
  }

  if (json.toc && json.toc.length > 0) {
    html += `<h2 id="table-of-contents" class="section-heading">Table of Contents</h2>`;
    let questionCounter = 1;
    json.toc.forEach((section, sectionIndex) => {
      // Add section number to the heading
      html += `<h3 class="sub-section-heading">Section ${sectionIndex + 1}: ${section.section_title}</h3>`;
      html += `<ol start="${questionCounter}">`;
      section.questions.forEach(q => {
        // Try to find matching FAQ for this question
        const normalizedQ = q?.toLowerCase().trim();
        const faqIndex = questionToFaqMap.get(normalizedQ);
        
        if (faqIndex !== undefined) {
          // Use simple ID format to match FAQ section
          const faqId = `faq-${faqIndex}`;
          html += `<li><a href="#${faqId}" class="toc-link">${q}</a></li>`;
        } else {
          // If no matching FAQ found, just display the question without a link
          html += `<li>${q}</li>`;
        }
      });
      html += `</ol>`;
      questionCounter += section.questions.length;
    });
  }

  if (json.faqs && json.faqs.length > 0) {
    html += `<h2 class="section-heading">Frequently Asked Questions</h2>`;
    let currentSection = '';
    let sectionNumber = 0;
    
    // Create a map to track section numbers
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
        // Try to use the TOC section number if available, otherwise use sequential numbering
        const tocSectionNumber = sectionNumberMap.get(currentSection) || sectionNumber;
        html += `<h3 class="sub-section-heading">Section ${tocSectionNumber}: ${currentSection}</h3>`;
      }
      // Create a simple, consistent ID for this FAQ item (0-based indexing)
      const faqId = `faq-${index}`;
      html += `<div class="faq-item" id="${faqId}">`;
      html += `<p class="faq-question"><strong>FAQ ${index + 1}: ${faq.question}</strong></p>`;

      // Apply paragraph spacing to FAQ answer
      const spacedAnswer = addParagraphSpacing(faq.answer_md);
      if (spacedAnswer) {
        // Replace the first <p> tag content with bold first sentence
        html += spacedAnswer.replace(/<p>(.*?)<\/p>/, (match, content) => `<p>${boldFirstSentence(content)}</p>`);
      } else {
        html += `<p>${boldFirstSentence(faq.answer_md)}</p>`;
      }

      if (faq.real_results) html += `<div class="real-results"><strong>Real Results:</strong> ${faq.real_results}</div>`;
      if (faq.takeaway) html += `<div class="takeaway"><strong>Takeaway:</strong> ${faq.takeaway}</div>`;
      
      // Check if video exists for this FAQ and inject it, otherwise add mount point
      const videoData = existingVideos?.[faqId];
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
      if ((index + 1) % 5 === 0 && index < json.faqs.length - 1) html += `<hr>`;
    });
  }

  // Meta Description (added at the bottom)
  const metaDescription = json.meta_description || (json.metadata && json.metadata.meta_description);
  if (metaDescription) {
    html += `<hr>`;
    html += `<div class="meta-description-section" style="margin-top: 2rem; padding: 1.5rem; background: #f8f9fa; border-left: 4px solid #0073aa; border-radius: 4px;">`;
    html += `<h3 style="margin-top: 0; margin-bottom: 0.5rem; color: #0073aa; font-size: 1.1rem; font-weight: 600;">Article Summary</h3>`;
    html += `<p style="margin: 0; color: #555; font-size: 0.95rem; line-height: 1.6;">${metaDescription}</p>`;
    html += `</div>`;
  }

  // Author and CTA rendering disabled: no author box or CTA button will be added to the output

  html += `</div>`;

  return css + html;
}
