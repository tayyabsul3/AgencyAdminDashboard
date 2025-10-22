'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import styles from '../../../../create/interview/generate/ArticleGeneration.module.css';

/**
 * InsertSectionImagesModal Component
 * 
 * A modal that allows users to select article sections and generate AI images for them.
 * Follows glassmorphic design system with purple gradient background.
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Controls modal visibility
 * @param {Function} props.onClose - Callback when modal is closed
 * @param {Array} props.sections - List of article sections to display
 * @param {Array} props.selectedSections - Currently selected sections
 * @param {Function} props.onSelectionChange - Callback when section selection changes
 * @param {Function} props.onGenerate - Callback when generate button is clicked
 * @param {string} props.customPrompt - Custom prompt override entered by the user
 * @param {Function} props.onCustomPromptChange - Handler when the custom prompt text changes
 * @param {boolean} props.isGenerating - Whether images are currently being generated
 * @param {number} props.progress - Generation progress (0-100)
 */
export default function InsertSectionImagesModal({
  isOpen,
  onClose,
  sections = [],
  selectedSections = [],
  onSelectionChange,
  onGenerate,
  customPrompt = '',
  onCustomPromptChange,
  isGenerating = false,
  progress = 0
}) {
  if (!isOpen || typeof window === 'undefined') {
    return null;
  }

  const handleSectionClick = (section) => {
    const isSelected = selectedSections.some(s => s.id === section.id);
    let newSelection;
    
    if (isSelected) {
      newSelection = selectedSections.filter(s => s.id !== section.id);
    } else {
      newSelection = [...selectedSections, section];
    }
    
    onSelectionChange(newSelection);
  };

  const handleOverlayClick = () => {
    if (!isGenerating) {
      onClose();
    }
  };

  const handleModalClick = (e) => {
    e.stopPropagation();
  };

  return createPortal(
    (
      <div 
        className={styles.modalOverlay} 
        onClick={handleOverlayClick} 
        style={{
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(5px)'
        }}
      >
        <div 
          className={styles.modal} 
          role="dialog" 
          aria-modal="true" 
          onClick={handleModalClick}
          style={{
            maxWidth: '700px',
            maxHeight: '80vh',
            overflow: 'auto',
            background: 'linear-gradient(135deg, rgba(103, 58, 183, 0.95) 0%, rgba(156, 39, 176, 0.95) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
            color: 'white',
            borderRadius: '16px'
          }}
        >
          {/* Custom Scrollbar Styles */}
          <style jsx global>{`
            [role="dialog"]::-webkit-scrollbar {
              width: 10px;
            }
            [role="dialog"]::-webkit-scrollbar-track {
              background: rgba(0, 0, 0, 0.25);
              border-radius: 10px;
              margin: 12px 4px;
            }
            [role="dialog"]::-webkit-scrollbar-thumb {
              background: linear-gradient(180deg, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0.3) 100%);
              border-radius: 10px;
              border: 2px solid rgba(156, 39, 176, 0.4);
              transition: all 0.3s ease;
            }
            [role="dialog"]::-webkit-scrollbar-thumb:hover {
              background: linear-gradient(180deg, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0.45) 100%);
              border-color: rgba(156, 39, 176, 0.6);
            }
          `}</style>

          {/* Header */}
          <div 
            className={styles.modalHeader} 
            style={{
              borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
              paddingBottom: '0.875rem'
            }}
          >
            <h3 
              className={styles.modalTitle} 
              style={{ 
                color: '#fff', 
                fontSize: '1.05rem', 
                fontWeight: '700', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem' 
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              Insert Section Images
            </h3>
            <button 
              className={styles.secondaryButton} 
              onClick={onClose}
              disabled={isGenerating}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#fff',
                borderRadius: '6px',
                padding: '0.5rem 0.75rem',
                transition: 'all 0.2s',
                cursor: isGenerating ? 'not-allowed' : 'pointer',
                opacity: isGenerating ? 0.5 : 1
              }}
              onMouseEnter={(e) => !isGenerating && (e.target.style.background = 'rgba(255, 255, 255, 0.2)')}
              onMouseLeave={(e) => (e.target.style.background = 'rgba(255, 255, 255, 0.1)')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          
          {/* Body */}
          <div className={styles.modalBody}>
            <p style={{ 
              marginBottom: '1.25rem', 
              color: 'rgba(255,255,255,0.9)', 
              fontSize: '0.675rem', 
              lineHeight: '1.5' 
            }}>
              Select sections where you want to insert AI-generated images. Images will be generated and placed after each selected heading.
            </p>

            <div style={{
              marginBottom: '1.25rem',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              borderRadius: '10px',
              padding: '0.85rem',
              boxShadow: '0 2px 10px rgba(0,0,0,0.15)'
            }}>
              <label htmlFor="custom-section-prompt" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.5rem',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.7rem',
                letterSpacing: '0.4px'
              }}>
                <span>Custom prompt (optional)</span>
                <span style={{
                  fontSize: '0.6rem',
                  color: 'rgba(255,255,255,0.6)',
                  fontWeight: 500
                }}>
                  Leave empty to auto-generate from section content
                </span>
              </label>
              <textarea
                id="custom-section-prompt"
                value={customPrompt}
                onChange={(event) => onCustomPromptChange?.(event.target.value)}
                placeholder="Describe the visual you want. You can reference the section context or provide entirely custom instructions."
                style={{
                  width: '100%',
                  minHeight: '90px',
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  padding: '0.65rem 0.75rem',
                  color: '#fff',
                  fontSize: '0.6875rem',
                  lineHeight: '1.6',
                  resize: 'vertical',
                  outline: 'none',
                  transition: 'border 0.2s ease, box-shadow 0.2s ease'
                }}
                onFocus={(event) => {
                  event.target.style.borderColor = 'rgba(255, 255, 255, 0.35)';
                  event.target.style.boxShadow = '0 0 0 2px rgba(255, 255, 255, 0.08)';
                }}
                onBlur={(event) => {
                  event.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                  event.target.style.boxShadow = 'none';
                }}
                disabled={isGenerating}
              />
              <div style={{
                marginTop: '0.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                color: 'rgba(255,255,255,0.6)',
                fontSize: '0.6rem'
              }}>
                <span>
                  Tip: Reference key concepts from the section for best results.
                </span>
                <span>{customPrompt.length} chars</span>
              </div>
            </div>

            {isGenerating ? (
              // Loading State
              <div style={{ textAlign: 'center', padding: '1.5rem' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  border: '3px solid rgba(255, 255, 255, 0.2)',
                  borderTop: '3px solid white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 0.875rem'
                }} />
                <p style={{ 
                  color: '#fff', 
                  marginBottom: '0.375rem', 
                  fontWeight: '600', 
                  fontSize: '0.75rem' 
                }}>
                  Generating and inserting images...
                </p>
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.65625rem' }}>
                  Progress: {Math.round(progress)}%
                </p>
              </div>
            ) : (
              <>
                {sections.length === 0 ? (
                  // Empty State
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '1.5rem', 
                    color: 'rgba(255,255,255,0.7)' 
                  }}>
                    <svg 
                      width="36" 
                      height="36" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      style={{ margin: '0 auto 0.75rem', opacity: 0.5 }}
                    >
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="8" x2="12" y2="12"/>
                      <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <p style={{ fontSize: '0.675rem' }}>No sections found in the article.</p>
                  </div>
                ) : (
                  // Sections List
                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {sections.map((section) => {
                      const isSelected = selectedSections.some(s => s.id === section.id);
                      
                      return (
                        <div 
                          key={section.id}
                          onClick={() => handleSectionClick(section)}
                          style={{
                            padding: '0.75rem',
                            background: isSelected 
                              ? 'rgba(255, 255, 255, 0.18)' 
                              : 'rgba(255, 255, 255, 0.06)',
                            border: `1.5px solid ${isSelected 
                              ? 'rgba(255, 255, 255, 0.5)' 
                              : 'rgba(255, 255, 255, 0.12)'}`,
                            borderRadius: '10px',
                            cursor: 'pointer',
                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.625rem',
                            boxShadow: isSelected 
                              ? '0 2px 8px rgba(0, 0, 0, 0.15)' 
                              : 'none'
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                            }
                          }}
                        >
                          {/* Checkbox */}
                          <div style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '5px',
                            border: '2px solid rgba(255, 255, 255, 0.5)',
                            background: isSelected ? '#fff' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            transition: 'all 0.2s'
                          }}>
                            {isSelected && (
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#673ab7" strokeWidth="3.5">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                            )}
                          </div>

                          {/* Section Info */}
                          <div style={{ flex: 1 }}>
                            <div style={{ 
                              fontWeight: '600', 
                              marginBottom: '0.188rem',
                              color: '#fff',
                              fontSize: '0.75rem',
                              lineHeight: '1.3'
                            }}>
                              {section.title}
                            </div>
                            <div style={{ 
                              fontSize: '0.5625rem', 
                              color: 'rgba(255,255,255,0.6)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.375rem',
                              fontWeight: '500',
                              letterSpacing: '0.3px'
                            }}>
                              <span>{section.level}</span>
                              <span>•</span>
                              <span>{section.type.toUpperCase()}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* Footer Actions */}
          {!isGenerating && sections.length > 0 && (
            <div 
              className={styles.modalActions} 
              style={{
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                paddingTop: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '1rem'
              }}
            >
              <button 
                className={styles.secondaryButton} 
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: '1.5px solid rgba(255, 255, 255, 0.3)',
                  color: '#fff',
                  padding: '0.625rem 1.25rem',
                  borderRadius: '8px',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  fontWeight: '600',
                  fontSize: '0.75rem'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                }}
              >
                Cancel
              </button>
              <button 
                className={styles.primaryButton} 
                onClick={onGenerate}
                disabled={selectedSections.length === 0}
                style={{
                  background: selectedSections.length === 0 
                    ? 'rgba(255, 255, 255, 0.15)' 
                    : 'linear-gradient(135deg, #fff 0%, rgba(255, 255, 255, 0.95) 100%)',
                  color: selectedSections.length === 0 
                    ? 'rgba(255, 255, 255, 0.4)' 
                    : '#673ab7',
                  border: 'none',
                  padding: '0.625rem 1.5rem',
                  borderRadius: '8px',
                  fontWeight: '700',
                  fontSize: '0.75rem',
                  cursor: selectedSections.length === 0 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: selectedSections.length === 0 
                    ? 'none' 
                    : '0 2px 8px rgba(255, 255, 255, 0.2)'
                }}
                onMouseEnter={(e) => {
                  if (selectedSections.length > 0) {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 16px rgba(255, 255, 255, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = selectedSections.length === 0 
                    ? 'none' 
                    : '0 2px 8px rgba(255, 255, 255, 0.2)';
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                Generate {selectedSections.length > 0 && `(${selectedSections.length})`} Image{selectedSections.length !== 1 ? 's' : ''}
              </button>
            </div>
          )}
        </div>
      </div>
    ),
    document.body
  );
}
