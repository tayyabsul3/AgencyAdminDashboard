// Voice Interview Components - Studio Design System
export { default as VoiceInterviewInterface } from './VoiceInterviewInterface';
export { default as VoiceInterviewStudio } from './VoiceInterviewStudio';

// Studio Layout System
export { default as StudioLayout } from './StudioLayout';
export {
  StudioHeader,
  StudioMain,
  StudioPanels,
  InterviewerPanel,
  RecordingConsole,
  ResponsePanel
} from './StudioLayout';

// Studio Components
export { default as StudioHeaderComponent } from './StudioHeaderComponent';
export { default as AIInterviewerPanel } from './AIInterviewerPanel';
export { default as RecordingConsoleComponent } from './RecordingConsoleComponent';
export { default as ResponsePanelComponent } from './ResponsePanelComponent';
export { default as FloatingSuggestions } from './FloatingSuggestions';

// Legacy Components (maintained for compatibility)
export { default as AudioControls } from './AudioControls';
export { default as TranscriptionDisplay } from './TranscriptionDisplay';
export { default as SuggestiveAnswers } from './SuggestiveAnswers';