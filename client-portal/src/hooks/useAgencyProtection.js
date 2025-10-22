'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { isPageRestrictedForAgencyClient } from '../utils/agencyProtection';

/**
 * Hook to protect pages from agency clients and redirect them appropriately
 * @param {Object} options - Configuration options
 * @param {string} options.redirectTo - Where to redirect agency clients (default: '/dashboard')
 * @param {string} options.message - Message to show after redirect
 * @returns {Object} Protection status and utilities
 */
export const useAgencyProtection = (options = {}) => {
  const { redirectTo = '/dashboard', message = 'subscription-managed-by-agency' } = options;
  const { subscription, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isAgencyClient = subscription?.tier === 'client' || subscription?.tier === 'Client';
  const isRestricted = isPageRestrictedForAgencyClient(pathname, subscription);

  useEffect(() => {
    if (!loading && isAgencyClient && isRestricted) {
      const redirectUrl = message ? `${redirectTo}?message=${message}` : redirectTo;
      router.push(redirectUrl);
    }
  }, [loading, isAgencyClient, isRestricted, router, redirectTo, message]);

  return {
    isAgencyClient,
    isRestricted,
    loading,
    shouldRedirect: isAgencyClient && isRestricted
  };
};