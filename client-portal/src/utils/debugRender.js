// Debug utilities for development
const isDebugMode = process.env.NODE_ENV === 'development';

export const useRenderLogger = (componentName, props = {}) => {
  if (!isDebugMode) return;
  
  // Only log in development
  if (typeof window !== 'undefined' && window.console) {
    console.log(`[${componentName}] Render:`, props);
  }
};

export const profilerOnRender = (id, phase, actualDuration, baseDuration, startTime, commitTime) => {
  if (!isDebugMode) return;
  
  if (typeof window !== 'undefined' && window.console) {
    console.log(`[Profiler] ${id} (${phase}):`, {
      actualDuration,
      baseDuration,
      startTime,
      commitTime
    });
  }
};

export const isDebugEnabled = () => {
  return isDebugMode;
};