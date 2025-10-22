'use client';

import { useState, useEffect, useMemo } from 'react';
import { generateBrandVoicePreview, formatBrandVoiceForDisplay } from '../../utils/branding';

/**
 * Brand Voice Preview Component
 * Shows real-time preview of how brand voice settings will affect content generation
 */
const BrandVoicePreview = ({ 
  brandVoice, 
  className = '', 
  showTitle = true,
  compact = false 
}) => {
  const [previewText, setPreviewText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Generate preview information
  const previewInfo = useMemo(() => {
    return generateBrandVoicePreview(brandVoice);
  }, [brandVoice]);

  // Format brand voice for display
  const displayInfo = useMemo(() => {
    return formatBrandVoiceForDisplay(brandVoice);
  }, [brandVoice]);

  // Generate sample preview text
  useEffect(() => {
    if (!brandVoice?.enabled) {
      setPreviewText('Brand voice is disabled. Content will use standard AI generation without customizations.');
      return;
    }

    setIsGenerating(true);
    
    // Simulate generating preview text based on brand voice settings
    const generatePreview = () => {
      let preview = 'Sample content with your brand voice applied:\n\n';
      
      if (brandVoice.industry) {
        preview += `"This ${brandVoice.industry.toLowerCase()} approach focuses on `;
      } else {
        preview += '"This approach focuses on ';
      }

      if (brandVoice.preferredTerms?.length > 0) {
        const terms = brandVoice.preferredTerms.slice(0, 2);
        preview += `${terms.join(' and ')}, ensuring `;
      } else {
        preview += 'proven strategies, ensuring ';
      }

      preview += 'sustainable results for your goals."';

      if (brandVoice.defaultDisclaimer) {
        preview += '\n\n[Custom disclaimer will be automatically added]';
      }

      return preview;
    };

    // Simulate async generation
    setTimeout(() => {
      setPreviewText(generatePreview());
      setIsGenerating(false);
    }, 800);

  }, [brandVoice]);

  if (compact) {
    return (
      <div className={`brand-voice-preview-compact ${className}`}>
        <div className="flex items-center gap-2 text-sm">
          <div className={`w-2 h-2 rounded-full ${previewInfo.enabled ? 'bg-purple-500' : 'bg-gray-400'}`} />
          <span className="font-medium text-gray-700">
            {displayInfo.status}
          </span>
          {displayInfo.summary && (
            <span className="text-gray-500">
              • {displayInfo.summary}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`brand-voice-preview ${className}`}>
      {showTitle && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Brand Voice Preview
          </h3>
          <p className="text-sm text-gray-600">
            See how your brand voice settings will influence content generation
          </p>
        </div>
      )}

      {/* Status Section */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-3 h-3 rounded-full ${previewInfo.enabled ? 'bg-purple-500' : 'bg-gray-400'}`} />
          <span className="font-semibold text-gray-900">
            Status: {displayInfo.status}
          </span>
        </div>
        
        <p className="text-sm text-gray-600 mb-3">
          {previewInfo.message}
        </p>

        {previewInfo.features && previewInfo.features.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-700 uppercase tracking-wide">
              Active Features:
            </p>
            <ul className="text-sm text-gray-600 space-y-1">
              {previewInfo.features.map((feature, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Preview Content Section */}
      {previewInfo.enabled && (
        <div className="mb-6">
          <h4 className="text-md font-medium text-gray-900 mb-3">
            Content Preview
          </h4>
          
          <div className="p-4 bg-white border border-purple-200 rounded-lg">
            {isGenerating ? (
              <div className="flex items-center gap-3 text-gray-500">
                <div className="animate-spin w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full" />
                <span className="text-sm">Generating preview...</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-sm text-gray-700 whitespace-pre-line font-medium">
                  {previewText}
                </div>
                
                {brandVoice.bannedPhrases?.length > 0 && (
                  <div className="pt-3 border-t border-gray-200">
                    <p className="text-xs text-red-600 font-medium mb-1">
                      ⚠️ Will avoid these phrases:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {brandVoice.bannedPhrases.slice(0, 3).map((phrase, index) => (
                        <span 
                          key={index}
                          className="px-2 py-1 bg-red-50 text-red-700 text-xs rounded border border-red-200"
                        >
                          "{phrase}"
                        </span>
                      ))}
                      {brandVoice.bannedPhrases.length > 3 && (
                        <span className="px-2 py-1 bg-gray-50 text-gray-500 text-xs rounded border">
                          +{brandVoice.bannedPhrases.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Configuration Summary */}
      {previewInfo.enabled && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <h4 className="text-sm font-medium text-purple-900 mb-2">
            Configuration Summary
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {brandVoice.preferredTerms?.length > 0 && (
              <div>
                <span className="font-medium text-purple-800">Preferred Terms:</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {brandVoice.preferredTerms.slice(0, 4).map((term, index) => (
                    <span 
                      key={index}
                      className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded"
                    >
                      {term}
                    </span>
                  ))}
                  {brandVoice.preferredTerms.length > 4 && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                      +{brandVoice.preferredTerms.length - 4}
                    </span>
                  )}
                </div>
              </div>
            )}

            {brandVoice.industry && (
              <div>
                <span className="font-medium text-purple-800">Industry:</span>
                <div className="mt-1">
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">
                    {brandVoice.industry}
                  </span>
                </div>
              </div>
            )}

            {brandVoice.defaultDisclaimer && (
              <div className="md:col-span-2">
                <span className="font-medium text-purple-800">Custom Disclaimer:</span>
                <div className="mt-1 p-2 bg-white border border-purple-200 rounded text-xs text-gray-700">
                  {brandVoice.defaultDisclaimer.length > 100 
                    ? `${brandVoice.defaultDisclaimer.substring(0, 100)}...`
                    : brandVoice.defaultDisclaimer
                  }
                </div>
              </div>
            )}

            {brandVoice.customInstructions && (
              <div className="md:col-span-2">
                <span className="font-medium text-purple-800">Custom Instructions:</span>
                <div className="mt-1 p-2 bg-white border border-purple-200 rounded text-xs text-gray-700">
                  {brandVoice.customInstructions.length > 100 
                    ? `${brandVoice.customInstructions.substring(0, 100)}...`
                    : brandVoice.customInstructions
                  }
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-700">
          💡 <strong>Tip:</strong> Brand voice settings are applied automatically to all content generation. 
          Changes take effect immediately for new content.
        </p>
      </div>
    </div>
  );
};

export default BrandVoicePreview;