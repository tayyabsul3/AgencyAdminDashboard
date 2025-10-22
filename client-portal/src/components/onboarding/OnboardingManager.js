import React, { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { updateOnboardingStep, completeOnboarding, trackOnboardingEvent } from '../../services/userService';
import OnboardingOverlay from './OnboardingOverlay';
import OnboardingTooltip from './OnboardingTooltip';
import OnboardingProgress from './OnboardingProgress';
import { ONBOARDING_STEPS } from './onboardingSteps';


const OnboardingManager = ({ user, userProfile, onComplete }) => {
  const pathname = usePathname();
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [targetElement, setTargetElement] = useState(null);
  const [currentStepData, setCurrentStepData] = useState(null);
  const [isGeneratingArticle, setIsGeneratingArticle] = useState(false);
  const [tutorialRequested, setTutorialRequested] = useState(false);
  const stepStartTime = useRef(Date.now());

  // Initialize onboarding
  const initializeUserOnboarding = useCallback(async () => {
    if (!user?.uid) {
      setIsLoading(false);
      return;
    }

    try {
      // Set loading to false immediately
      setIsLoading(false);
      
      // Only activate onboarding if tutorial was explicitly requested
      if (!tutorialRequested) {
        return;
      }
      
      setIsActive(true);
      
      // Determine correct step based on current page
      let initialStep = 0;
      if (pathname === '/dashboard/create/interview/') {
        initialStep = 2;
      } else if (pathname === '/dashboard/create/keyword/') {
        initialStep = 4;
      } else if (pathname.startsWith('/dashboard/create/')) {
        initialStep = 1;
      } else if (pathname === '/dashboard/articles/' || pathname.startsWith('/dashboard/articles/view/')) {
        initialStep = 6; // Completion step
      }
      
      setCurrentStep(initialStep);
      
      // Track onboarding start (async, don't wait)
      trackOnboardingEvent(user.uid, 'onboarding_start', {
        stepId: initialStep,
        timestamp: Date.now()
      }).catch(() => {});
    } catch (error) {
      setIsLoading(false);
    }
  }, [user?.uid, pathname, tutorialRequested]);

  // Listen for Start Tutorial event
  useEffect(() => {
    const handleStartTutorial = () => {
      setTutorialRequested(true);
    };

    window.addEventListener('startOnboarding', handleStartTutorial);
    
    // Also expose global function
    window.startOnboardingTutorial = () => {
      setTutorialRequested(true);
    };

    return () => {
      window.removeEventListener('startOnboarding', handleStartTutorial);
      delete window.startOnboardingTutorial;
    };
  }, []);

  // Initialize when tutorial is requested
  useEffect(() => {
    if (tutorialRequested) {
      initializeUserOnboarding();
    }
  }, [tutorialRequested, initializeUserOnboarding]);

  // Get current step data and validate page match
  useEffect(() => {
    if (currentStep < ONBOARDING_STEPS.length) {
      const stepData = ONBOARDING_STEPS[currentStep];
      
      // Special case: Skip Step 3 (Continue) when on keyword creation page
      if (currentStep === 3 && pathname === '/dashboard/create/keyword/') {
        setCurrentStep(4);
        return;
      }
      
      // Special case: Progress from Step 5 to Step 6 when we reach articles page after generation
      if (currentStep === 5 && (pathname === '/dashboard/articles/' || pathname.startsWith('/dashboard/articles/view/'))) {
        setIsGeneratingArticle(false); // Reset the generating state
        handleStepComplete(currentStep);
        return;
      }
      
      // Check if we're on the correct page for this step
      const isOnCorrectPage = stepData.page === pathname || 
                             (stepData.page === '/dashboard/articles/' && pathname.startsWith('/dashboard/articles/view/'));
      
      if (stepData.page && !isOnCorrectPage) {
        // Special handling: Don't go backwards if we're progressing through steps
        // Only adjust step if we're on a completely different page flow
        const correctStep = ONBOARDING_STEPS.findIndex(step => 
          step.page === pathname || 
          (step.page === '/dashboard/articles/' && pathname.startsWith('/dashboard/articles/view/'))
        );
        if (correctStep !== -1 && correctStep !== currentStep) {
          // Only adjust if we're going to a lower step number (backwards navigation)
          // or if we're more than 1 step ahead (major page jump)
          const stepDifference = correctStep - currentStep;
          
          // Special case: If we're on step 6 (completion), only show it on articles page
          if (currentStep === 6 && pathname !== '/dashboard/articles/') {
            // Don't show step 6 until we're actually on the articles page
            return;
          }
          
          if (stepDifference < 0 || stepDifference > 1) {
            setCurrentStep(correctStep);
            return;
          }
        }
      }
      
      setCurrentStepData(stepData);
    }
  }, [currentStep, pathname]);

  // Find target element for current step
  const findTargetElement = useCallback(() => {
    if (!currentStepData?.target) return null;

    // Smart detection based on step type and page
    const buttons = document.querySelectorAll('button');
    
    // Step 1: Look for "Create New Article" button (dashboard page)
    if (currentStep === 1) {
      for (const button of buttons) {
        if (button.textContent?.includes('Create New Article') && isElementVisible(button)) {
          return button;
        }
      }
    }

    // Step 2: Look for "Choose Keyword Article" button (interview selection page)
    if (currentStep === 2) {
      for (const button of buttons) {
        if (button.textContent?.includes('Choose Keyword Article') && isElementVisible(button)) {
          return button;
        }
      }
    }

    // Step 3: Look for Continue/Next button
    if (currentStep === 3) {
      for (const button of buttons) {
        if ((button.textContent?.includes('Continue') || button.textContent?.includes('Next')) && isElementVisible(button)) {
          return button;
        }
      }
    }

    // Step 4: Look for the keyword input field specifically
    if (currentStep === 4) {
      const inputs = document.querySelectorAll('input[type="text"], textarea');
      for (const input of inputs) {
        // Match the same logic as the input handler - find the keyword input
        const isKeywordInput = input.type === 'text' && 
                             (input.placeholder?.includes('Digital Marketing') || 
                              input.name === 'keyword' || 
                              input.getAttribute('role') === 'textbox' ||
                              input.placeholder?.toLowerCase().includes('topic'));
        
        if (isKeywordInput && isElementVisible(input)) {
          return input;
        }
      }
      
      // Fallback: return first visible text input if no keyword input found
      for (const input of inputs) {
        if (isElementVisible(input)) {
          return input;
        }
      }
    }

    // Step 5: Look for Generate button
    if (currentStep === 5) {
      for (const button of buttons) {
        if ((button.textContent?.includes('Generate') || button.textContent?.includes('Create Article')) && isElementVisible(button)) {
          return button;
        }
      }
    }

    // Step 6: Completion step - no target element needed
    if (currentStep === 6) {
      return null;
    }

    // Try original selector as fallback
    try {
      const element = document.querySelector(currentStepData.target);
      if (element && isElementVisible(element)) {
        return element;
      }
    } catch (e) {
      // Selector failed
    }

    return null;
  }, [currentStepData, currentStep]);

  // Update target element when step changes
  useEffect(() => {
    if (!isActive || !currentStepData) return;

    const updateTarget = () => {
      const element = findTargetElement();
      
      // Scroll element into view if found
      if (element) {
        element.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'nearest'
        });
      }
      
      setTargetElement(element);
    };

    // Initial update
    updateTarget();

    // Watch for DOM changes
    const observer = new MutationObserver(updateTarget);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true
    });

    return () => observer.disconnect();
  }, [isActive, currentStepData, findTargetElement]);

  // Handle step progression
  const handleStepComplete = async (stepId, data = {}) => {
    const timeSpent = Date.now() - stepStartTime.current;
    
    try {
      // Update step in database
      await updateOnboardingStep(user.uid, stepId, { timeSpent });
      
      // Track completion
      await trackOnboardingEvent(user.uid, 'step_complete', {
        stepId,
        timeSpent,
        ...data
      });

      // Move to next step
      let nextStep = stepId + 1;
      
      // Special case: Skip Step 3 (Continue) when going from Step 2 (Choose Keyword Article) 
      // directly to keyword creation page
      if (stepId === 2 && pathname === '/dashboard/create/keyword/') {
        nextStep = 4; // Skip to Step 4 (Enter Topic)
      }
      
      if (nextStep >= ONBOARDING_STEPS.length) {
        // Onboarding complete
        await completeOnboarding(user.uid, data.articleId);
        setIsActive(false);
        setTutorialRequested(false); // Reset tutorial request state
        onComplete?.();
      } else {
        setCurrentStep(nextStep);
        stepStartTime.current = Date.now();
      }
    } catch (error) {
      // Error completing step
    }
  };

  // Handle element click
  const handleElementClick = useCallback((event) => {
    if (!isActive || !currentStepData) return;

    // Don't block clicks on the onboarding tooltip itself
    const tooltipElement = event.target.closest('.onboarding-tooltip');
    if (tooltipElement) {
      return; // Allow tooltip clicks to proceed
    }

    const clickedButton = event.target.closest('button');
    
    // Step-specific click handling
    if (currentStep === 1 && clickedButton?.textContent?.includes('Create New Article')) {
      setTimeout(() => handleStepComplete(currentStep), 100);
      return;
    }
    
    if (currentStep === 2 && clickedButton?.textContent?.includes('Choose Keyword Article')) {
      setTimeout(() => handleStepComplete(currentStep), 100);
      return;
    }
    
    if (currentStep === 3 && clickedButton && (clickedButton.textContent?.includes('Continue') || clickedButton.textContent?.includes('Next'))) {
      setTimeout(() => handleStepComplete(currentStep), 100);
      return;
    }
    
    if (currentStep === 5 && clickedButton && (clickedButton.textContent?.includes('Generate') || clickedButton.textContent?.includes('Create Article'))) {
      // Hide onboarding immediately when article generation starts
      setIsGeneratingArticle(true);
      // The page validation effect will handle the progression when we reach /dashboard/articles/
      return;
    }

    // For input steps (Step 4), don't complete on click - wait for actual input
    if (currentStep === 4 && targetElement && (event.target === targetElement || targetElement.contains(event.target))) {
      // Don't complete step on click for input fields - let the input handler do it
      return;
    }
    
    // For other steps, check if clicked element is the target
    if (targetElement && (event.target === targetElement || targetElement.contains(event.target))) {
      handleStepComplete(currentStep);
    } else {
      // Block other clicks
      event.preventDefault();
      event.stopPropagation();
    }
  }, [isActive, targetElement, currentStepData, currentStep]);

  // Add click handler
  useEffect(() => {
    if (isActive) {
      document.addEventListener('click', handleElementClick, true);
      return () => document.removeEventListener('click', handleElementClick, true);
    }
  }, [isActive, handleElementClick]);

  // Add input handler for Step 4 (Enter Topic)
  useEffect(() => {
    if (!isActive || currentStep !== 4) return;

    let inputTimeout = null;

    const handleInputChange = (event) => {
      const input = event.target;
      
      // Check if this is the keyword input field (more specific targeting)
      const isKeywordInput = input.type === 'text' && 
                           (input.placeholder?.includes('Digital Marketing') || 
                            input.name === 'keyword' || 
                            input.getAttribute('role') === 'textbox');
      
      if (isKeywordInput && input.value.trim().length >= 2) {
        // Clear any existing timeout
        if (inputTimeout) {
          clearTimeout(inputTimeout);
        }
        
        // Shorter delay for better responsiveness
        inputTimeout = setTimeout(() => {
          handleStepComplete(currentStep, { topicEntered: input.value.trim() });
        }, 500);
      }
    };

    // Listen for input events on text fields
    document.addEventListener('input', handleInputChange);
    
    return () => {
      document.removeEventListener('input', handleInputChange);
      if (inputTimeout) {
        clearTimeout(inputTimeout);
      }
    };
  }, [isActive, currentStep, handleStepComplete]);

  // Render check
  const shouldRender = isActive && !isLoading && currentStepData && currentStep < ONBOARDING_STEPS.length && !isGeneratingArticle;

  if (!shouldRender) {
    return null;
  }

  return (
    <>
      <OnboardingOverlay targetElement={targetElement} />
      
      <OnboardingTooltip
        targetElement={targetElement}
        step={currentStepData}
        onNext={() => handleStepComplete(currentStep)}
      />
      
      <OnboardingProgress
        currentStep={currentStep}
        totalSteps={ONBOARDING_STEPS.length}
        stepTitle={currentStepData.title}
      />
    </>
  );
};

// Helper functions
const isElementVisible = (element) => {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  
  return rect.width > 0 && 
         rect.height > 0 && 
         style.visibility !== 'hidden' && 
         style.display !== 'none' &&
         element.offsetParent !== null;
};

export default OnboardingManager;