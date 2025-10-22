/**
 * Utility functions for agency client protection
 */

/**
 * Check if user is an agency client (client tier)
 * @param {Object} subscription - User subscription object
 * @returns {boolean} True if user is a client tier user
 */
export const isAgencyClient = (subscription) => {
  return subscription?.tier === 'client' || subscription?.tier === 'Client';
};

/**
 * Check if user can access subscription management
 * @param {Object} subscription - User subscription object
 * @returns {boolean} True if user can manage their subscription
 */
export const canManageSubscription = (subscription) => {
  return !isAgencyClient(subscription);
};

/**
 * Check if user can access branding settings
 * @param {Object} subscription - User subscription object
 * @returns {boolean} True if user can manage branding settings
 */
export const canManageBranding = (subscription) => {
  // Client tier users inherit agency branding, can't manage their own
  return !isAgencyClient(subscription);
};

/**
 * Check if user can access brand voice settings
 * @param {Object} subscription - User subscription object
 * @returns {boolean} True if user can manage brand voice settings
 */
export const canManageBrandVoice = (subscription) => {
  // Client tier users CAN manage their own brand voice settings
  return true; // All users can manage brand voice (tier limits are handled separately)
};

/**
 * Check if user can see pricing information
 * @param {Object} subscription - User subscription object
 * @returns {boolean} True if user should see pricing links
 */
export const canSeePricing = (subscription) => {
  return !isAgencyClient(subscription);
};

/**
 * Get agency information for client tier users
 * @param {Object} subscription - User subscription object
 * @returns {Object|null} Agency information or null
 */
export const getAgencyInfo = (subscription) => {
  if (!isAgencyClient(subscription)) return null;
  
  return {
    agencyId: subscription.agencyId,
    agencyName: subscription.agencyName,
    ownerId: subscription.ownerId
  };
};

/**
 * Get appropriate credit display information
 * @param {Object} creditsInfo - Credits information from useSubscription
 * @param {Object} subscription - User subscription object
 * @returns {Object} Credit display information
 */
export const getCreditDisplayInfo = (creditsInfo, subscription) => {
  if (isAgencyClient(subscription)) {
    return {
      label: 'Agency Credits',
      tooltip: `Credits managed by ${subscription.agencyName || 'your agency'}`,
      isAgencyCredits: true,
      agencyName: subscription.agencyName
    };
  }
  
  return {
    label: 'Credits',
    tooltip: 'Your available credits',
    isAgencyCredits: false,
    agencyName: null
  };
};

/**
 * Get restricted pages for agency clients
 * @returns {Array} Array of page paths that agency clients cannot access
 */
export const getRestrictedPagesForAgencyClients = () => {
  return [
    '/dashboard/subscription',
    '/pricing'
  ];
};

/**
 * Check if a page is restricted for agency clients
 * @param {string} pathname - Current page path
 * @param {Object} subscription - User subscription object
 * @returns {boolean} True if page is restricted for this user
 */
export const isPageRestrictedForAgencyClient = (pathname, subscription) => {
  if (!isAgencyClient(subscription)) return false;
  
  const restrictedPages = getRestrictedPagesForAgencyClients();
  return restrictedPages.some(page => pathname.startsWith(page));
};