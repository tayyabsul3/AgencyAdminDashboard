'use client';

import React from 'react';
import styles from './StudioLayout.module.css';

const StudioLayout = ({ 
  children,
  className = '',
  ...props 
}) => {
  return (
    <div className={`${styles.studioLayout} studio-theme ${className}`} {...props}>
      {children}
    </div>
  );
};

const StudioHeader = ({ children, className = '', ...props }) => {
  return (
    <header className={`${styles.studioHeader} ${className}`} {...props}>
      {children}
    </header>
  );
};

const StudioMain = ({ children, className = '', ...props }) => {
  return (
    <main className={`${styles.studioMain} ${className}`} {...props}>
      {children}
    </main>
  );
};

const StudioPanels = ({ children, className = '', ...props }) => {
  return (
    <div className={`${styles.studioPanels} ${className}`} {...props}>
      {children}
    </div>
  );
};

const InterviewerPanel = ({ children, className = '', ...props }) => {
  return (
    <section 
      className={`${styles.interviewerPanel} ${className}`} 
      aria-label="AI Interviewer"
      {...props}
    >
      {children}
    </section>
  );
};

const RecordingConsole = ({ children, className = '', ...props }) => {
  return (
    <section 
      className={`${styles.recordingConsole} ${className}`} 
      aria-label="Recording Controls"
      {...props}
    >
      {children}
    </section>
  );
};

const ResponsePanel = ({ children, className = '', ...props }) => {
  return (
    <section 
      className={`${styles.responsePanel} ${className}`} 
      aria-label="Response and Transcription"
      {...props}
    >
      {children}
    </section>
  );
};



// Export all components
StudioLayout.Header = StudioHeader;
StudioLayout.Main = StudioMain;
StudioLayout.Panels = StudioPanels;
StudioLayout.InterviewerPanel = InterviewerPanel;
StudioLayout.RecordingConsole = RecordingConsole;
StudioLayout.ResponsePanel = ResponsePanel;

export default StudioLayout;
export {
  StudioHeader,
  StudioMain,
  StudioPanels,
  InterviewerPanel,
  RecordingConsole,
  ResponsePanel
};