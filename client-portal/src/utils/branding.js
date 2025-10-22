/**
 * Branding utilities for QueryFuel
 * Handles "Powered by QueryFuel and Rise Peak Digital" branding based on subscription tiers
 * Also includes brand voice utility functions
 */

/**
 * Determines if branding should be shown based on subscription tier
 * @param {string} tier - User's subscription tier
 * @param {object} userSettings - User's branding preferences (for future use)
 * @returns {boolean} Whether to show branding
 */
export const shouldShowBranding = (tier, userSettings = {}) => {
  if (!tier) return true; // Default to showing branding for unknown tiers
  
  const tierLower = tier.toLowerCase();
  
  // Always show for Free and Starter plans
  if (tierLower === 'free' || tierLower === 'starter') {
    return true;
  }
  
  // For Growth and Scale plans, check user settings (default to false - no branding)
  if (tierLower === 'growth' || tierLower === 'scale') {
    return userSettings.showBranding === true; // Only show if explicitly enabled
  }
  
  // For Client tier, check user settings (default to false - no branding)
  if (tierLower === 'client') {
    return userSettings.showBranding === true; // Only show if explicitly enabled
  }
  
  // For Agency Custom, show by default but allow removal
  if (tierLower === 'agency custom' || tierLower === 'agency') {
    return userSettings.showBranding !== false; // Show unless explicitly disabled
  }
  
  // Default to showing branding for unknown tiers
  return true;
};

/**
 * Generates the "Powered by QueryFuel and Rise Peak Digital" HTML branding
 * @param {object} options - Branding options
 * @returns {string} HTML string for the branding
 */
const normalizeBrandingWhitespace = (html) => html.replace(/\s*\n\s*/g, ' ');

export const generateBrandingHtml = (options = {}) => {
  const {
    style = 'default', // 'default', 'minimal', 'compact'
    alignment = 'center', // 'left', 'center', 'right'
    showLogo = true,
    customText = null
  } = options;

  const queryfuelUrl = 'https://queryfuel.io';
  const risepeakUrl = 'https://risepeakdigital.com';

  // Base styles that work across different platforms
  const baseStyles = {
    container: `
      margin: 2px 0 2px 0;
      padding: 2px 1rem 4px 1rem;
      display: flex !important;
      align-items: baseline !important;
      justify-content: ${alignment === 'left' ? 'flex-start' : alignment === 'right' ? 'flex-end' : 'center'} !important;
      gap: 6px !important;
      flex-wrap: nowrap !important;
      white-space: nowrap !important;
      border-top: 1px solid #e5e7eb;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `,
    link: `
      color: #6b7280;
      text-decoration: none;
      font-size: 9px;
      font-weight: 500;
      transition: color 0.2s ease;
      display: inline-flex !important;
      align-items: baseline !important;
      flex-direction: row !important;
      gap: 4px !important;
      line-height: 1.2;
      white-space: nowrap !important;
    `,
    linkHover: `
      color: #00D4FF;
    `,
    logo: `
      width: 14px;
      height: 14px;
      border-radius: 3px;
      background: linear-gradient(135deg, #00D4FF 0%, #00A8CC 100%);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 9px;
      color: #0A0E27;
      margin-right: 4px;
      vertical-align: text-bottom;
      position: relative;
      top: -1px;
    `,
    separator: `
      color: #9ca3af;
      margin: 0 4px;
      font-size: 9px;
      line-height: 1.2;
    `,
    poweredBy: `
      font-size: 9px;
      color: #9ca3af;
      line-height: 1.2;
    `
  };

  const logoHtml = showLogo ? `<span style="${baseStyles.logo}">Q</span>` : '';

  // If custom text is provided, use it as a single link to QueryFuel
  if (customText) {
    return normalizeBrandingWhitespace(`
      <div class="queryfuel-branding" style="${baseStyles.container}">
        <a href="${queryfuelUrl}" target="_blank" rel="noopener noreferrer" style="${baseStyles.link}" onmouseover="this.style.color='#00D4FF'" onmouseout="this.style.color='#6b7280'">${logoHtml}${customText}</a>
      </div>
    `);
  }

  // Default branding with both links
  return normalizeBrandingWhitespace(`
    <div class="queryfuel-branding" style="${baseStyles.container}">
      <span style="${baseStyles.poweredBy}">Powered by</span>
      <a href="${queryfuelUrl}" target="_blank" rel="noopener noreferrer" style="${baseStyles.link}" onmouseover="this.style.color='#00D4FF'" onmouseout="this.style.color='#6b7280'">${logoHtml}QueryFuel</a>
      <span style="${baseStyles.separator}">and</span>
      <a href="${risepeakUrl}" target="_blank" rel="noopener noreferrer" style="${baseStyles.link}" onmouseover="this.style.color='#00D4FF'" onmouseout="this.style.color='#6b7280'">Rise Peak Digital</a>
    </div>
  `);
};

/**
 * Appends branding to article content
 * @param {string} htmlContent - Original article HTML
 * @param {string} tier - User's subscription tier
 * @param {object} userSettings - User's branding preferences
 * @param {object} brandingOptions - Branding display options
 * @returns {string} HTML content with branding appended
 */
export const appendBrandingToContent = (htmlContent, tier, userSettings = {}, brandingOptions = {}) => {
  if (!shouldShowBranding(tier, userSettings)) {
    return htmlContent;
  }

  const brandingHtml = generateBrandingHtml(brandingOptions);
  
  // Try to insert before closing body tag, or append to end
  if (htmlContent.includes('</body>')) {
    return htmlContent.replace('</body>', `${brandingHtml}</body>`);
  } else if (htmlContent.includes('</div>')) {
    // Find the last closing div and insert before it
    const lastDivIndex = htmlContent.lastIndexOf('</div>');
    return htmlContent.slice(0, lastDivIndex) + brandingHtml + htmlContent.slice(lastDivIndex);
  } else {
    // Just append to the end
    return htmlContent + brandingHtml;
  }
};

/**
 * Preview branding component for the view page
 * @param {string} tier - User's subscription tier
 * @param {object} userSettings - User's branding preferences
 * @returns {object} Branding preview info
 */
export const getBrandingPreview = (tier, userSettings = {}) => {
  const willShow = shouldShowBranding(tier, userSettings);
  
  return {
    willShow,
    tier,
    canDisable: tier && ['growth', 'scale', 'agency custom', 'agency'].includes(tier.toLowerCase()),
    message: willShow 
      ? `"Powered by QueryFuel and Rise Peak Digital" will be added to published articles (${tier || 'Free'} plan)`
      : `Branding disabled for ${tier} plan`,
    brandingHtml: willShow ? generateBrandingHtml() : null
  };
};

// ===== BRAND VOICE UTILITIES =====

/**
 * Validates brand voice settings structure
 * @param {Object} brandVoice - Brand voice settings to validate
 * @returns {Object} Validation result with isValid and errors
 */
export const validateBrandVoiceSettings = (brandVoice) => {
  const errors = [];
  
  if (!brandVoice || typeof brandVoice !== 'object') {
    return { isValid: false, errors: ['Brand voice settings must be an object'] };
  }

  // Validate preferred terms
  if (brandVoice.preferredTerms && !Array.isArray(brandVoice.preferredTerms)) {
    errors.push('Preferred terms must be an array');
  }

  // Validate banned phrases
  if (brandVoice.bannedPhrases && !Array.isArray(brandVoice.bannedPhrases)) {
    errors.push('Banned phrases must be an array');
  }

  // Validate disclaimer
  if (brandVoice.defaultDisclaimer && typeof brandVoice.defaultDisclaimer !== 'string') {
    errors.push('Default disclaimer must be a string');
  }

  // Validate custom instructions
  if (brandVoice.customInstructions && typeof brandVoice.customInstructions !== 'string') {
    errors.push('Custom instructions must be a string');
  }

  // Validate industry
  if (brandVoice.industry && typeof brandVoice.industry !== 'string') {
    errors.push('Industry must be a string');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Generates a preview of how brand voice settings will affect content
 * @param {Object} brandVoice - Brand voice settings
 * @returns {Object} Preview information
 */
export const generateBrandVoicePreview = (brandVoice) => {
  if (!brandVoice || !brandVoice.enabled) {
    return {
      enabled: false,
      message: 'Brand voice is disabled. Content will use standard AI generation.',
      features: []
    };
  }

  const features = [];
  
  if (brandVoice.preferredTerms && brandVoice.preferredTerms.length > 0) {
    features.push(`Will use preferred terms: ${brandVoice.preferredTerms.slice(0, 3).join(', ')}${brandVoice.preferredTerms.length > 3 ? '...' : ''}`);
  }

  if (brandVoice.bannedPhrases && brandVoice.bannedPhrases.length > 0) {
    features.push(`Will avoid phrases: ${brandVoice.bannedPhrases.slice(0, 2).join(', ')}${brandVoice.bannedPhrases.length > 2 ? '...' : ''}`);
  }

  if (brandVoice.industry) {
    features.push(`Optimized for ${brandVoice.industry} industry`);
  }

  if (brandVoice.defaultDisclaimer) {
    features.push('Will include custom disclaimer');
  }

  if (brandVoice.customInstructions) {
    features.push('Will follow custom tone instructions');
  }

  return {
    enabled: true,
    message: `Brand voice is active with ${features.length} customization${features.length !== 1 ? 's' : ''}`,
    features
  };
};

/**
 * Formats brand voice settings for display in UI
 * @param {Object} brandVoice - Brand voice settings
 * @returns {Object} Formatted display data
 */
export const formatBrandVoiceForDisplay = (brandVoice) => {
  if (!brandVoice) {
    return {
      status: 'Not configured',
      summary: 'No brand voice settings configured',
      details: []
    };
  }

  if (!brandVoice.enabled) {
    return {
      status: 'Disabled',
      summary: 'Brand voice is configured but disabled',
      details: []
    };
  }

  const details = [];
  
  if (brandVoice.preferredTerms?.length > 0) {
    details.push(`${brandVoice.preferredTerms.length} preferred term${brandVoice.preferredTerms.length !== 1 ? 's' : ''}`);
  }

  if (brandVoice.bannedPhrases?.length > 0) {
    details.push(`${brandVoice.bannedPhrases.length} banned phrase${brandVoice.bannedPhrases.length !== 1 ? 's' : ''}`);
  }

  if (brandVoice.industry) {
    details.push(`${brandVoice.industry} industry focus`);
  }

  if (brandVoice.defaultDisclaimer) {
    details.push('Custom disclaimer');
  }

  if (brandVoice.customInstructions) {
    details.push('Custom instructions');
  }

  return {
    status: 'Active',
    summary: details.length > 0 ? details.join(', ') : 'Basic brand voice enabled',
    details
  };
};

/**
 * Checks if brand voice settings are complete and valid
 * @param {Object} brandVoice - Brand voice settings
 * @returns {Object} Completeness check result
 */
export const checkBrandVoiceCompleteness = (brandVoice) => {
  if (!brandVoice || !brandVoice.enabled) {
    return {
      isComplete: false,
      completionPercentage: 0,
      missingItems: ['Enable brand voice', 'Add preferred terms', 'Set industry focus'],
      suggestions: ['Start by enabling brand voice in your profile settings']
    };
  }

  const items = [
    { key: 'preferredTerms', label: 'Preferred terms', weight: 30 },
    { key: 'industry', label: 'Industry focus', weight: 20 },
    { key: 'bannedPhrases', label: 'Banned phrases', weight: 20 },
    { key: 'defaultDisclaimer', label: 'Custom disclaimer', weight: 15 },
    { key: 'customInstructions', label: 'Custom instructions', weight: 15 }
  ];

  let completedWeight = 0;
  const missingItems = [];
  const suggestions = [];

  items.forEach(item => {
    const value = brandVoice[item.key];
    const isComplete = Array.isArray(value) ? value.length > 0 : Boolean(value);
    
    if (isComplete) {
      completedWeight += item.weight;
    } else {
      missingItems.push(item.label);
      
      if (item.key === 'preferredTerms') {
        suggestions.push('Add terms you want to emphasize in your content');
      } else if (item.key === 'industry') {
        suggestions.push('Select your industry for better tone matching');
      }
    }
  });

  const completionPercentage = Math.round(completedWeight);

  return {
    isComplete: completionPercentage >= 70, // Consider 70%+ as complete
    completionPercentage,
    missingItems,
    suggestions: suggestions.slice(0, 2) // Limit to top 2 suggestions
  };
};