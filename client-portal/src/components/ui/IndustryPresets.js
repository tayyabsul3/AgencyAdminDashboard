'use client';

import { useState } from 'react';

/**
 * Industry Presets Component
 * Provides pre-configured brand voice settings for different industries
 */
const IndustryPresets = ({ 
  onPresetSelect, 
  currentIndustry = '', 
  className = '',
  disabled = false 
}) => {
  const [selectedPreset, setSelectedPreset] = useState(currentIndustry);

  // Industry preset configurations
  const industryPresets = [
    {
      id: 'general',
      name: 'General Business',
      description: 'Professional, clear, and results-focused tone',
      icon: '💼',
      preferredTerms: ['strategy', 'solution', 'results', 'growth', 'success'],
      bannedPhrases: ['guaranteed', 'instant', 'magic bullet'],
      customInstructions: 'Use professional, clear language that focuses on practical results and actionable insights.',
      defaultDisclaimer: 'This content is for informational purposes only and should not be considered as professional advice.'
    },
    {
      id: 'spiritual',
      name: 'Spiritual & Wellness',
      description: 'Nurturing, reflective, and empowering language',
      icon: '🌟',
      preferredTerms: ['capacity', 'sacred pause', 'story-based recovery', 'inner wisdom', 'transformation'],
      bannedPhrases: ['treat', 'heal trauma', 'clinical outcomes', 'diagnose', 'therapy'],
      customInstructions: 'Use gentle, empowering language that honors personal journey and avoids clinical terminology. Focus on capacity-building and self-discovery.',
      defaultDisclaimer: 'This content is for educational and inspirational purposes only. It is not intended as a substitute for professional medical or therapeutic advice.'
    },
    {
      id: 'healthcare',
      name: 'Healthcare & Medical',
      description: 'Evidence-based, professional, and patient-focused',
      icon: '🏥',
      preferredTerms: ['evidence-based', 'patient-centered', 'clinical research', 'best practices', 'outcomes'],
      bannedPhrases: ['cure', 'miracle', 'guaranteed results', 'instant relief'],
      customInstructions: 'Use precise, evidence-based language. Always emphasize the importance of professional medical consultation.',
      defaultDisclaimer: 'This information is for educational purposes only and is not intended to diagnose, treat, cure, or prevent any disease. Always consult with a qualified healthcare professional.'
    },
    {
      id: 'education',
      name: 'Education & Learning',
      description: 'Clear, engaging, and knowledge-focused approach',
      icon: '📚',
      preferredTerms: ['learning objectives', 'skill development', 'knowledge transfer', 'best practices', 'competency'],
      bannedPhrases: ['easy', 'simple', 'anyone can do it', 'no effort required'],
      customInstructions: 'Use clear, structured language that breaks down complex concepts. Focus on learning outcomes and skill development.',
      defaultDisclaimer: 'This educational content is designed to supplement, not replace, formal training or professional development programs.'
    },
    {
      id: 'legal',
      name: 'Legal & Compliance',
      description: 'Precise, authoritative, and risk-aware language',
      icon: '⚖️',
      preferredTerms: ['compliance', 'regulatory', 'best practices', 'risk management', 'due diligence'],
      bannedPhrases: ['guaranteed protection', 'foolproof', 'never fail', 'complete immunity'],
      customInstructions: 'Use precise, authoritative language while emphasizing the importance of professional legal consultation for specific situations.',
      defaultDisclaimer: 'This content is for informational purposes only and does not constitute legal advice. Consult with a qualified attorney for specific legal matters.'
    },
    {
      id: 'finance',
      name: 'Finance & Investment',
      description: 'Data-driven, cautious, and performance-focused',
      icon: '💰',
      preferredTerms: ['risk assessment', 'portfolio diversification', 'market analysis', 'financial planning', 'due diligence'],
      bannedPhrases: ['guaranteed returns', 'risk-free', 'get rich quick', 'sure thing'],
      customInstructions: 'Use data-driven language that emphasizes risk awareness and the importance of professional financial advice.',
      defaultDisclaimer: 'This content is for educational purposes only and does not constitute financial advice. Past performance does not guarantee future results. Consult with a qualified financial advisor.'
    }
  ];

  const handlePresetSelect = (preset) => {
    if (disabled) return;
    
    setSelectedPreset(preset.id);
    
    if (onPresetSelect) {
      onPresetSelect({
        industry: preset.name,
        preferredTerms: preset.preferredTerms,
        bannedPhrases: preset.bannedPhrases,
        customInstructions: preset.customInstructions,
        defaultDisclaimer: preset.defaultDisclaimer,
        enabled: true
      });
    }
  };

  const handleCustomSelect = () => {
    if (disabled) return;
    
    setSelectedPreset('custom');
    
    if (onPresetSelect) {
      onPresetSelect({
        industry: '',
        preferredTerms: [],
        bannedPhrases: [],
        customInstructions: '',
        defaultDisclaimer: '',
        enabled: true
      });
    }
  };

  return (
    <div className={`industry-presets ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Industry Presets
        </h3>
        <p className="text-sm text-gray-600">
          Choose a preset that matches your industry, or start with a custom configuration
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {industryPresets.map((preset) => (
          <div
            key={preset.id}
            className={`
              preset-card p-4 border-2 rounded-lg cursor-pointer transition-all duration-200
              ${selectedPreset === preset.id 
                ? 'border-purple-500 bg-purple-50 shadow-md' 
                : 'border-gray-200 bg-white hover:border-purple-300 hover:shadow-sm'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            onClick={() => handlePresetSelect(preset)}
          >
            <div className="flex items-start gap-3 mb-3">
              <span className="text-2xl">{preset.icon}</span>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 text-sm">
                  {preset.name}
                </h4>
                <p className="text-xs text-gray-600 mt-1">
                  {preset.description}
                </p>
              </div>
              {selectedPreset === preset.id && (
                <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <span className="font-medium text-gray-700">Preferred terms:</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {preset.preferredTerms.slice(0, 3).map((term, index) => (
                    <span 
                      key={index}
                      className="px-2 py-1 bg-green-100 text-green-700 rounded"
                    >
                      {term}
                    </span>
                  ))}
                  {preset.preferredTerms.length > 3 && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded">
                      +{preset.preferredTerms.length - 3}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <span className="font-medium text-gray-700">Avoids:</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {preset.bannedPhrases.slice(0, 2).map((phrase, index) => (
                    <span 
                      key={index}
                      className="px-2 py-1 bg-red-100 text-red-700 rounded"
                    >
                      {phrase}
                    </span>
                  ))}
                  {preset.bannedPhrases.length > 2 && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded">
                      +{preset.bannedPhrases.length - 2}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Custom Option */}
      <div className="border-t border-gray-200 pt-4">
        <div
          className={`
            preset-card p-4 border-2 rounded-lg cursor-pointer transition-all duration-200
            ${selectedPreset === 'custom' 
              ? 'border-purple-500 bg-purple-50 shadow-md' 
              : 'border-gray-200 bg-white hover:border-purple-300 hover:shadow-sm'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          onClick={handleCustomSelect}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎨</span>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 text-sm">
                Custom Configuration
              </h4>
              <p className="text-xs text-gray-600 mt-1">
                Start with a blank slate and configure your own brand voice settings
              </p>
            </div>
            {selectedPreset === 'custom' && (
              <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Help Text */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-700">
          💡 <strong>Tip:</strong> You can always customize any preset after selection. 
          These presets provide a starting point based on industry best practices.
        </p>
      </div>
    </div>
  );
};

export default IndustryPresets;