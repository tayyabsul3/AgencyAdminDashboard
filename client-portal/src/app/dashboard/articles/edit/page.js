'use client';

import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuthGuard } from '../../../../hooks/useAuthGuard';
import { getUnifiedArticleContent } from '../../../../services/articleService';
import { saveArticleVersion, getCurrentArticleContent } from '../../../../services/articleVersionService';
import { convertJsonToGutenbergHtml, getDefaultSectionOrder } from '../../../../utils/articleConverter';
import styles from '../../create/interview/generate/ArticleGeneration.module.css';

function ArticleEditContent() {
  const { user, loading } = useAuthGuard({ redirectTo: '/login', requireAuth: true });
  const router = useRouter();
  const searchParams = useSearchParams();
  const editorRef = useRef(null);
  
  const id = searchParams.get('id');
  const source = searchParams.get('source') || 'legacy';
  const keywordId = searchParams.get('keywordId') || undefined;

  const [originalHtml, setOriginalHtml] = useState('');
  const [title, setTitle] = useState('Article');
  const [editableTitle, setEditableTitle] = useState(''); // Editable title state
  const [error, setError] = useState(null);
  const [info, setInfo] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  const [versionNumber, setVersionNumber] = useState(1);

  // Link editing state
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkData, setLinkData] = useState({
    url: '',
    text: '',
    title: '',
    openInNewTab: true
  });
  const [selectedRange, setSelectedRange] = useState(null);
  const [editingExistingLink, setEditingExistingLink] = useState(false);

  // Context menu state
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuType, setContextMenuType] = useState('default'); // 'default', 'link', 'selection'
  const [contextMenuTarget, setContextMenuTarget] = useState(null); // Store the clicked element

  // Track changes in the editor
  const handleContentChange = useCallback(() => {
    if (editorRef.current) {
      const currentHtml = editorRef.current.innerHTML;
      const hasContentChanged = currentHtml !== originalHtml;
      const hasTitleChanged = editableTitle !== title;
      const newHasChanges = hasContentChanged || hasTitleChanged;
      
      // Only update state if change status actually changed
      if (newHasChanges !== hasChanges) {
        setHasChanges(newHasChanges);
      }
    }
  }, [originalHtml, editableTitle, title, hasChanges]);
  
  // Track title changes
  const handleTitleChange = (e) => {
    setEditableTitle(e.target.value);
    setHasChanges(e.target.value !== title || (editorRef.current && editorRef.current.innerHTML !== originalHtml));
  };

  // Save the edited content
  const handleSave = useCallback(async () => {
    try {
      setIsSaving(true);
      setError('');
      setInfo('Saving changes...');
      
      if (!user || !editorRef.current) {
        throw new Error('Unable to save: Not authenticated or editor not ready');
      }

      const currentHtml = editorRef.current.innerHTML;
      
      // Extract the edited meta description from the HTML content
      const extractMetaDescription = (html) => {
        try {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = html;
          const metaSection = tempDiv.querySelector('.meta-description-section p');
          return metaSection ? metaSection.textContent.trim() : null;
        } catch (error) {
          console.warn('Failed to extract meta description:', error);
          return null;
        }
      };
      
      const editedMetaDescription = extractMetaDescription(currentHtml);
      
      console.log('Saving article with:', {
        userId: user.uid,
        articleId: id,
        source,
        keywordId,
        htmlLength: currentHtml.length,
        oldTitle: title,
        newTitle: editableTitle,
        editedMetaDescription: editedMetaDescription
      });
      
      // Prepare the update data - only send what's needed to avoid nested array issues
      const updateData = {
        htmlContent: currentHtml,
        title: editableTitle, // Include the updated title
        lastModified: new Date().toISOString(),
        modifiedBy: user.uid
      };
      
      // Include the edited meta description if found
      if (editedMetaDescription) {
        updateData.meta_description = editedMetaDescription;
      }

      // Save using version service
      const result = await saveArticleVersion(user.uid, id, updateData, source, keywordId);
      
      console.log('Save successful! Version:', result.versionNumber);
      
      // Update state
      setOriginalHtml(currentHtml);
      setTitle(editableTitle); // Update the original title after save
      setHasChanges(false);
      setLastSaved(new Date());
      setVersionNumber(result.versionNumber);
      setInfo(`Changes saved successfully! (Version ${result.versionNumber})`);
      
      // Clear success message after 3 seconds
      setTimeout(() => setInfo(''), 3000);
      
    } catch (error) {
      console.error('Save error:', error);
      setError(`Failed to save: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  }, [user, id, source, keywordId, originalHtml, editableTitle]); // Include editableTitle in dependencies

  // Link editing functions
  const saveSelection = () => {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      return selection.getRangeAt(0).cloneRange();
    }
    return null;
  };

  const restoreSelection = (range) => {
    if (range) {
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
  };

  const handleAddLink = () => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (selectedText) {
      // User has selected text
      setSelectedRange(saveSelection());
      setLinkData({
        url: '',
        text: selectedText,
        title: '',
        openInNewTab: true
      });
      setEditingExistingLink(false);
      setShowLinkModal(true);
    } else {
      // No selection, prompt for both text and URL
      setSelectedRange(saveSelection());
      setLinkData({
        url: '',
        text: '',
        title: '',
        openInNewTab: true
      });
      setEditingExistingLink(false);
      setShowLinkModal(true);
    }
  };

  const handleEditLink = (linkElement) => {
    // Get link data from existing link
    const url = linkElement.href || '';
    const text = linkElement.textContent || '';
    const title = linkElement.title || '';
    const openInNewTab = linkElement.target === '_blank';

    // Select the link element
    const range = document.createRange();
    range.selectNode(linkElement);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    setSelectedRange(saveSelection());
    setLinkData({
      url,
      text,
      title,
      openInNewTab
    });
    setEditingExistingLink(true);
    setShowLinkModal(true);
  };

  const handleRemoveLink = (linkElement) => {
    // Replace link with just its text content
    const textNode = document.createTextNode(linkElement.textContent);
    linkElement.parentNode.replaceChild(textNode, linkElement);
    handleContentChange();
  };

  const handleLinkSubmit = () => {
    if (!linkData.url.trim()) {
      alert('Please enter a URL');
      return;
    }

    if (!linkData.text.trim()) {
      alert('Please enter link text');
      return;
    }

    // Validate URL format
    let url = linkData.url.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('mailto:') && !url.startsWith('tel:')) {
      url = 'https://' + url;
    }

    if (selectedRange) {
      restoreSelection(selectedRange);
      
      // Create the link element
      const linkElement = document.createElement('a');
      linkElement.href = url;
      linkElement.textContent = linkData.text.trim();
      
      if (linkData.title.trim()) {
        linkElement.title = linkData.title.trim();
      }
      
      if (linkData.openInNewTab) {
        linkElement.target = '_blank';
        linkElement.rel = 'noopener noreferrer';
      }

      try {
        // Insert the link
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          range.insertNode(linkElement);
          
          // Move cursor after the link
          range.setStartAfter(linkElement);
          range.setEndAfter(linkElement);
          selection.removeAllRanges();
          selection.addRange(range);
        }
        
        handleContentChange();
      } catch (error) {
        console.error('Error inserting link:', error);
        alert('Failed to insert link. Please try again.');
      }
    }

    // Close modal and reset state
    setShowLinkModal(false);
    setLinkData({ url: '', text: '', title: '', openInNewTab: true });
    setSelectedRange(null);
    setEditingExistingLink(false);
  };

  const handleLinkCancel = () => {
    setShowLinkModal(false);
    setLinkData({ url: '', text: '', title: '', openInNewTab: true });
    setSelectedRange(null);
    setEditingExistingLink(false);
  };

  // Handle clicks on links in the editor
  const handleEditorClick = (e) => {
    // For links, we now use the right-click context menu instead
    // This prevents conflicts and provides a consistent UX
    if (e.target.tagName === 'A') {
      // Just prevent default link navigation
      // Users can right-click for link options
      e.preventDefault();
    }
  };

  // Context menu functions
  const handleContextMenu = (e) => {
    e.preventDefault();
    
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    const clickedElement = e.target;
    
    // Determine context menu type
    let menuType = 'default';
    if (clickedElement.tagName === 'A') {
      menuType = 'link';
    } else if (selectedText) {
      menuType = 'selection';
    }
    
    // Calculate position to keep menu on screen
    const menuWidth = 200;
    const menuHeight = menuType === 'selection' ? 300 : menuType === 'link' ? 200 : 400;
    
    let x = e.clientX;
    let y = e.clientY;
    
    // Adjust if menu would go off right edge
    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }
    
    // Adjust if menu would go off bottom edge
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10;
    }
    
    // Ensure minimum distance from edges
    x = Math.max(10, x);
    y = Math.max(10, y);
    
    setContextMenuType(menuType);
    setContextMenuPosition({ x, y });
    setContextMenuTarget(clickedElement); // Store the clicked element
    setShowContextMenu(true);
    
    // Save selection for later use
    if (selection.rangeCount > 0) {
      setSelectedRange(selection.getRangeAt(0).cloneRange());
    }
  };

  const closeContextMenu = () => {
    setShowContextMenu(false);
    setContextMenuTarget(null);
  };

  // Formatting functions
  const formatText = (command, value = null) => {
    document.execCommand(command, false, value);
    handleContentChange();
    closeContextMenu();
  };

  const insertHeading = (level) => {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const selectedText = selection.toString() || 'Heading';
      
      const heading = document.createElement(`h${level}`);
      heading.textContent = selectedText;
      
      range.deleteContents();
      range.insertNode(heading);
      
      // Move cursor after heading
      range.setStartAfter(heading);
      range.setEndAfter(heading);
      selection.removeAllRanges();
      selection.addRange(range);
      
      handleContentChange();
    }
    closeContextMenu();
  };

  const insertList = (type) => {
    const listTag = type === 'ordered' ? 'ol' : 'ul';
    const selection = window.getSelection();
    
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const selectedText = selection.toString() || 'List item';
      
      const list = document.createElement(listTag);
      const listItem = document.createElement('li');
      listItem.textContent = selectedText;
      list.appendChild(listItem);
      
      range.deleteContents();
      range.insertNode(list);
      
      // Move cursor to end of list item
      range.setStart(listItem, listItem.childNodes.length);
      range.setEnd(listItem, listItem.childNodes.length);
      selection.removeAllRanges();
      selection.addRange(range);
      
      handleContentChange();
    }
    closeContextMenu();
  };

  const insertBlockquote = () => {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const selectedText = selection.toString() || 'Quote text';
      
      const blockquote = document.createElement('blockquote');
      blockquote.textContent = selectedText;
      
      range.deleteContents();
      range.insertNode(blockquote);
      
      // Move cursor after blockquote
      range.setStartAfter(blockquote);
      range.setEndAfter(blockquote);
      selection.removeAllRanges();
      selection.addRange(range);
      
      handleContentChange();
    }
    closeContextMenu();
  };

  const duplicateSelection = () => {
    const selection = window.getSelection();
    if (selection.rangeCount > 0 && selection.toString()) {
      const selectedText = selection.toString();
      const range = selection.getRangeAt(0);
      
      // Move cursor to end of selection
      range.collapse(false);
      
      // Insert duplicated text
      const textNode = document.createTextNode(' ' + selectedText);
      range.insertNode(textNode);
      
      // Move cursor after inserted text
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
      
      handleContentChange();
    }
    closeContextMenu();
  };

  const deleteSelection = () => {
    const selection = window.getSelection();
    if (selection.rangeCount > 0 && selection.toString()) {
      selection.deleteFromDocument();
      handleContentChange();
    }
    closeContextMenu();
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Save shortcut (Ctrl+S)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (hasChanges && !isSaving) {
          handleSave();
        }
      }
      
      // Link shortcut (Ctrl+K)
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        handleAddLink();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [hasChanges, isSaving, handleSave]);

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showContextMenu) {
        setShowContextMenu(false);
        setContextMenuTarget(null);
      }
    };

    if (showContextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showContextMenu]);

  // Load article content - ALWAYS load the current saved version if it exists
  useEffect(() => {
    if (!user || !id) return;
    let mounted = true;
    
    (async () => {
      try {
        // First, try to get the current saved version
        const currentVersion = await getCurrentArticleContent(user.uid, id, source, keywordId);
        
        let htmlString = '';
        let computedTitle = 'Article';
        
        if (currentVersion && currentVersion.htmlContent) {
          // Use the saved HTML content from the latest version
          console.log('Loading saved version:', currentVersion.versionNumber);
          htmlString = currentVersion.htmlContent;
          setVersionNumber(currentVersion.versionNumber || 1);
          
          // Use saved title if available, otherwise get from original data
          if (currentVersion.title) {
            computedTitle = currentVersion.title;
          } else {
            // Fallback to original data if no saved title
            const json = await getUnifiedArticleContent(user.uid, { id, source, keywordId });
            if (json) {
              const base = (json && json.data && typeof json.data === 'object' && Object.keys(json.data).length)
                ? json.data
                : json;
              
              computedTitle = base.title ||
                json.googleDocs?.documentTitle ||
                base.keyword ||
                base._keyword ||
                'Article';
              

            }
          }
        } else {
          // No saved version, load original and convert
          const json = await getUnifiedArticleContent(user.uid, { id, source, keywordId });
          if (!json) throw new Error('Article not found');
          
          const base = (json && json.data && typeof json.data === 'object' && Object.keys(json.data).length)
            ? json.data
            : json;

          computedTitle = base.title ||
            json.googleDocs?.documentTitle ||
            base.keyword ||
            base._keyword ||
            'Article';

          const hasConvertible = Boolean(
            (Array.isArray(base.key_takeaways) && base.key_takeaways.length) ||
            base.intro_md ||
            (Array.isArray(base.tables) && base.tables.length) ||
            (base.checklists && (Array.isArray(base.checklists.launch) || Array.isArray(base.checklists.post_contest))) ||
            (Array.isArray(base.toc) && base.toc.length) ||
            (Array.isArray(base.faqs) && base.faqs.length)
          );
          
          console.log('No saved version, converting from JSON');
          
          // Load custom section order from localStorage
          let sectionOrder = getDefaultSectionOrder();
          try {
            const saved = localStorage.getItem('queryfuel_section_order');
            if (saved) {
              sectionOrder = JSON.parse(saved);
            }
          } catch (e) {
            console.warn('Failed to load section order:', e);
          }
          
          htmlString = hasConvertible
            ? convertJsonToGutenbergHtml(base, sectionOrder)
            : '<div class="article-container"><p>Start writing your article here...</p></div>';
            

        }
        
        if (mounted) {
          setTitle(computedTitle);
          setEditableTitle(computedTitle); // Initialize editable title
          setOriginalHtml(htmlString);
          if (!htmlString || htmlString === '<div class="article-container"><p>Start writing your article here...</p></div>') {
            setInfo('This article has no content yet. Start editing!');
          }
        }
      } catch (e) {
        if (mounted) setError(e?.message || 'Failed to load article');
      }
    })();
    
    return () => { mounted = false; };
  }, [user, id, source, keywordId]);

  // Set content in editor once when originalHtml loads
  useEffect(() => {
    if (editorRef.current && originalHtml) {
      editorRef.current.innerHTML = originalHtml;
    }
  }, [originalHtml]);

  // Apply basic editor styles to match view page
  const editorStyles = `
    /* Override any centering from parent styles */
    .article-container,
    .article-container * {
      text-align: left !important;
    }
    
    .article-container {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.6;
      color: #333;
      width: 100%;
      max-width: none;
    }
    
    .article-editor {
      min-height: 500px;
      outline: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.6;
      color: #333;
      width: 100%;
      max-width: none;
      text-align: left;
    }
    
    .article-editor:focus {
      outline: 2px solid rgba(99, 102, 241, 0.2);
      outline-offset: 2px;
    }
    
    .article-editor h1, .article-editor h2, .article-editor h3, 
    .article-editor h4, .article-editor h5, .article-editor h6 {
      margin-top: 1.5rem;
      margin-bottom: 0.5rem;
      font-weight: 600;
      text-align: left;
    }
    
    .article-editor h1 { font-size: 2rem; }
    .article-editor h2 { font-size: 1.75rem; }
    .article-editor h3 { font-size: 1.5rem; }
    .article-editor h4 { font-size: 1.25rem; }
    .article-editor h5 { font-size: 1.125rem; }
    .article-editor h6 { font-size: 1rem; }
    
    .article-editor p {
      margin-bottom: 1rem;
      text-align: left;
    }
    
    .article-editor ul, .article-editor ol {
      margin-bottom: 1rem;
      padding-left: 2rem;
      text-align: left;
    }
    
    .article-editor li {
      margin-bottom: 0.5rem;
      text-align: left;
    }
    
    .article-editor blockquote {
      margin: 1rem 0;
      padding: 1rem;
      background: #f7f7f7;
      border-left: 4px solid #6366f1;
    }
    
    .article-editor table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
      text-align: left;
    }
    
    .article-editor th, .article-editor td {
      padding: 0.75rem;
      border: 1px solid #e5e7eb;
      text-align: left;
    }
    
    .article-editor th {
      background: #f9fafb;
      font-weight: 600;
    }
    
    .article-editor img {
      max-width: 100%;
      height: auto;
      margin: 1rem 0;
    }
    
    .article-editor a {
      color: #6366f1;
      text-decoration: underline;
      cursor: pointer;
      transition: all 0.2s;
      position: relative;
    }
    
    .article-editor a:hover {
      color: #4f46e5;
      background-color: rgba(99, 102, 241, 0.1);
      padding: 2px 4px;
      margin: -2px -4px;
      border-radius: 3px;
    }
    
    .article-editor a:focus {
      outline: 2px solid rgba(99, 102, 241, 0.3);
      outline-offset: 2px;
    }
    
    .article-editor pre {
      background: #1f2937;
      color: #f9fafb;
      padding: 1rem;
      border-radius: 6px;
      overflow-x: auto;
      margin: 1rem 0;
    }
    
    .article-editor code {
      background: #f3f4f6;
      padding: 0.2rem 0.4rem;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
    }
    
    .article-editor pre code {
      background: transparent;
      padding: 0;
    }
  `;

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>;
  if (!user) return null;
  
  if (error && !originalHtml) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h3>Failed to load</h3>
        <p>{error}</p>
        <button className={styles.secondaryButton} onClick={() => router.back()}>Go Back</button>
      </div>
    );
  }

  return (
    <div className={styles.generationPage} style={{ padding: 0 }}>
      <style dangerouslySetInnerHTML={{ __html: editorStyles }} />
      
      <div  style={{ width: '100%', margin: 0, padding: 0 }}>
        <div className={styles.generationCard} style={{ width: '100%', maxWidth: 'none', borderRadius: 0, margin: 0 }}>
          
          {/* Editor Header with Save Button - matching view page style */}
          <div id="top" className={styles.previewHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
              <span style={{ fontSize: '1.5rem' }}>✏️</span>
              <input
                type="text"
                value={editableTitle}
                onChange={handleTitleChange}
                placeholder="Enter article title..."
                style={{
                  flex: 1,
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(0, 212, 255, 0.2)',
                  borderRadius: '6px',
                  padding: '0.5rem 1rem',
                  fontSize: '1.25rem',
                  fontWeight: '700',
                  color: '#fff',
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#00D4FF';
                  e.target.style.background = 'rgba(0, 0, 0, 0.5)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(0, 212, 255, 0.2)';
                  e.target.style.background = 'rgba(0, 0, 0, 0.3)';
                }}
              />
            </div>
            <div className={styles.previewActions} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                {/* Status indicator with version info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)' }}>
                    Version {versionNumber}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)' }}>
                    {hasChanges && !isSaving && (
                      <span style={{ color: '#fbbf24' }}>● Unsaved changes</span>
                    )}
                    {isSaving && (
                      <span style={{ color: '#60a5fa' }}>● Saving...</span>
                    )}
                    {!hasChanges && lastSaved && (
                      <span style={{ color: '#00D4FF', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Saved
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Save Button */}
                <button
                  className={styles.primaryButton}
                  onClick={handleSave}
                  disabled={!hasChanges || isSaving}
                  style={{
                    padding: '0.75rem 1.5rem',
                    fontSize: '0.875rem',
                    background: hasChanges && !isSaving
                      ? 'linear-gradient(135deg, #00D4FF 0%, #0095CC 100%)'
                      : 'rgba(0, 212, 255, 0.1)',
                    border: hasChanges && !isSaving
                      ? 'none'
                      : '1px solid rgba(0, 212, 255, 0.2)',
                    color: hasChanges && !isSaving ? '#0D1117' : '#00D4FF',
                    fontWeight: '600',
                    borderRadius: '6px',
                    opacity: !hasChanges || isSaving ? 0.6 : 1,
                    cursor: !hasChanges || isSaving ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s'
                  }}
                  title="Save changes (Ctrl+S)"
                  onMouseEnter={(e) => (hasChanges && !isSaving) && (e.target.style.transform = 'translateY(-2px)')}
                  onMouseLeave={(e) => (e.target.style.transform = 'translateY(0)')}
                >
                  {isSaving ? (
                    <div style={{
                      width: '14px',
                      height: '14px',
                      border: '2px solid rgba(13, 17, 23, 0.3)',
                      borderTop: '2px solid #0D1117',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                      <polyline points="17 21 17 13 7 13 7 21"/>
                      <polyline points="7 3 7 8 15 8"/>
                    </svg>
                  )}
                  <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                </button>
                
                {/* Back Button */}
                <button
                  className={styles.secondaryButton}
                  onClick={() => {
                    if (hasChanges) {
                      const confirmLeave = window.confirm('You have unsaved changes. Are you sure you want to leave?');
                      if (confirmLeave) {
                        router.push(`/dashboard/articles/view?id=${id}&source=${source}${keywordId ? `&keywordId=${keywordId}` : ''}`);
                      }
                    } else {
                      router.push(`/dashboard/articles/view?id=${id}&source=${source}${keywordId ? `&keywordId=${keywordId}` : ''}`);
                    }
                  }}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(0, 212, 255, 0.3)',
                    color: '#00D4FF',
                    padding: '0.75rem 1.5rem',
                    fontSize: '0.875rem',
                    borderRadius: '6px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => (e.target.style.background = 'rgba(0, 212, 255, 0.1)')}
                  onMouseLeave={(e) => (e.target.style.background = 'transparent')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                  Back to View
                </button>
            </div>
          </div>

          {/* Messages */}
          {info && (
            <div style={{
              padding: '1rem',
              background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)',
              color: '#ecfdf5',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              ✅ {info}
            </div>
          )}
          
          {error && (
            <div style={{
              padding: '1rem',
              background: '#fee2e2',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              color: '#dc2626',
              fontSize: '0.9rem',
              margin: '1rem'
            }}>
              {error}
            </div>
          )}

          {/* Editable Content Area - matching view page style */}
          <div className={styles.previewContent} style={{ 
            maxHeight: 'none', 
            overflow: 'visible', 
            background: '#fff', 
            borderRadius: '8px', 
            padding: '1rem'
          }}>
            {/* Editor Toolbar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              borderBottom: '1px solid #e5e7eb',
              marginBottom: '1rem',
              background: '#f9fafb',
              borderRadius: '6px 6px 0 0'
            }}>
              <button
                onClick={handleAddLink}
                title="Add Link (Ctrl+K)"
                style={{
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  background: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '0.875rem',
                  color: '#374151',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#f3f4f6';
                  e.target.style.borderColor = '#9ca3af';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#fff';
                  e.target.style.borderColor = '#d1d5db';
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                Link
              </button>
              
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: 'auto' }}>
                Tip: Select text and press Ctrl+K to add a link
              </div>
            </div>
            
            <div
              ref={editorRef}
              className="article-editor"
              contentEditable={true}
              onInput={handleContentChange}
              onBlur={handleContentChange}
              onClick={handleEditorClick}
              onContextMenu={handleContextMenu}
              suppressContentEditableWarning={true}
              style={{
                minHeight: '600px',
                padding: '2rem',
                border: hasChanges ? '2px solid rgba(99, 102, 241, 0.3)' : '2px solid rgba(229, 231, 235, 0.5)',
                borderRadius: '6px',
                transition: 'all 0.3s ease',
                backgroundColor: '#fff',
                textAlign: 'left',
                width: '100%',
                maxWidth: 'none',
                margin: 0
              }}
            />
            
            {/* Editor Tips */}
            <div style={{
              marginTop: '2rem',
              padding: '1rem',
              background: 'rgba(99, 102, 241, 0.05)',
              borderRadius: '8px',
              fontSize: '0.875rem',
              color: '#6b7280'
            }}>
              <h4 style={{ marginBottom: '0.5rem', color: '#4b5563' }}>Editor Tips:</h4>
              <div style={{ lineHeight: '1.8' }}>
                <p>Click anywhere in the content to start editing.</p>
                <p><strong>Right-click</strong> anywhere to access formatting options.</p>
                <p>Use <strong>Ctrl+B</strong> for bold, <strong>Ctrl+I</strong> for italic.</p>
                <p>Press <strong>Ctrl+S</strong> to quickly save your changes.</p>
                <p>Press <strong>Ctrl+K</strong> to add links to selected text.</p>
                <p>All formatting will be preserved when saving.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Link Modal */}
      {showLinkModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            padding: '2rem',
            width: '90%',
            maxWidth: '500px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
          }}>
            <h3 style={{ 
              margin: '0 0 1.5rem 0', 
              color: '#1f2937',
              fontSize: '1.25rem',
              fontWeight: '600'
            }}>
              {editingExistingLink ? 'Edit Link' : 'Add Link'}
            </h3>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                color: '#374151',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}>
                Link Text
              </label>
              <input
                type="text"
                value={linkData.text}
                onChange={(e) => setLinkData({ ...linkData, text: e.target.value })}
                placeholder="Enter link text"
                autoFocus={!linkData.text}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              />
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                color: '#374151',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}>
                URL
              </label>
              <input
                type="url"
                value={linkData.url}
                onChange={(e) => setLinkData({ ...linkData, url: e.target.value })}
                placeholder="https://example.com"
                autoFocus={!!linkData.text}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              />
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                color: '#374151',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}>
                Title (Optional)
              </label>
              <input
                type="text"
                value={linkData.title}
                onChange={(e) => setLinkData({ ...linkData, title: e.target.value })}
                placeholder="Link title for accessibility"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              />
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                color: '#374151',
                fontSize: '0.875rem',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={linkData.openInNewTab}
                  onChange={(e) => setLinkData({ ...linkData, openInNewTab: e.target.checked })}
                  style={{ cursor: 'pointer' }}
                />
                Open in new tab
              </label>
            </div>
            
            <div style={{ 
              display: 'flex', 
              gap: '0.75rem', 
              justifyContent: 'flex-end' 
            }}>
              <button
                onClick={handleLinkCancel}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  background: '#fff',
                  color: '#374151',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.background = '#f9fafb'}
                onMouseLeave={(e) => e.target.style.background = '#fff'}
              >
                Cancel
              </button>
              <button
                onClick={handleLinkSubmit}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: 'none',
                  borderRadius: '6px',
                  background: '#6366f1',
                  color: '#fff',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.background = '#5b21b6'}
                onMouseLeave={(e) => e.target.style.background = '#6366f1'}
              >
                {editingExistingLink ? 'Update Link' : 'Add Link'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Context Menu */}
      {showContextMenu && (
        <div
          style={{
            position: 'fixed',
            top: contextMenuPosition.y,
            left: contextMenuPosition.x,
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
            zIndex: 1000,
            minWidth: '200px',
            padding: '0.5rem 0',
            fontSize: '0.875rem'
          }}
        >
          {/* Default Context Menu */}
          {contextMenuType === 'default' && (
            <>
              <button
                onClick={() => formatText('bold')}
                style={{
                  width: '100%',
                  padding: '0.5rem 1rem',
                  border: 'none',
                  background: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}
                onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
                onMouseLeave={(e) => e.target.style.background = 'none'}
              >
                <span style={{ fontWeight: 'bold' }}>B</span>
                Make Bold
                <span style={{ marginLeft: 'auto', color: '#9ca3af', fontSize: '0.75rem' }}>Ctrl+B</span>
              </button>
              
              <button
                onClick={() => formatText('italic')}
                style={{
                  width: '100%',
                  padding: '0.5rem 1rem',
                  border: 'none',
                  background: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}
                onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
                onMouseLeave={(e) => e.target.style.background = 'none'}
              >
                <span style={{ fontStyle: 'italic' }}>I</span>
                Make Italic
                <span style={{ marginLeft: 'auto', color: '#9ca3af', fontSize: '0.75rem' }}>Ctrl+I</span>
              </button>

              <div style={{ height: '1px', background: '#e5e7eb', margin: '0.5rem 0' }} />

              <button
                onClick={handleAddLink}
                style={{
                  width: '100%',
                  padding: '0.5rem 1rem',
                  border: 'none',
                  background: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}
                onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
                onMouseLeave={(e) => e.target.style.background = 'none'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                Add Link
                <span style={{ marginLeft: 'auto', color: '#9ca3af', fontSize: '0.75rem' }}>Ctrl+K</span>
              </button>

              <div style={{ height: '1px', background: '#e5e7eb', margin: '0.5rem 0' }} />

              <button
                onClick={() => insertHeading(2)}
                style={{
                  width: '100%',
                  padding: '0.5rem 1rem',
                  border: 'none',
                  background: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}
                onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
                onMouseLeave={(e) => e.target.style.background = 'none'}
              >
                <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>H2</span>
                Heading 2
              </button>

              <button
                onClick={() => insertHeading(3)}
                style={{
                  width: '100%',
                  padding: '0.5rem 1rem',
                  border: 'none',
                  background: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}
                onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
                onMouseLeave={(e) => e.target.style.background = 'none'}
              >
                <span style={{ fontWeight: 'bold' }}>H3</span>
                Heading 3
              </button>

              <div style={{ height: '1px', background: '#e5e7eb', margin: '0.5rem 0' }} />

              <button
                onClick={() => insertList('unordered')}
                style={{
                  width: '100%',
                  padding: '0.5rem 1rem',
                  border: 'none',
                  background: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}
                onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
                onMouseLeave={(e) => e.target.style.background = 'none'}
              >
                <span>•</span>
                Bullet List
              </button>

              <button
                onClick={() => insertList('ordered')}
                style={{
                  width: '100%',
                  padding: '0.5rem 1rem',
                  border: 'none',
                  background: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}
                onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
                onMouseLeave={(e) => e.target.style.background = 'none'}
              >
                <span>1.</span>
                Numbered List
              </button>

              <button
                onClick={insertBlockquote}
                style={{
                  width: '100%',
                  padding: '0.5rem 1rem',
                  border: 'none',
                  background: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}
                onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
                onMouseLeave={(e) => e.target.style.background = 'none'}
              >
                <span style={{ fontSize: '1.2rem' }}>"</span>
                Quote
              </button>
            </>
          )}

          {/* Selection Context Menu */}
          {contextMenuType === 'selection' && (
            <>
              <button
                onClick={() => formatText('bold')}
                style={{
                  width: '100%',
                  padding: '0.5rem 1rem',
                  border: 'none',
                  background: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}
                onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
                onMouseLeave={(e) => e.target.style.background = 'none'}
              >
                <span style={{ fontWeight: 'bold' }}>B</span>
                Make Bold
              </button>
              
              <button
                onClick={() => formatText('italic')}
                style={{
                  width: '100%',
                  padding: '0.5rem 1rem',
                  border: 'none',
                  background: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}
                onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
                onMouseLeave={(e) => e.target.style.background = 'none'}
              >
                <span style={{ fontStyle: 'italic' }}>I</span>
                Make Italic
              </button>

              <button
                onClick={() => formatText('underline')}
                style={{
                  width: '100%',
                  padding: '0.5rem 1rem',
                  border: 'none',
                  background: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}
                onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
                onMouseLeave={(e) => e.target.style.background = 'none'}
              >
                <span style={{ textDecoration: 'underline' }}>U</span>
                Underline
              </button>

              <div style={{ height: '1px', background: '#e5e7eb', margin: '0.5rem 0' }} />

              <button
                onClick={handleAddLink}
                style={{
                  width: '100%',
                  padding: '0.5rem 1rem',
                  border: 'none',
                  background: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}
                onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
                onMouseLeave={(e) => e.target.style.background = 'none'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                Add Link
              </button>

              <div style={{ height: '1px', background: '#e5e7eb', margin: '0.5rem 0' }} />

              <button
                onClick={() => formatText('copy')}
                style={{
                  width: '100%',
                  padding: '0.5rem 1rem',
                  border: 'none',
                  background: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}
                onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
                onMouseLeave={(e) => e.target.style.background = 'none'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Copy
                <span style={{ marginLeft: 'auto', color: '#9ca3af', fontSize: '0.75rem' }}>Ctrl+C</span>
              </button>

              <button
                onClick={duplicateSelection}
                style={{
                  width: '100%',
                  padding: '0.5rem 1rem',
                  border: 'none',
                  background: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}
                onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
                onMouseLeave={(e) => e.target.style.background = 'none'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Duplicate
              </button>

              <button
                onClick={deleteSelection}
                style={{
                  width: '100%',
                  padding: '0.5rem 1rem',
                  border: 'none',
                  background: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  color: '#dc2626'
                }}
                onMouseEnter={(e) => e.target.style.background = '#fef2f2'}
                onMouseLeave={(e) => e.target.style.background = 'none'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                Delete
                <span style={{ marginLeft: 'auto', color: '#9ca3af', fontSize: '0.75rem' }}>Del</span>
              </button>
            </>
          )}

          {/* Link Context Menu */}
          {contextMenuType === 'link' && (
            <>
              <button
                onClick={() => {
                  if (contextMenuTarget && contextMenuTarget.tagName === 'A') {
                    handleEditLink(contextMenuTarget);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem 1rem',
                  border: 'none',
                  background: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}
                onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
                onMouseLeave={(e) => e.target.style.background = 'none'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Edit Link
              </button>

              <button
                onClick={() => {
                  if (contextMenuTarget && contextMenuTarget.tagName === 'A') {
                    window.open(contextMenuTarget.href, '_blank');
                    closeContextMenu();
                  }
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem 1rem',
                  border: 'none',
                  background: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}
                onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
                onMouseLeave={(e) => e.target.style.background = 'none'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                Open Link
              </button>

              <button
                onClick={() => {
                  if (contextMenuTarget && contextMenuTarget.tagName === 'A') {
                    navigator.clipboard.writeText(contextMenuTarget.href);
                    closeContextMenu();
                  }
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem 1rem',
                  border: 'none',
                  background: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}
                onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
                onMouseLeave={(e) => e.target.style.background = 'none'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Copy Link
              </button>

              <div style={{ height: '1px', background: '#e5e7eb', margin: '0.5rem 0' }} />

              <button
                onClick={() => {
                  if (contextMenuTarget && contextMenuTarget.tagName === 'A') {
                    handleRemoveLink(contextMenuTarget);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem 1rem',
                  border: 'none',
                  background: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  color: '#dc2626'
                }}
                onMouseEnter={(e) => e.target.style.background = '#fef2f2'}
                onMouseLeave={(e) => e.target.style.background = 'none'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18.36 6.64a9 9 0 0 1 1.14 12.36"/>
                  <path d="M6.16 6.16a9 9 0 1 0 12.68 12.68"/>
                  <path d="M12 2v20"/>
                  <path d="M2 12h20"/>
                </svg>
                Remove Link
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function ArticleEditPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Loading editor...</div>}>
      <ArticleEditContent />
    </Suspense>
  );
}
