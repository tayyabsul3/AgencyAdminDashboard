import React from 'react';
import styles from './OnboardingOverlay.module.css';

const OnboardingOverlay = ({ targetElement }) => {
  const [, forceUpdate] = React.useState({});
  
  // Force re-render on scroll to update positions
  React.useEffect(() => {
    if (!targetElement) return;
    
    const handleUpdate = () => {
      // Force component re-render to recalculate positions
      forceUpdate({});
    };
    
    window.addEventListener('scroll', handleUpdate, { passive: true });
    window.addEventListener('resize', handleUpdate, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleUpdate);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [targetElement]);
  
  return (
    <div className={styles.overlay}>
      {targetElement && (
        <>
          {/* Create 4 overlay sections around the target element */}
          {getOverlaySections(targetElement).map((section, index) => (
            <div 
              key={index}
              className={styles.overlaySection}
              style={section}
            />
          ))}
          
          {/* Highlight border around target */}
          <div 
            className={styles.highlightBorder}
            style={getHighlightStyle(targetElement)}
          />
          
          {/* Pointing arrow */}
          <div 
            className={styles.pointingArrow}
            style={getArrowStyle(targetElement)}
          />
        </>
      )}
    </div>
  );
};

const getOverlaySections = (element) => {
  if (!element) return [];
  
  const rect = element.getBoundingClientRect();
  const padding = 8;
  
  const cutoutLeft = rect.left - padding;
  const cutoutTop = rect.top - padding;
  const cutoutRight = rect.right + padding;
  const cutoutBottom = rect.bottom + padding;
  
  return [
    // Top section
    {
      top: 0,
      left: 0,
      width: '100vw',
      height: `${cutoutTop}px`
    },
    // Bottom section
    {
      top: `${cutoutBottom}px`,
      left: 0,
      width: '100vw',
      height: `calc(100vh - ${cutoutBottom}px)`
    },
    // Left section
    {
      top: `${cutoutTop}px`,
      left: 0,
      width: `${cutoutLeft}px`,
      height: `${cutoutBottom - cutoutTop}px`
    },
    // Right section
    {
      top: `${cutoutTop}px`,
      left: `${cutoutRight}px`,
      width: `calc(100vw - ${cutoutRight}px)`,
      height: `${cutoutBottom - cutoutTop}px`
    }
  ];
};

const getHighlightStyle = (element) => {
  if (!element) return {};
  
  const rect = element.getBoundingClientRect();
  const padding = 8;
  
  return {
    left: rect.left - padding,
    top: rect.top - padding,
    width: rect.width + (padding * 2),
    height: rect.height + (padding * 2),
    borderRadius: getElementBorderRadius(element)
  };
};

const getArrowStyle = (element) => {
  if (!element) return {};
  
  const rect = element.getBoundingClientRect();
  const arrowSize = 40;
  
  return {
    left: rect.left + rect.width / 2 - arrowSize / 2,
    top: rect.top - arrowSize - 20,
    width: arrowSize,
    height: arrowSize,
  };
};

const getElementBorderRadius = (element) => {
  // Handle mock element objects (from position tracking)
  if (!element || !element.tagName) {
    return '8px'; // Default border radius
  }
  
  try {
    const computedStyle = window.getComputedStyle(element);
    const borderRadius = computedStyle.borderRadius;
    
    if (borderRadius && borderRadius !== '0px') {
      return borderRadius;
    }
  } catch (error) {
    // Could not get computed style
  }
  
  // Default border radius based on element type
  if (element.tagName === 'BUTTON') return '8px';
  if (element.tagName === 'INPUT') return '6px';
  return '8px';
};

export default OnboardingOverlay;