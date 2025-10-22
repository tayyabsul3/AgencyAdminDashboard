'use client';

import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import OnboardingManager from './OnboardingManager';

const GlobalOnboardingManager = () => {
  const { user, userProfile } = useAuth();

  // Only show onboarding for authenticated users
  if (!user?.uid) {
    return null;
  }

  // Check if onboarding should be shown
  const shouldShowOnboarding = () => {
    // For development: Always show onboarding for easy testing
    if (process.env.NODE_ENV === 'development') {
      // Temporarily return true to always show onboarding during development
      return true;
    }
    
    if (!userProfile?.onboarding) return true; // New user
    return !userProfile.onboarding.isCompleted;
  };

  // Handle onboarding completion
  const handleOnboardingComplete = () => {
    // The onboarding state will be updated via real-time listeners
  };

  if (!shouldShowOnboarding()) {
    return null;
  }

  return (
    <OnboardingManager 
      user={user}
      userProfile={userProfile}
      onComplete={handleOnboardingComplete}
    />
  );
};

export default GlobalOnboardingManager;