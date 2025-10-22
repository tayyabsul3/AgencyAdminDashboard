/**
 * Brand Voice Industry Presets Configuration
 * Defines pre-configured brand voice settings for different industries
 */

export const industryPresets = {
  general: {
    id: 'general',
    name: 'General Business',
    description: 'Professional, clear, and results-focused tone',
    icon: '💼',
    category: 'business',
    preferredTerms: [
      'strategy',
      'solution', 
      'results',
      'growth',
      'success',
      'optimization',
      'efficiency',
      'innovation',
      'best practices',
      'ROI'
    ],
    bannedPhrases: [
      'guaranteed',
      'instant',
      'magic bullet',
      'overnight success',
      'get rich quick',
      'foolproof',
      'never fails'
    ],
    customInstructions: 'Use professional, clear language that focuses on practical results and actionable insights. Emphasize data-driven approaches and measurable outcomes.',
    defaultDisclaimer: 'This content is for informational purposes only and should not be considered as professional advice. Results may vary based on individual circumstances.',
    toneKeywords: ['professional', 'authoritative', 'results-oriented', 'practical']
  },

  spiritual: {
    id: 'spiritual',
    name: 'Spiritual & Wellness',
    description: 'Nurturing, reflective, and empowering language',
    icon: '🌟',
    category: 'wellness',
    preferredTerms: [
      'capacity',
      'sacred pause',
      'story-based recovery',
      'inner wisdom',
      'transformation',
      'mindfulness',
      'self-discovery',
      'authentic self',
      'spiritual journey',
      'personal growth',
      'healing space',
      'gentle guidance',
      'empowerment',
      'wholeness',
      'balance'
    ],
    bannedPhrases: [
      'treat',
      'heal trauma',
      'clinical outcomes',
      'diagnose',
      'therapy',
      'cure',
      'fix',
      'broken',
      'disorder',
      'pathology',
      'medical treatment',
      'clinical intervention'
    ],
    customInstructions: 'Use gentle, empowering language that honors each person\'s unique journey and avoids clinical terminology. Focus on capacity-building, self-discovery, and inner wisdom rather than fixing or treating. Emphasize personal agency and spiritual growth.',
    defaultDisclaimer: 'This content is for educational and inspirational purposes only. It is not intended as a substitute for professional medical, psychological, or therapeutic advice. Please consult with qualified professionals for specific health concerns.',
    toneKeywords: ['nurturing', 'empowering', 'reflective', 'gentle', 'non-clinical']
  },

  healthcare: {
    id: 'healthcare',
    name: 'Healthcare & Medical',
    description: 'Evidence-based, professional, and patient-focused',
    icon: '🏥',
    category: 'medical',
    preferredTerms: [
      'evidence-based',
      'patient-centered',
      'clinical research',
      'best practices',
      'outcomes',
      'peer-reviewed',
      'medical literature',
      'healthcare professionals',
      'treatment options',
      'informed consent',
      'quality of care',
      'safety protocols'
    ],
    bannedPhrases: [
      'cure',
      'miracle',
      'guaranteed results',
      'instant relief',
      'magic solution',
      'breakthrough cure',
      'revolutionary treatment',
      'never fails'
    ],
    customInstructions: 'Use precise, evidence-based language backed by medical research. Always emphasize the importance of professional medical consultation and avoid making definitive medical claims. Focus on patient education and informed decision-making.',
    defaultDisclaimer: 'This information is for educational purposes only and is not intended to diagnose, treat, cure, or prevent any disease. Always consult with a qualified healthcare professional before making any medical decisions.',
    toneKeywords: ['evidence-based', 'professional', 'cautious', 'informative']
  },

  education: {
    id: 'education',
    name: 'Education & Learning',
    description: 'Clear, engaging, and knowledge-focused approach',
    icon: '📚',
    category: 'education',
    preferredTerms: [
      'learning objectives',
      'skill development',
      'knowledge transfer',
      'best practices',
      'competency',
      'curriculum',
      'pedagogy',
      'assessment',
      'critical thinking',
      'problem-solving',
      'collaborative learning',
      'educational outcomes'
    ],
    bannedPhrases: [
      'easy',
      'simple',
      'anyone can do it',
      'no effort required',
      'instant mastery',
      'effortless learning',
      'guaranteed success'
    ],
    customInstructions: 'Use clear, structured language that breaks down complex concepts into digestible parts. Focus on learning outcomes, skill development, and practical application. Encourage critical thinking and active engagement.',
    defaultDisclaimer: 'This educational content is designed to supplement, not replace, formal training or professional development programs. Learning outcomes may vary based on individual effort and circumstances.',
    toneKeywords: ['educational', 'structured', 'engaging', 'supportive']
  },

  legal: {
    id: 'legal',
    name: 'Legal & Compliance',
    description: 'Precise, authoritative, and risk-aware language',
    icon: '⚖️',
    category: 'legal',
    preferredTerms: [
      'compliance',
      'regulatory',
      'best practices',
      'risk management',
      'due diligence',
      'legal framework',
      'statutory requirements',
      'professional standards',
      'liability',
      'jurisdiction',
      'precedent',
      'legal counsel'
    ],
    bannedPhrases: [
      'guaranteed protection',
      'foolproof',
      'never fail',
      'complete immunity',
      'absolute defense',
      'bulletproof strategy',
      'risk-free approach'
    ],
    customInstructions: 'Use precise, authoritative language while emphasizing the importance of professional legal consultation for specific situations. Always acknowledge jurisdictional differences and the complexity of legal matters.',
    defaultDisclaimer: 'This content is for informational purposes only and does not constitute legal advice. Laws vary by jurisdiction and circumstances. Consult with a qualified attorney for specific legal matters.',
    toneKeywords: ['precise', 'authoritative', 'cautious', 'professional']
  },

  finance: {
    id: 'finance',
    name: 'Finance & Investment',
    description: 'Data-driven, cautious, and performance-focused',
    icon: '💰',
    category: 'finance',
    preferredTerms: [
      'risk assessment',
      'portfolio diversification',
      'market analysis',
      'financial planning',
      'due diligence',
      'asset allocation',
      'investment strategy',
      'risk tolerance',
      'market volatility',
      'financial goals',
      'performance metrics',
      'regulatory compliance'
    ],
    bannedPhrases: [
      'guaranteed returns',
      'risk-free',
      'get rich quick',
      'sure thing',
      'can\'t lose',
      'guaranteed profit',
      'no-risk investment',
      'instant wealth'
    ],
    customInstructions: 'Use data-driven language that emphasizes risk awareness and the importance of professional financial advice. Always include appropriate risk disclosures and avoid making performance guarantees.',
    defaultDisclaimer: 'This content is for educational purposes only and does not constitute financial advice. Past performance does not guarantee future results. All investments carry risk of loss. Consult with a qualified financial advisor before making investment decisions.',
    toneKeywords: ['analytical', 'cautious', 'data-driven', 'professional']
  },

  technology: {
    id: 'technology',
    name: 'Technology & Software',
    description: 'Technical, innovative, and solution-oriented',
    icon: '💻',
    category: 'technology',
    preferredTerms: [
      'scalable',
      'optimization',
      'architecture',
      'implementation',
      'integration',
      'performance',
      'security',
      'user experience',
      'innovation',
      'automation',
      'efficiency',
      'best practices'
    ],
    bannedPhrases: [
      'bug-free',
      'perfect solution',
      'never crashes',
      'impossible to hack',
      'zero downtime',
      'flawless code',
      'bulletproof system'
    ],
    customInstructions: 'Use technical language appropriately while remaining accessible. Focus on practical implementation, scalability, and real-world constraints. Acknowledge technical limitations and trade-offs.',
    defaultDisclaimer: 'This technical content is for informational purposes only. Implementation results may vary based on specific environments and requirements. Always test thoroughly before production deployment.',
    toneKeywords: ['technical', 'innovative', 'practical', 'solution-oriented']
  },

  marketing: {
    id: 'marketing',
    name: 'Marketing & Sales',
    description: 'Persuasive, customer-focused, and results-driven',
    icon: '📈',
    category: 'business',
    preferredTerms: [
      'customer journey',
      'value proposition',
      'conversion optimization',
      'brand awareness',
      'engagement',
      'ROI',
      'customer acquisition',
      'retention',
      'market research',
      'target audience',
      'campaign performance',
      'customer insights'
    ],
    bannedPhrases: [
      'guaranteed sales',
      'instant success',
      'viral guaranteed',
      'foolproof marketing',
      'never fails',
      'magic formula',
      'overnight results'
    ],
    customInstructions: 'Use persuasive yet honest language that focuses on customer value and measurable results. Emphasize testing, optimization, and data-driven decision making.',
    defaultDisclaimer: 'Marketing results may vary based on numerous factors including market conditions, competition, and execution. Past performance does not guarantee future results.',
    toneKeywords: ['persuasive', 'customer-focused', 'results-driven', 'authentic']
  }
};

/**
 * Get preset by ID
 * @param {string} presetId - The preset ID
 * @returns {Object|null} - The preset configuration or null if not found
 */
export const getPresetById = (presetId) => {
  return industryPresets[presetId] || null;
};

/**
 * Get all presets as an array
 * @returns {Array} - Array of all preset configurations
 */
export const getAllPresets = () => {
  return Object.values(industryPresets);
};

/**
 * Get presets by category
 * @param {string} category - The category to filter by
 * @returns {Array} - Array of presets in the specified category
 */
export const getPresetsByCategory = (category) => {
  return Object.values(industryPresets).filter(preset => preset.category === category);
};

/**
 * Search presets by name or description
 * @param {string} searchTerm - The search term
 * @returns {Array} - Array of matching presets
 */
export const searchPresets = (searchTerm) => {
  const term = searchTerm.toLowerCase();
  return Object.values(industryPresets).filter(preset => 
    preset.name.toLowerCase().includes(term) || 
    preset.description.toLowerCase().includes(term) ||
    preset.toneKeywords.some(keyword => keyword.toLowerCase().includes(term))
  );
};

/**
 * Get preset categories
 * @returns {Array} - Array of unique categories
 */
export const getPresetCategories = () => {
  const categories = [...new Set(Object.values(industryPresets).map(preset => preset.category))];
  return categories.sort();
};

/**
 * Validate preset configuration
 * @param {Object} preset - The preset to validate
 * @returns {Object} - Validation result with isValid and errors
 */
export const validatePreset = (preset) => {
  const errors = [];
  
  if (!preset.id) errors.push('Preset ID is required');
  if (!preset.name) errors.push('Preset name is required');
  if (!preset.description) errors.push('Preset description is required');
  if (!Array.isArray(preset.preferredTerms)) errors.push('Preferred terms must be an array');
  if (!Array.isArray(preset.bannedPhrases)) errors.push('Banned phrases must be an array');
  if (!preset.customInstructions) errors.push('Custom instructions are required');
  if (!preset.defaultDisclaimer) errors.push('Default disclaimer is required');
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export default industryPresets;