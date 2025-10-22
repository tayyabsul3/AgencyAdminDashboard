'use client';

import React, { useState, useEffect } from 'react';
import styles from './SectionOrderConfig.module.css';

/**
 * Available article sections that can be reordered
 */
const DEFAULT_SECTIONS = [
  { id: 'title', label: 'Title & Subtitle', required: true, description: 'Article title and subtitle' },
  { id: 'key_takeaways', label: 'Key Takeaways', required: false, description: 'Summary bullets at the top' },
  { id: 'intro', label: 'Introduction', required: true, description: 'Opening paragraphs' },
  { id: 'tables', label: 'Tables', required: false, description: 'Data tables and comparisons' },
  { id: 'checklists', label: 'Checklists', required: false, description: 'Action checklists' },
  { id: 'toc', label: 'Table of Contents', required: false, description: 'Article outline' },
  { id: 'faqs', label: 'FAQs', required: false, description: 'Question and answer sections' },
  { id: 'meta_description', label: 'Article Summary', required: false, description: 'Meta description box' }
];

export default function SectionOrderConfig({ initialOrder, onOrderChange, onClose }) {
  const [sections, setSections] = useState(() => {
    // If initialOrder is provided, validate and migrate it
    if (initialOrder && initialOrder.length > 0) {
      // Get IDs of sections in the default list
      const defaultIds = DEFAULT_SECTIONS.map(s => s.id);
      
      // Filter out any sections that no longer exist in defaults
      const validSections = initialOrder.filter(s => defaultIds.includes(s.id));
      
      // Add any new sections that are in defaults but not in saved order
      const savedIds = validSections.map(s => s.id);
      const newSections = DEFAULT_SECTIONS.filter(s => !savedIds.includes(s.id));
      
      // Merge: keep user order for existing sections, append new ones at the end
      const migratedOrder = [...validSections, ...newSections];
      
      // If migration happened, return the migrated order
      if (migratedOrder.length !== initialOrder.length || newSections.length > 0) {
        return migratedOrder;
      }
      
      return initialOrder;
    }
    return DEFAULT_SECTIONS;
  });
  
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [showHelp, setShowHelp] = useState(false);

  // Handle drag start
  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  // Handle drag over
  const handleDragOver = (e, index) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === index) return;

    const newSections = [...sections];
    const draggedItem = newSections[draggedIndex];
    
    // Remove from old position
    newSections.splice(draggedIndex, 1);
    // Insert at new position
    newSections.splice(index, 0, draggedItem);
    
    setSections(newSections);
    setDraggedIndex(index);
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Move section up
  const moveUp = (index) => {
    if (index === 0) return;
    const newSections = [...sections];
    [newSections[index], newSections[index - 1]] = [newSections[index - 1], newSections[index]];
    setSections(newSections);
  };

  // Move section down
  const moveDown = (index) => {
    if (index === sections.length - 1) return;
    const newSections = [...sections];
    [newSections[index], newSections[index + 1]] = [newSections[index + 1], newSections[index]];
    setSections(newSections);
  };

  // Reset to default order
  const handleReset = () => {
    if (confirm('Reset to default section order?')) {
      setSections(DEFAULT_SECTIONS);
    }
  };

  // Save configuration
  const handleSave = () => {
    onOrderChange(sections);
    if (onClose) onClose();
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>📋 Customize Section Order</h2>
          <button 
            className={styles.helpButton}
            onClick={() => setShowHelp(!showHelp)}
            title="Show help"
          >
            ?
          </button>
          <button 
            className={styles.closeButton} 
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {showHelp && (
          <div className={styles.helpBox}>
            <p><strong>How to use:</strong></p>
            <ul>
              <li>🖱️ <strong>Drag & Drop:</strong> Click and hold a section, then drag to reorder</li>
              <li>⬆️⬇️ <strong>Arrow Buttons:</strong> Use up/down arrows to move sections</li>
              <li>🔒 <strong>Required sections</strong> (marked) must stay in the article</li>
              <li>💾 Click "Save Order" to apply your custom arrangement</li>
            </ul>
          </div>
        )}

        <div className={styles.sectionsContainer}>
          {sections.map((section, index) => (
            <div
              key={section.id}
              className={`${styles.sectionItem} ${draggedIndex === index ? styles.dragging : ''} ${section.required ? styles.required : ''}`}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
            >
              <div className={styles.dragHandle}>
                <span className={styles.dragIcon}>⋮⋮</span>
                <span className={styles.orderNumber}>{index + 1}</span>
              </div>
              
              <div className={styles.sectionInfo}>
                <div className={styles.sectionLabel}>
                  {section.label}
                  {section.required && <span className={styles.requiredBadge}>Required</span>}
                </div>
                <div className={styles.sectionDescription}>{section.description}</div>
              </div>

              <div className={styles.controls}>
                <button
                  className={styles.arrowButton}
                  onClick={() => moveUp(index)}
                  disabled={index === 0}
                  title="Move up"
                >
                  ▲
                </button>
                <button
                  className={styles.arrowButton}
                  onClick={() => moveDown(index)}
                  disabled={index === sections.length - 1}
                  title="Move down"
                >
                  ▼
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.footer}>
          <button className={styles.resetButton} onClick={handleReset}>
            🔄 Reset to Default
          </button>
          <div className={styles.actionButtons}>
            <button className={styles.cancelButton} onClick={onClose}>
              Cancel
            </button>
            <button className={styles.saveButton} onClick={handleSave}>
              💾 Save Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
