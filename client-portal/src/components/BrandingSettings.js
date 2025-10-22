'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { shouldShowBranding, getBrandingPreview } from '../utils/branding';

/**
 * Branding Settings Component
 * Allows users on eligible plans to control "Powered by QueryFuel" branding
 */
const BrandingSettings = () => {
  const { user, subscriptionTier } = useAuth();
  const [settings, setSettings] = useState({ showBranding: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Check if user can control branding
  const canControlBranding = subscriptionTier && 
    ['growth', 'scale', 'agency custom', 'agency'].includes(subscriptionTier.toLowerCase());

  const brandingPreview = getBrandingPreview(subscriptionTier, settings);

  useEffect(() => {
    // Load user's branding preferences
    // This would typically come from Firestore user settings
    // For now, we'll use localStorage as a placeholder
    if (user && canControlBranding) {
      try {
        const saved = localStorage.getItem(`branding_settings_${user.uid}`);
        if (saved) {
          setSettings(JSON.parse(saved));
        } else {
          // Set default based on tier
          const defaultSetting = subscriptionTier?.toLowerCase() === 'agency custom' || 
                                 subscriptionTier?.toLowerCase() === 'agency';
          setSettings({ showBranding: defaultSetting });
        }
      } catch (error) {
        console.error('Failed to load branding settings:', error);
      }
    }
    setLoading(false);
  }, [user, subscriptionTier, canControlBranding]);

  const handleToggleBranding = async (enabled) => {
    if (!canControlBranding) return;

    setSaving(true);
    try {
      const newSettings = { ...settings, showBranding: enabled };
      
      // Save to localStorage (in a real app, this would be Firestore)
      localStorage.setItem(`branding_settings_${user.uid}`, JSON.stringify(newSettings));
      
      setSettings(newSettings);
      
      // TODO: In a real implementation, save to Firestore user settings
      // await updateUserSettings(user.uid, { branding: newSettings });
      
    } catch (error) {
      console.error('Failed to save branding settings:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center' }}>
        <div>Loading branding settings...</div>
      </div>
    );
  }

  if (!canControlBranding) {
    return (
      <div style={{
        padding: '1rem',
        background: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        color: '#6b7280'
      }}>
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#374151' }}>
          Branding Settings
        </h3>
        <p style={{ margin: 0, fontSize: '0.875rem' }}>
          {subscriptionTier === 'Free' || subscriptionTier === 'Starter' 
            ? `"Powered by QueryFuel" branding is required for ${subscriptionTier} plans.`
            : 'Branding control is available for Growth, Scale, and Agency plans.'
          }
        </p>
        {brandingPreview.willShow && (
          <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#9ca3af' }}>
            Current status: Branding will be shown on published articles
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{
      padding: '1.5rem',
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: '8px'
    }}>
      <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', color: '#111827' }}>
        Branding Settings
      </h3>
      
      <div style={{ marginBottom: '1rem' }}>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          cursor: 'pointer',
          fontSize: '0.875rem',
          color: '#374151'
        }}>
          <input
            type="checkbox"
            checked={settings.showBranding === true}
            onChange={(e) => handleToggleBranding(e.target.checked)}
            disabled={saving}
            style={{
              width: '16px',
              height: '16px',
              accentColor: '#00D4FF'
            }}
          />
          <span>Show "Powered by QueryFuel" on published articles</span>
        </label>
      </div>

      <div style={{
        padding: '0.75rem',
        background: brandingPreview.willShow ? '#f0f9ff' : '#f9fafb',
        border: `1px solid ${brandingPreview.willShow ? '#0ea5e9' : '#e5e7eb'}`,
        borderRadius: '6px',
        fontSize: '0.875rem',
        color: brandingPreview.willShow ? '#0c4a6e' : '#6b7280'
      }}>
        <strong>Current Status:</strong> {brandingPreview.message}
      </div>

      {brandingPreview.willShow && brandingPreview.brandingHtml && (
        <div style={{ marginTop: '1rem' }}>
          <div style={{ 
            fontSize: '0.75rem', 
            color: '#6b7280', 
            marginBottom: '0.5rem',
            fontWeight: '500'
          }}>
            Preview:
          </div>
          <div 
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              padding: '0.5rem',
              background: '#fafafa'
            }}
            dangerouslySetInnerHTML={{ __html: brandingPreview.brandingHtml }}
          />
        </div>
      )}

      {saving && (
        <div style={{
          marginTop: '1rem',
          fontSize: '0.875rem',
          color: '#6b7280',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <div style={{
            width: '16px',
            height: '16px',
            border: '2px solid #e5e7eb',
            borderTop: '2px solid #00D4FF',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          Saving settings...
        </div>
      )}
    </div>
  );
};

export default BrandingSettings;