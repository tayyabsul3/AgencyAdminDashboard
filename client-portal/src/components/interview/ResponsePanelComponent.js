'use client';

import React, { useState, useMemo } from 'react';
import { MdSave, MdCheck, MdWarning, MdSmartToy, MdEdit, MdClose } from 'react-icons/md';
import LoadingSpinner from '../ui/LoadingSpinner';
import styles from './ResponsePanelComponent.module.css';
import { useRenderLogger } from '../../utils/debugRender';

const ResponsePanelComponent = ({
  transcription = {
    current: '',
    final: '',
    interim: '',
    confidence: 0
  },
  suggestions = [],
  saveStatus = 'idle',
  isEditable = true,
  lastSavedAt = null,
  onSave,
  onManualSave,
  onManualSaveAll,
  manualSaveStatus = 'idle',
  manualSaveError = null,
  isListening = false,
  isUserSpeaking = false,
  captionText = '',
  isCaptionVisible = false,
  aiPreviewContext = null,
  isAiPreviewEnabled = false,
  onToggleAiPreview,
  onRetryAiPreview,
  aiPreviewLoading = false,
  aiPreviewData = null,
  aiPreviewError = null,
  aiPreviewDisabledReason = null,
  onSaveAiResponse,
  isAnswerAiEnhanced = false,
  isAnswerManuallyEdited = false,
  isEditingTranscript = false,
  onStartEditingTranscript,
  onSaveEditedTranscript,
  onSaveEditedAiContent,
  onCancelEditingTranscript,
  className = '',
  ...props
}) => {
  useRenderLogger('ResponsePanelComponent', {
    saveStatus,
    isEditable,
    lastSavedAt,
    confidence: transcription?.confidence,
    textLen: (transcription?.final || transcription?.current || '').length,
    aiPreviewEnabled: isAiPreviewEnabled,
    aiPreviewLoading,
    hasPreviewData: Boolean(aiPreviewData),
    toggleDisabled: Boolean(aiPreviewDisabledReason) || typeof onToggleAiPreview !== 'function'
  });

  const displayText = transcription.final || transcription.current || '';
  
  // Extract saved AI preview data from transcription if available
  const savedAiPreviewData = transcription.aiPreviewData || null;
  
  const showCaption = isListening || isUserSpeaking;
  const previewQuestion =
    aiPreviewData?.question || aiPreviewContext?.question || '';
  const showAiToggle = typeof onToggleAiPreview === 'function';
  const shouldShowPreview = showAiToggle && isAiPreviewEnabled;
  
  // Lock interactions during active recording to avoid conflicts/weird effects
  const isLockedByRecording = isListening || isUserSpeaking;
  
  // Separate locking for transcript-related actions when AI preview is active
  const isTranscriptLocked = isLockedByRecording || shouldShowPreview;
  
  const effectiveDisabledReason = useMemo(() => {
    if (isLockedByRecording) {
      return 'Disabled during recording. Stop recording to use AI preview.';
    }
    if (isAnswerAiEnhanced) {
      return 'AI preview is disabled because you are already viewing an AI-enhanced response.';
    }
    return aiPreviewDisabledReason;
  }, [isLockedByRecording, isAnswerAiEnhanced, aiPreviewDisabledReason]);

  const toggleDisabled = !showAiToggle || Boolean(effectiveDisabledReason) || isLockedByRecording;
  const canEditTranscript = displayText.trim().length > 0 && !isTranscriptLocked;

  // Edit transcript state
  const [editText, setEditText] = useState('');

  // Edit AI preview state
  const [isEditingAiPreview, setIsEditingAiPreview] = useState(false);
  const [editAiPreviewText, setEditAiPreviewText] = useState('');

  // Confirmation dialog state
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [confirmationTitle, setConfirmationTitle] = useState('');
  const [onConfirmAction, setOnConfirmAction] = useState(null);

  const switchClassNames = [styles.switchContainer];
  if (toggleDisabled) {
    switchClassNames.push(styles.switchDisabled);
  }

  const getPanelTitle = () => {
    if (shouldShowPreview) {
      return 'AI FAQ Preview';
    }

    if (isAnswerAiEnhanced && isAnswerManuallyEdited) {
      return 'AI Enhanced & Edited Response';
    }

    if (isAnswerAiEnhanced) {
      return 'AI Enhanced Response';
    }

    if (isAnswerManuallyEdited) {
      return 'Edited Response';
    }

    return 'Your Response';
  };

  const panelTitle = getPanelTitle();

  const showConfirmation = (title, message, onConfirm) => {
    setConfirmationTitle(title);
    setConfirmationMessage(message);
    setOnConfirmAction(() => onConfirm);
    setShowConfirmationDialog(true);
  };

  const handleToggleChange = (event) => {
    if (!onToggleAiPreview || toggleDisabled) return;

    const isTurningOn = event.target.checked;

    if (isTurningOn) {
      // Turning AI Preview ON
      showConfirmation(
        'Enable AI Preview',
        'Turning on AI Preview will show AI-generated content instead of your original transcript. You can still edit and save the AI content, or switch back to view your original answer. Continue?',
        () => onToggleAiPreview(true)
      );
    } else {
      // Turning AI Preview OFF
      showConfirmation(
        'Disable AI Preview',
        'Turning off AI Preview will show your original transcript again. Any unsaved changes to the AI preview will be lost. Continue?',
        () => onToggleAiPreview(false)
      );
    }
  };

  const handleStartEditing = () => {
    if (onStartEditingTranscript && canEditTranscript) {
      let editContent = displayText;
      
      // For AI-enhanced content, combine answer and takeaway for editing
      if (isAnswerAiEnhanced && savedAiPreviewData?.takeaway) {
        editContent = [
          displayText,
          `\n\n**Key Takeaway:** ${savedAiPreviewData.takeaway}`
        ].join('');
      }
      
      setEditText(editContent);
      onStartEditingTranscript();
    }
  };

  const handleSaveEdit = () => {
    if (!editText.trim()) return;
    
    if (isAnswerAiEnhanced && onSaveEditedAiContent) {
      // Parse combined content for AI-enhanced answers
      const fullContent = editText.trim();
      let answer_md = fullContent;
      let takeaway = '';

      // Extract takeaway if present
      const takeawayMatch = fullContent.match(/\n\n\*\*Key Takeaway:\*\*\s*(.+)$/s);
      if (takeawayMatch) {
        answer_md = fullContent.replace(/\n\n\*\*Key Takeaway:\*\*\s*.+$/s, '').trim();
        takeaway = takeawayMatch[1].trim();
      }

      onSaveEditedAiContent({ answer_md, takeaway });
    } else if (onSaveEditedTranscript) {
      // Regular transcript editing
      onSaveEditedTranscript(editText.trim());
    }
  };

  const handleCancelEdit = () => {
    if (onCancelEditingTranscript) {
      setEditText('');
      onCancelEditingTranscript();
    }
  };

  const handleStartEditingAiPreview = () => {
    if (aiPreviewData?.answer_md) {
      // Combine the answer and takeaway for editing
      const fullContent = [
        aiPreviewData.answer_md,
        aiPreviewData.takeaway ? `\n\n**Key Takeaway:** ${aiPreviewData.takeaway}` : ''
      ].filter(Boolean).join('');

      setEditAiPreviewText(fullContent);
      setIsEditingAiPreview(true);
    }
  };

  const handleSaveEditedAiPreview = () => {
    if (editAiPreviewText.trim() && onSaveAiResponse) {
      // Show confirmation dialog
      showConfirmation(
        'Save AI Preview',
        '⚠️ **IMPORTANT:** The microphone and AI preview will be permanently disabled for this question.\n\nThis action will replace your original answer with the AI-generated content and cannot be undone.\n\nDo you want to continue?',
        () => {
          // Parse the edited content to separate answer and takeaway
          const fullContent = editAiPreviewText.trim();
          let answer_md = fullContent;
          let takeaway = '';

          // Check if there's a takeaway section
          const takeawayMatch = fullContent.match(/\*\*Key Takeaway:\*\*\s*(.+)$/s);
          if (takeawayMatch) {
            answer_md = fullContent.replace(/\n\n\*\*Key Takeaway:\*\*\s*.+$/s, '').trim();
            takeaway = takeawayMatch[1].trim();
          }

          // Save the edited AI preview as the answer
          const editedPreviewData = {
            ...aiPreviewData,
            answer_md: answer_md,
            takeaway: takeaway
          };

          onSaveAiResponse(editedPreviewData);
          setIsEditingAiPreview(false);
          setEditAiPreviewText('');
        }
      );
    }
  };

  const handleCancelEditingAiPreview = () => {
    setIsEditingAiPreview(false);
    setEditAiPreviewText('');
  };

  const getSaveStatusIcon = () => {
    switch (saveStatus) {
      case 'saving':
        return <MdSave />;
      case 'saved':
        return <MdCheck style={{color: '#10b981', filter: 'drop-shadow(0 1px 2px rgba(16, 185, 129, 0.3))'}} />;
      case 'error':
        return <MdWarning />;
      default:
        return <MdSave />;
    }
  };

  const getSaveStatusText = () => {
    switch (saveStatus) {
      case 'saving':
        return 'Saving...';
      case 'saved':
        return lastSavedAt ? `Saved ${formatTime(lastSavedAt)}` : 'Saved';
      case 'error':
        return 'Save failed';
      default:
        return 'Not saved';
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderPreviewContent = () => {
    if (aiPreviewLoading) {
      return (
        <div className={styles.previewLoading}>
          <LoadingSpinner size="small" text="Generating AI preview..." />
        </div>
      );
    }

    if (aiPreviewError) {
      return (
        <div className={styles.previewError}>
          <div className={styles.previewErrorMessage}>
            <MdWarning aria-hidden="true" />
            <span>{aiPreviewError}</span>
          </div>
          {!isEditingTranscript && onRetryAiPreview && (
            <button
              type="button"
              className={styles.previewRetryButton}
              onClick={onRetryAiPreview}
              disabled={isLockedByRecording}
              title={isLockedByRecording ? 'Disabled during recording' : undefined}
            >
              Retry
            </button>
          )}
        </div>
      );
    }

    if (aiPreviewData) {
      const takeaway = aiPreviewData.takeaway || 'Not specified';
      const answerHtml =
        aiPreviewData.answer_md ||
        '<p>Preview content is unavailable for this answer.</p>';

      return (
        <div className={styles.previewCard}>
          <div className={styles.previewQuestion}>
            {previewQuestion || 'Current Question'}
          </div>
          <div
            className={styles.previewAnswer}
            dangerouslySetInnerHTML={{ __html: answerHtml }}
          />
          <div className={styles.previewMeta}>
            <div className={styles.previewMetaSection}>
              <h4>Key Takeaway</h4>
              <p>{takeaway || 'Not specified'}</p>
            </div>
          </div>
          {!isEditingTranscript && (onSaveAiResponse || aiPreviewData?.answer_md) && (
            <div className={styles.previewActions}>
              {aiPreviewData?.answer_md && (
                <button
                  type="button"
                  className={styles.editAiPreviewButton}
                  onClick={handleStartEditingAiPreview}
                  aria-label="Edit AI preview content"
                  disabled={isLockedByRecording}
                  title={isLockedByRecording ? 'Disabled during recording' : undefined}
                >
                  <MdEdit style={{color: '#6366f1', filter: 'drop-shadow(0 1px 2px rgba(99, 102, 241, 0.3))'}} />
                  <span>Edit Preview</span>
                </button>
              )}
              {onSaveAiResponse && (
                <button
                  type="button"
                  className={styles.saveAiResponseButton}
                  onClick={() => {
                    showConfirmation(
                      'Save AI Response',
                      '⚠️ **IMPORTANT:** The microphone and AI preview will be permanently disabled for this question.\n\nThis action will replace your original answer with the AI-generated content and cannot be undone.\n\nDo you want to continue?',
                      () => onSaveAiResponse(aiPreviewData)
                    );
                  }}
                  aria-label="Save AI-generated response as answer"
                  disabled={isLockedByRecording}
                  title={isLockedByRecording ? 'Disabled during recording' : undefined}
                >
                  <MdSave />
                  <span>Save AI Response</span>
                </button>
              )}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className={styles.previewPlaceholder}>
        <p>No preview has been generated yet.</p>
        {!isEditingTranscript && onRetryAiPreview && (
          <button
            type="button"
            className={styles.previewRetryButton}
            onClick={onRetryAiPreview}
            disabled={isLockedByRecording}
            title={isLockedByRecording ? 'Disabled during recording' : undefined}
          >
            Generate Preview
          </button>
        )}
      </div>
    );
  };

  const renderTranscriptContent = () => (
    <div className={styles.transcriptionArea}>
      <div className={styles.displayMode}>
        <div className={styles.transcriptionContent}>
          {displayText ? (
            <>
              <p className={styles.finalText}>{displayText}</p>
              
              {/* Display takeaway for AI-enhanced answers */}
              {isAnswerAiEnhanced && savedAiPreviewData?.takeaway && (
                <div className={styles.aiTakeawaySection}>
                  <strong>Key Takeaway:</strong> {savedAiPreviewData.takeaway}
                </div>
              )}
              
              {isAnswerAiEnhanced && (
                <div className={styles.aiEnhancedBadge}>
                  <MdSmartToy className={styles.aiIcon} />
                  <span className={styles.aiLabel}>AI Enhanced</span>
                </div>
              )}
              {isAnswerManuallyEdited && !isAnswerAiEnhanced && (
                <div className={styles.manualEditBadge}>
                  <MdEdit className={styles.editIcon} style={{color: '#6366f1', filter: 'drop-shadow(0 1px 2px rgba(99, 102, 241, 0.3))'}} />
                  <span className={styles.editLabel}>Manually Edited</span>
                </div>
              )}
            </>
          ) : (
            <p className={styles.placeholderText}>
              Start speaking to see your transcript here...
            </p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className={`${styles.responsePanel} ${className}`} {...props}>
      {showCaption && (
        <div className={styles.captionBar} role="status" aria-live="polite">
          <span className={styles.captionDot} />
          <span className={styles.captionText}>{captionText || 'Listening...'}</span>
        </div>
      )}

      <div className={styles.transcriptionHeader}>
        <div className={styles.headerLeft}>
          <h3 className={styles.sectionTitle}>{panelTitle}</h3>
          {showAiToggle && effectiveDisabledReason && (
            <p className={styles.toggleHint}>{effectiveDisabledReason}</p>
          )}
        </div>

        <div className={styles.headerRight}>
          {!isEditingTranscript && canEditTranscript && !shouldShowPreview && (
            <button
              className={styles.editTranscriptButton}
              onClick={handleStartEditing}
              disabled={isTranscriptLocked}
              title={isTranscriptLocked ? (shouldShowPreview ? 'Disabled during AI preview. Turn off AI preview to edit transcript.' : effectiveDisabledReason) : "Edit transcript"}
              aria-label="Edit transcript"
            >
              <MdEdit style={{color: '#6366f1', filter: 'drop-shadow(0 1px 2px rgba(99, 102, 241, 0.3))'}} />
            </button>
          )}
          {!isEditingTranscript && showAiToggle && (
            <label
              className={switchClassNames.join(' ')}
              title={effectiveDisabledReason || undefined}
              aria-disabled={toggleDisabled}
            >
              <input
                type="checkbox"
                className={styles.toggleInput}
                checked={isAiPreviewEnabled}
                onChange={handleToggleChange}
                disabled={toggleDisabled}
              />
              <span
                className={`${styles.toggleTrack} ${
                  shouldShowPreview ? styles.active : ''
                }`}
              >
                <span className={styles.toggleThumb} />
              </span>
              <span
                className={`${styles.modeLabel} ${
                  shouldShowPreview ? styles.active : ''
                }`}
              >
                {shouldShowPreview ? 'AI Preview ON' : 'AI Preview OFF'}
              </span>
            </label>
          )}
          <div className={`${styles.saveStatus} ${styles[saveStatus]}`}>
            <span className={styles.saveIcon}>{getSaveStatusIcon()}</span>
            <span className={styles.saveText}>{getSaveStatusText()}</span>
          </div>
        </div>
      </div>

      <div className={styles.panelBody}>
        {shouldShowPreview ? (
          <div className={styles.previewContainer}>{renderPreviewContent()}</div>
        ) : (
          renderTranscriptContent()
        )}
      </div>

      {!isEditingTranscript && (onManualSave || onManualSaveAll) && (
        <div className={styles.manualSaveSection}>
          <div className={styles.manualSaveHeader}>
            <h4 className={styles.manualSaveTitle}>Manual Save</h4>
            {manualSaveStatus !== 'idle' && (
              <div className={`${styles.manualSaveStatus} ${styles[manualSaveStatus]}`}>
                {manualSaveStatus === 'saving' && (
                  <>
                    <div className={styles.savingSpinner}></div>
                    <span>Saving...</span>
                  </>
                )}
                {manualSaveStatus === 'saved' && (
                  <>
                    <span className={styles.savedIcon}><MdCheck style={{color: '#10b981', filter: 'drop-shadow(0 1px 2px rgba(16, 185, 129, 0.3))'}} /></span>
                    <span>Saved successfully</span>
                  </>
                )}
                {manualSaveStatus === 'error' && (
                  <>
                    <span className={styles.errorIcon}><MdWarning /></span>
                    <span>Save failed: {manualSaveError}</span>
                  </>
                )}
              </div>
            )}
          </div>

          <div className={styles.manualSaveButtons}>
            {onManualSave && (
              <button
                className={`${styles.actionButton} ${styles.saveCurrentButton}`}
                onClick={onManualSave}
                disabled={manualSaveStatus === 'saving' || isTranscriptLocked}
                title={isTranscriptLocked ? (shouldShowPreview ? 'Disabled during AI preview. Turn off AI preview to save transcript.' : effectiveDisabledReason) : undefined}
                aria-label="Save current response"
              >
                <span className={styles.actionIcon}><MdSave /></span>
                <span className={styles.actionText}>Save Current</span>
              </button>
            )}

            {onManualSaveAll && (
              <button
                className={`${styles.actionButton} ${styles.saveAllButton}`}
                onClick={onManualSaveAll}
                disabled={manualSaveStatus === 'saving' || isTranscriptLocked}
                title={isTranscriptLocked ? (shouldShowPreview ? 'Disabled during AI preview. Turn off AI preview to save transcript.' : effectiveDisabledReason) : undefined}
                aria-label="Save all responses"
              >
                <span className={styles.actionIcon}><MdSave /></span>
                <span className={styles.actionText}>Save All</span>
              </button>
            )}
          </div>
        </div>
      )}

      <div className={styles.backgroundEffects}>
        <div className={styles.gradientOverlay}></div>
      </div>

      {/* Edit Modal (Transcript or AI Preview) */}
      {(isEditingTranscript || isEditingAiPreview) && (
        <div className={styles.editModalOverlay} onClick={isEditingTranscript ? handleCancelEdit : handleCancelEditingAiPreview}>
          <div className={styles.editModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.editModalHeader}>
              <h3 className={styles.editModalTitle}>
                {isEditingTranscript ? 'Edit Transcript' : 'Edit AI Preview'}
              </h3>
              <button
                className={styles.editModalClose}
                onClick={isEditingTranscript ? handleCancelEdit : handleCancelEditingAiPreview}
                aria-label="Close edit modal"
              >
                <MdClose />
              </button>
            </div>
            <div className={styles.editModalBody}>
              {isEditingTranscript && isAnswerAiEnhanced && (
                <div className={styles.editModalHint}>
                  <p>💡 You can edit both the answer and key takeaway. Use the format:</p>
                  <code>**Key Takeaway:** Your takeaway text</code>
                </div>
              )}
              <textarea
                className={styles.editModalTextarea}
                value={isEditingTranscript ? editText : editAiPreviewText}
                onChange={(e) => isEditingTranscript
                  ? setEditText(e.target.value)
                  : setEditAiPreviewText(e.target.value)
                }
                placeholder={isEditingTranscript ? "Edit your transcript..." : "Edit AI preview content..."}
                autoFocus
                rows={12}
              />
            </div>
            <div className={styles.editModalActions}>
              <button
                className={`${styles.editModalButton} ${styles.cancelButton}`}
                onClick={isEditingTranscript ? handleCancelEdit : handleCancelEditingAiPreview}
                type="button"
              >
                <MdClose />
                <span>Cancel</span>
              </button>
              <button
                className={`${styles.editModalButton} ${styles.saveButton}`}
                onClick={isEditingTranscript ? handleSaveEdit : handleSaveEditedAiPreview}
                disabled={!(isEditingTranscript ? editText.trim() : editAiPreviewText.trim())}
                type="button"
              >
                <MdSave />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmationDialog && (
        <div className={styles.confirmationModalOverlay} onClick={() => setShowConfirmationDialog(false)}>
          <div className={styles.confirmationModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmationModalHeader}>
              <h3 className={styles.confirmationModalTitle}>{confirmationTitle}</h3>
              <button
                className={styles.confirmationModalClose}
                onClick={() => setShowConfirmationDialog(false)}
                aria-label="Close confirmation dialog"
              >
                <MdClose />
              </button>
            </div>
            <div className={styles.confirmationModalBody}>
              <p className={styles.confirmationModalMessage}>{confirmationMessage}</p>
            </div>
            <div className={styles.confirmationModalActions}>
              <button
                className={styles.confirmationModalButton}
                onClick={() => setShowConfirmationDialog(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className={`${styles.confirmationModalButton} ${styles.confirmButton}`}
                onClick={() => {
                  if (onConfirmAction) {
                    onConfirmAction();
                  }
                  setShowConfirmationDialog(false);
                }}
                type="button"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(ResponsePanelComponent, (prevProps, nextProps) => {
  if (prevProps.saveStatus !== nextProps.saveStatus) return false;
  if (prevProps.transcription?.final !== nextProps.transcription?.final) return false;
  if (prevProps.transcription?.current !== nextProps.transcription?.current) return false;
  if (prevProps.transcription?.confidence !== nextProps.transcription?.confidence) return false;
  if (prevProps.lastSavedAt !== nextProps.lastSavedAt) return false;
  if (prevProps.isEditable !== nextProps.isEditable) return false;
  if (prevProps.manualSaveStatus !== nextProps.manualSaveStatus) return false;
  if (prevProps.isAiPreviewEnabled !== nextProps.isAiPreviewEnabled) return false;
  if (prevProps.aiPreviewLoading !== nextProps.aiPreviewLoading) return false;
  if (prevProps.aiPreviewError !== nextProps.aiPreviewError) return false;
  if (prevProps.aiPreviewDisabledReason !== nextProps.aiPreviewDisabledReason) return false;

  const prevPreview =
    prevProps.aiPreviewData && JSON.stringify(prevProps.aiPreviewData);
  const nextPreview =
    nextProps.aiPreviewData && JSON.stringify(nextProps.aiPreviewData);
  if (prevPreview !== nextPreview) return false;

  const prevSignature = prevProps.aiPreviewContext?.answerSignature;
  const nextSignature = nextProps.aiPreviewContext?.answerSignature;
  if (prevSignature !== nextSignature) return false;

  if (prevProps.isAnswerAiEnhanced !== nextProps.isAnswerAiEnhanced) return false;
  if (prevProps.isAnswerManuallyEdited !== nextProps.isAnswerManuallyEdited) return false;
  if (prevProps.isEditingTranscript !== nextProps.isEditingTranscript) return false;

  // Re-render when recording state changes to unlock/lock buttons
  if (prevProps.isListening !== nextProps.isListening) return false;
  if (prevProps.isUserSpeaking !== nextProps.isUserSpeaking) return false;

  return true;
});
