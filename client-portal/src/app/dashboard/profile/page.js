'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import { sendPasswordResetEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider, updateProfile } from 'firebase/auth';
import { auth } from '../../../lib/firebase';
import { getUserProfile, updateUserProfile, getBrandVoiceSettings, updateBrandVoiceSettings, getBrandVoiceSettingsWithDefaults, validateBrandVoiceSettings } from '../../../services/userService';
import { useSubscription } from '../../../hooks/useSubscription';
import { shouldShowBranding, generateBrandingHtml, appendBrandingToContent, getBrandingPreview } from '../../../utils/branding';
import { industryPresets, brandVoiceTierConfigurations } from '../../../lib/firestore/subscriptionSchema';
import styles from '../Dashboard.module.css';

const formatBioHtml = (text) => {
  if (!text) {
    return '';
  }
  return text.includes('<') ? text : text.replace(/\n/g, '<br />');
};

function ProfilePageContent() {
  const { user, logout, refreshBrandVoiceSettings, subscription } = useAuth();
  const { credits, creditsUsed, creditsRemaining, tier, refetch: refetchSubscription } = useSubscription(user?.uid);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check if user is a client tier (agency client)
  const isClientTier = subscription?.tier === 'client' || subscription?.tier === 'Client';

  // State for different sections
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Branding state
  const [brandingPreview, setBrandingPreview] = useState(null);
  const [userBrandingSettings, setUserBrandingSettings] = useState({ showBranding: null });
  const [savingBrandingSettings, setSavingBrandingSettings] = useState(false);

  // Password reset states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Forget password states
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  // Profile info states
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [profileBioBody, setProfileBioBody] = useState('');
  const [profileBioImage, setProfileBioImage] = useState('');

  // Brand voice states
  const [brandVoiceSettings, setBrandVoiceSettings] = useState({
    enabled: false,
    preferredTerms: [],
    bannedPhrases: [],
    defaultDisclaimer: '',
    industry: 'general',
    customInstructions: ''
  });
  const [brandVoiceLoading, setBrandVoiceLoading] = useState(false);
  const [brandVoiceSaving, setBrandVoiceSaving] = useState(false);
  const [brandVoiceErrors, setBrandVoiceErrors] = useState([]);
  const [newPreferredTerm, setNewPreferredTerm] = useState('');
  const [newBannedPhrase, setNewBannedPhrase] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('');
  const [showPresetConfirm, setShowPresetConfirm] = useState(false);

  useEffect(() => {
    const loadUserProfile = async () => {
      if (user?.uid) {
        try {
          const profile = await getUserProfile(user.uid);
          setUserProfile(profile);
          setEmail(profile?.email || user.email || '');
          setDisplayName(profile?.name || user.displayName || '');
          setResetEmail(profile?.email || user.email || '');
          setProfileBioBody(profile?.authorBioBody || '');
          setProfileBioImage(profile?.authorBioImage || user.photoURL || '');
        } catch (error) {
          console.error('Error loading user profile:', error);
          // Fallback to Firebase user data
          setEmail(user.email || '');
          setDisplayName(user.displayName || '');
          setResetEmail(user.email || '');
          setProfileBioBody('');
          setProfileBioImage(user.photoURL || '');
        }
      }
    };
    
    loadUserProfile();
  }, [user]);

  // Redirect if not logged in
  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  // Load user branding settings
  useEffect(() => {
    if (user && tier) {
      // Load branding settings from localStorage (in a real app, this would be Firestore)
      try {
        const saved = localStorage.getItem(`branding_settings_${user.uid}`);
        if (saved) {
          const settings = JSON.parse(saved);
          setUserBrandingSettings(settings);
        } else {
          // Set default based on tier
          const defaultSetting = tier?.toLowerCase() === 'agency custom' || 
                                 tier?.toLowerCase() === 'agency';
          setUserBrandingSettings({ showBranding: defaultSetting });
        }
      } catch (error) {
        console.error('Failed to load branding settings:', error);
        // Set default based on tier
        const defaultSetting = tier?.toLowerCase() === 'agency';
        setUserBrandingSettings({ showBranding: defaultSetting });
      }
    }
  }, [user, tier]);

  // Branding preview effect - now uses user settings
  useEffect(() => {
    if (tier) {
      const preview = getBrandingPreview(tier, userBrandingSettings);
      setBrandingPreview(preview);
    }
  }, [tier, userBrandingSettings]);

  // Handle URL tab parameter
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['profile', 'password', 'reset', 'brandvoice', 'branding'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Load brand voice settings
  useEffect(() => {
    const loadBrandVoiceSettings = async () => {
      if (user?.uid && tier) {
        setBrandVoiceLoading(true);
        try {
          const settings = await getBrandVoiceSettingsWithDefaults(user.uid, tier);
          setBrandVoiceSettings(settings);
        } catch (error) {
          console.error('Error loading brand voice settings:', error);
          setBrandVoiceErrors(['Failed to load brand voice settings']);
        } finally {
          setBrandVoiceLoading(false);
        }
      }
    };

    loadBrandVoiceSettings();
  }, [user?.uid, tier]);

  const clearMessages = () => {
    setMessage('');
    setError('');
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    clearMessages();

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);

    try {
      // Re-authenticate user before password change
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);

      setMessage('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Auto logout after password change for security
      setTimeout(async () => {
        await logout();
        router.push('/login?message=password-updated');
      }, 2000);

    } catch (err) {
      console.error('Password reset error:', err);

      // Handle specific Firebase errors
      const errorMessages = {
        'auth/wrong-password': 'Current password is incorrect',
        'auth/weak-password': 'Password is too weak',
        'auth/requires-recent-login': 'Please log in again before changing your password',
        'auth/too-many-requests': 'Too many attempts. Please try again later'
      };

      setError(errorMessages[err.code] || 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    clearMessages();

    if (!resetEmail) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetSent(true);
      setMessage('Password reset email sent! Check your inbox.');
    } catch (err) {
      console.error('Forgot password error:', err);

      const errorMessages = {
        'auth/user-not-found': 'No account found with this email address',
        'auth/invalid-email': 'Please enter a valid email address',
        'auth/too-many-requests': 'Too many requests. Please try again later'
      };

      setError(errorMessages[err.code] || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    clearMessages();

    setLoading(true);

    try {
      // Update in Firestore
      await updateUserProfile(user.uid, {
        name: displayName.trim(),
        authorBioBody: profileBioBody.trim(),
        authorBioImage: profileBioImage.trim()
      });

      setMessage('Profile updated successfully!');
      
      // Reload profile data
      const updatedProfile = await getUserProfile(user.uid);
      setUserProfile(updatedProfile);
    } catch (err) {
      console.error('Profile update error:', err);
      setError('Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Function to toggle branding settings
  const handleToggleBranding = async (enabled) => {
    if (!user || !tier) return;
    
    // Check if user can control branding
    const canControlBranding = ['growth', 'scale', 'agency custom', 'agency'].includes(tier.toLowerCase());
    if (!canControlBranding) return;

    setSavingBrandingSettings(true);
    try {
      const newSettings = { ...userBrandingSettings, showBranding: enabled };
      
      // Save to localStorage (in a real app, this would be Firestore)
      localStorage.setItem(`branding_settings_${user.uid}`, JSON.stringify(newSettings));
      
      setUserBrandingSettings(newSettings);
      
      // TODO: In a real implementation, save to Firestore user settings
      // await updateUserSettings(user.uid, { branding: newSettings });
      
    } catch (error) {
      console.error('Failed to save branding settings:', error);
    } finally {
      setSavingBrandingSettings(false);
    }
  };

  // Brand voice functions
  const handleBrandVoiceToggle = async (enabled) => {
    const newSettings = { ...brandVoiceSettings, enabled };
    setBrandVoiceSettings(newSettings);
    setBrandVoiceErrors([]);
  };

  const handleAddPreferredTerm = () => {
    if (!newPreferredTerm.trim()) return;
    
    const tierConfig = brandVoiceTierConfigurations[tier?.toLowerCase()] || brandVoiceTierConfigurations.free;
    if (brandVoiceSettings.preferredTerms.length >= tierConfig.maxPreferredTerms) {
      setBrandVoiceErrors([`Maximum ${tierConfig.maxPreferredTerms} preferred terms allowed for ${tier} plan`]);
      return;
    }

    const newTerms = [...brandVoiceSettings.preferredTerms, newPreferredTerm.trim()];
    setBrandVoiceSettings({ ...brandVoiceSettings, preferredTerms: newTerms });
    setNewPreferredTerm('');
    setBrandVoiceErrors([]);
  };

  const handleRemovePreferredTerm = (index) => {
    const newTerms = brandVoiceSettings.preferredTerms.filter((_, i) => i !== index);
    setBrandVoiceSettings({ ...brandVoiceSettings, preferredTerms: newTerms });
  };

  const handleAddBannedPhrase = () => {
    if (!newBannedPhrase.trim()) return;
    
    const tierConfig = brandVoiceTierConfigurations[tier?.toLowerCase()] || brandVoiceTierConfigurations.free;
    if (brandVoiceSettings.bannedPhrases.length >= tierConfig.maxBannedPhrases) {
      setBrandVoiceErrors([`Maximum ${tierConfig.maxBannedPhrases} banned phrases allowed for ${tier} plan`]);
      return;
    }

    const newPhrases = [...brandVoiceSettings.bannedPhrases, newBannedPhrase.trim()];
    setBrandVoiceSettings({ ...brandVoiceSettings, bannedPhrases: newPhrases });
    setNewBannedPhrase('');
    setBrandVoiceErrors([]);
  };

  const handleRemoveBannedPhrase = (index) => {
    const newPhrases = brandVoiceSettings.bannedPhrases.filter((_, i) => i !== index);
    setBrandVoiceSettings({ ...brandVoiceSettings, bannedPhrases: newPhrases });
  };

  const handleApplyPreset = (presetKey) => {
    if (!industryPresets[presetKey]) return;
    
    const preset = industryPresets[presetKey];
    setBrandVoiceSettings({
      ...brandVoiceSettings,
      industry: presetKey,
      preferredTerms: [...preset.preferredTerms],
      bannedPhrases: [...preset.bannedPhrases],
      defaultDisclaimer: preset.defaultDisclaimer,
      customInstructions: preset.customInstructions
    });
    setSelectedPreset('');
    setShowPresetConfirm(false);
    setBrandVoiceErrors([]);
  };

  const handleSaveBrandVoice = async () => {
    if (!user?.uid) return;

    setBrandVoiceSaving(true);
    setBrandVoiceErrors([]);

    try {
      // Validate settings
      const validation = validateBrandVoiceSettings(brandVoiceSettings, tier);
      if (!validation.isValid) {
        setBrandVoiceErrors(validation.errors);
        return;
      }

      // Save to Firestore
      await updateBrandVoiceSettings(user.uid, brandVoiceSettings);
      setMessage('Brand voice settings saved successfully!');
      
      // 🔄 Trigger AuthContext refresh (backup for real-time listener)
      // The real-time listener should handle this automatically, but this ensures immediate UI update
      if (refreshBrandVoiceSettings) {
        await refreshBrandVoiceSettings();
        console.log('✅ Brand voice settings refreshed in AuthContext after save');
      }
      
      // Clear any existing errors
      setError('');
    } catch (error) {
      console.error('Error saving brand voice settings:', error);
      setBrandVoiceErrors(['Failed to save brand voice settings. Please try again.']);
    } finally {
      setBrandVoiceSaving(false);
    }
  };

  const handleResetBrandVoice = async () => {
    if (!user?.uid || !tier) return;

    try {
      const defaultSettings = await getBrandVoiceSettingsWithDefaults(user.uid, tier);
      setBrandVoiceSettings(defaultSettings);
      setBrandVoiceErrors([]);
    } catch (error) {
      console.error('Error resetting brand voice settings:', error);
      setBrandVoiceErrors(['Failed to reset settings']);
    }
  };

  const previewBioImage = profileBioImage?.trim() || user?.photoURL || '/images/default-avatar.png';
  const previewAuthorName = user?.displayName || user?.email || 'Your Name';
  const previewBodyHtml = profileBioBody
    ? formatBioHtml(profileBioBody)
    : formatBioHtml('Write your author bio here. Include your role, expertise, and achievements.');

  if (!user) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
<div
  className={styles.generationPage}
  style={{ background: '#f9fbff', minHeight: '100vh' }}
>
  {/* ✅ Full-Width Top Gradient Header */}
  <div
    style={{
      width: '100%',
      background: 'linear-gradient(90deg, #4f8aff 0%, #00c6ff 100%)',
      color: 'white',
      padding: '0.8rem 1.5rem', // ⬇️ reduced height more
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap', // ✅ responsive wrapping
      gap: '0.6rem',
      boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)',
      position: 'sticky',
      top: 0,
      left: 0,
      zIndex: 1000,
    }}
  >
    <div style={{ flex: '1 1 220px' }}>
      <h1
        style={{
          fontSize: 'clamp(1rem, 3vw, 1.5rem)', // ✅ smaller title
          fontWeight: '700',
          margin: 0,
        }}
      >
        Account Settings
      </h1>
      <p
        style={{
          margin: 0,
          fontSize: 'clamp(0.7rem, 2vw, 0.85rem)', // ✅ smaller subtitle
          opacity: 0.9,
        }}
      >
        Manage your profile and preferences
      </p>
    </div>

    <button
      onClick={() => router.push('/dashboard')}
      style={{
        background: 'white',
        color: '#2563eb',
        border: 'none',
        padding: '0.45rem 0.9rem', // ⬇️ reduced button height
        borderRadius: '8px',
        fontWeight: '600',
        fontSize: 'clamp(0.75rem, 2vw, 0.9rem)',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.target.style.background = '#f0f7ff';
      }}
      onMouseLeave={(e) => {
        e.target.style.background = 'white';
      }}
    >
      ← Back to Dashboard
    </button>
  </div>

  {/* ✅ Main Responsive Container */}
  <div
    className="container"
    style={{
      maxWidth: 'min(92%, 1100px)',
      margin: '1.2rem auto', // ⬇️ less space between header and section
      padding: '0 0.8rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}
  >
    <div
      className={styles.generationCard}
      style={{
        width: '100%',
        padding: 'clamp(0.8rem, 2vw, 1.5rem)', // ⬇️ reduced white section padding
        background: 'white',
        borderRadius: '10px',
        boxShadow: '0 3px 10px rgba(0,0,0,0.05)',
      }}
    >

      {/* Main Layout Wrapper */}
      <div
        style={{
          display: 'flex',
          gap: '1.2rem',
          alignItems: 'flex-start',
          maxWidth: '1200px',
          margin: '0 auto',
          flexWrap: 'wrap', // ✅ responsive stacking
        }}
      >
  {/* Sidebar Navigation */}
  <div
    style={{
      width: '250px',
      background: 'white',
      borderRadius: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
      padding: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem'
    }}
  >
    {[
      { id: 'profile', label: 'Profile Info' },
      { id: 'password', label: 'Change Password' },
      { id: 'reset', label: 'Reset Password' },
      { id: 'brandvoice', label: 'Brand Voice' },
      // Only show branding settings for non-client tier users
      ...(!isClientTier ? [{ id: 'branding', label: 'Branding Settings' }] : []),
    ].map((tab) => (
      <button
        key={tab.id}
        onClick={() => {
          setActiveTab(tab.id);
          clearMessages();
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: '0.8rem',
          padding: '0.9rem 1rem',
          background:
            activeTab === tab.id
              ? 'linear-gradient(90deg, #4f8aff 0%, #00c6ff 100%)'
              : 'transparent',
          color: activeTab === tab.id ? 'white' : '#333',
          border: 'none',
          borderRadius: '10px',
          fontWeight: activeTab === tab.id ? '600' : '500',
          fontSize: '0.9rem',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          boxShadow:
            activeTab === tab.id ? '0 4px 10px rgba(79,138,255,0.3)' : 'none'
        }}
      >
        {tab.label}
      </button>
    ))}

    {/* Help Section */}
    <div
      style={{
        marginTop: '2rem',
        padding: '1rem',
        background: 'linear-gradient(90deg, rgba(79,138,255,0.1), rgba(0,198,255,0.1))',
        borderRadius: '10px',
        textAlign: 'center',
        color: '#333',
        fontSize: '0.85rem'
      }}
    >
      <strong>Need Help?</strong>
      <p style={{ margin: '0.5rem 0 0 0', color: '#555' }}>
        Contact our support team for assistance
      </p>
    </div>
  </div>

  {/* Main Content */}
  <div
    style={{
      flex: 1,
      background: 'white',
      borderRadius: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
      padding: '2rem'
    }}
  >
    {/* Flash Messages */}
    {message && (
      <div
        style={{
          padding: '1rem',
          background: 'rgba(34,197,94,0.1)',
          border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: '8px',
          color: '#16a34a',
          marginBottom: '1rem'
        }}
      >
        {message}
      </div>
    )}

    {error && (
      <div
        style={{
          padding: '1rem',
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '8px',
          color: '#dc2626',
          marginBottom: '1rem'
        }}
      >
        {error}
      </div>
    )}

    {/* Profile Tab */}
    {activeTab === 'profile' && (
      <form onSubmit={handleUpdateProfile}>
        <h2 style={{ marginBottom: '1rem', color: '#111' }}>
          Profile Information
        </h2>
        <p style={{ marginBottom: '2rem', color: '#555', fontSize: '0.9rem' }}>
          Update your personal details and preferences.
        </p>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', color: '#444', marginBottom: '0.5rem' }}>
            Email Address
          </label>
          <input
            type="email"
            value={email}
            disabled
            style={{
              width: '100%',
              padding: '0.9rem',
              border: '1px solid #e5e7eb',
              borderRadius: '10px',
              background: '#f8fafc',
              color: '#6b7280'
            }}
          />
          <small style={{ color: '#777', fontSize: '0.8rem' }}>
            Email cannot be changed here. Contact support if needed.
          </small>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', color: '#444', marginBottom: '0.5rem' }}>
            Display Name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Enter your display name"
            style={{
              width: '100%',
              padding: '0.9rem',
              border: '1px solid #e5e7eb',
              borderRadius: '10px',
              background: '#fff'
            }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', color: '#444', marginBottom: '0.5rem' }}>
            Author Bio
          </label>
          <textarea
            value={profileBioBody}
            onChange={(e) => setProfileBioBody(e.target.value)}
            placeholder="Write your detailed author bio here"
            rows={4}
            style={{
              width: '100%',
              padding: '0.9rem',
              border: '1px solid #e5e7eb',
              borderRadius: '10px',
              background: '#fff',
              resize: 'vertical'
            }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', color: '#444', marginBottom: '0.5rem' }}>
            Author Photo URL
          </label>
          <input
            type="url"
            value={profileBioImage}
            onChange={(e) => setProfileBioImage(e.target.value)}
            placeholder="https://example.com/your-photo.jpg"
            style={{
              width: '100%',
              padding: '0.9rem',
              border: '1px solid #e5e7eb',
              borderRadius: '10px',
              background: '#fff'
            }}
          />
          <small style={{ color: '#777', fontSize: '0.8rem' }}>
            Leave blank to use your account avatar.
          </small>
        </div>

        <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#000', margin: '0 0 1.5rem 0', textAlign: 'left' }}>
            Author Bio
          </h2>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', textAlign: 'left' }}>
            <img
              src={previewBioImage}
              alt={previewAuthorName}
              style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
            />
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div
                style={{ color: '#000', fontSize: '1rem', lineHeight: 1.8, margin: 0, textAlign: 'left' }}
                dangerouslySetInnerHTML={{ __html: previewBodyHtml }}
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '0.9rem 1.8rem',
            background: 'linear-gradient(90deg, #4f8aff 0%, #00c6ff 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            transition: 'all 0.3s ease'
          }}
        >
          {loading ? 'Updating...' : 'Update Profile'}
        </button>
      </form>
    )}
      


          {/* Change Password Tab */}
          {activeTab === 'password' && (
            <form onSubmit={handlePasswordReset}>
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ color: '#333', marginBottom: '1rem' }}>Change Password</h3>
                <p style={{ color: 'rgba(51,51,51,0.7)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                  For security, you'll need to enter your current password and you'll be logged out after changing it.
                </p>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', color: 'rgba(51,51,51,0.8)', marginBottom: '0.5rem' }}>
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'rgba(255,255,255,0.8)',
                      border: '1px solid rgba(0,0,0,0.1)',
                      borderRadius: '6px',
                      color: '#333',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', color: 'rgba(51,51,51,0.8)', marginBottom: '0.5rem' }}>
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 6 characters)"
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'rgba(255,255,255,0.8)',
                      border: '1px solid rgba(0,0,0,0.1)',
                      borderRadius: '6px',
                      color: '#333',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', color: 'rgba(51,51,51,0.8)', marginBottom: '0.5rem' }}>
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'rgba(255,255,255,0.8)',
                      border: '1px solid rgba(0,0,0,0.1)',
                      borderRadius: '6px',
                      color: '#333',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'linear-gradient(135deg, #00D4FF 0%, #00A8CC 100%)',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#0A0E27',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.6 : 1
                  }}
                >
                  {loading ? 'Changing Password...' : 'Change Password'}
                </button>
              </div>
            </form>
          )}

          {/* Reset Password Tab */}
          {activeTab === 'reset' && (
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ color: '#333', marginBottom: '1rem' }}>Reset Password</h3>
              <p style={{ color: 'rgba(51,51,51,0.7)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                Forgot your password? We'll send you a reset link to your email address.
              </p>

              {!resetSent ? (
                <form onSubmit={handleForgotPassword}>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', color: 'rgba(51,51,51,0.8)', marginBottom: '0.5rem' }}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="Enter your email address"
                      required
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: 'rgba(255,255,255,0.8)',
                        border: '1px solid rgba(0,0,0,0.1)',
                        borderRadius: '6px',
                        color: '#333',
                        fontSize: '0.9rem'
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: 'linear-gradient(135deg, #00D4FF 0%, #00A8CC 100%)',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#0A0E27',
                      fontWeight: '600',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.6 : 1
                    }}
                  >
                    {loading ? 'Sending...' : 'Send Reset Email'}
                  </button>
                </form>
              ) : (
                <div style={{
                  padding: '2rem',
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <h4 style={{ color: '#16a34a', marginBottom: '1rem' }}>Reset Email Sent!</h4>
                  <p style={{ color: 'rgba(51,51,51,0.8)', marginBottom: '1rem' }}>
                    We've sent a password reset link to <strong>{resetEmail}</strong>
                  </p>
                  <p style={{ color: 'rgba(51,51,51,0.6)', fontSize: '0.9rem' }}>
                    Check your email and follow the instructions to reset your password.
                  </p>
                  <button
                    onClick={() => {
                      setResetSent(false);
                      setResetEmail(user?.email || '');
                    }}
                    style={{
                      marginTop: '1rem',
                      padding: '0.5rem 1rem',
                      background: 'transparent',
                      border: '1px solid rgba(34, 197, 94, 0.3)',
                      borderRadius: '4px',
                      color: '#16a34a',
                      cursor: 'pointer',
                      fontSize: '0.9rem'
                    }}
                  >
                    Send Another Email
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Brand Voice Tab */}
          {activeTab === 'brandvoice' && (
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ color: '#333', marginBottom: '1rem' }}>Brand Voice Settings</h3>
              <p style={{ color: 'rgba(51,51,51,0.7)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                Control how AI generates content to match your brand's voice, tone, and industry requirements.
              </p>

              {/* Agency Client Info */}
              {isClientTier && (
                <div style={{
                  padding: '1rem',
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '8px',
                  marginBottom: '1.5rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <i className="bi bi-building" style={{ color: '#2563eb', marginRight: '0.5rem' }}></i>
                    <strong style={{ color: '#2563eb' }}>Agency Client Account</strong>
                  </div>
                  <p style={{ color: 'rgba(51,51,51,0.8)', fontSize: '0.875rem', margin: 0 }}>
                    You can customize your personal brand voice settings. These settings will be applied to all content you create, 
                    while your agency manages the overall subscription and branding.
                  </p>
                </div>
              )}

              {/* Brand Voice Errors */}
              {brandVoiceErrors.length > 0 && (
                <div style={{
                  padding: '1rem',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  color: '#dc2626',
                  marginBottom: '1rem'
                }}>
                  {brandVoiceErrors.map((error, index) => (
                    <div key={index}>{error}</div>
                  ))}
                </div>
              )}

              {/* Tier Access Check */}
              {(() => {
                const tierConfig = brandVoiceTierConfigurations[tier?.toLowerCase()] || brandVoiceTierConfigurations.free;
                
                if (!tierConfig.canUseBrandVoice) {
                  return (
                    <div style={{
                      padding: '2rem',
                      background: 'rgba(255, 193, 7, 0.1)',
                      border: '1px solid rgba(255, 193, 7, 0.3)',
                      borderRadius: '8px',
                      textAlign: 'center',
                      marginBottom: '2rem'
                    }}>
                      <h4 style={{ color: '#b45309', marginBottom: '1rem' }}>Brand Voice Not Available</h4>
                      <p style={{ color: 'rgba(51,51,51,0.8)', marginBottom: '1rem' }}>
                        Brand voice controls are available for Growth plans and higher.
                      </p>
                      <p style={{ color: 'rgba(51,51,51,0.6)', fontSize: '0.9rem' }}>
                        Upgrade your plan to customize your AI's tone, preferred terms, and industry-specific language.
                      </p>
                    </div>
                  );
                }

                return (
                  <div>
                    {/* Brand Voice Toggle */}
                    <div style={{
                      background: 'rgba(59, 130, 246, 0.05)',
                      border: '1px solid rgba(59, 130, 246, 0.1)',
                      borderRadius: '8px',
                      padding: '1.5rem',
                      marginBottom: '2rem'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        marginBottom: '1rem'
                      }}>
                        <label style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          cursor: 'pointer',
                          fontSize: '1rem',
                          color: '#333',
                          fontWeight: '600'
                        }}>
                          <input
                            type="checkbox"
                            checked={brandVoiceSettings.enabled}
                            onChange={(e) => handleBrandVoiceToggle(e.target.checked)}
                            style={{
                              width: '18px',
                              height: '18px',
                              accentColor: '#3b82f6',
                              cursor: 'pointer'
                            }}
                          />
                          <span>Enable Brand Voice Controls</span>
                        </label>
                      </div>
                      <p style={{
                        color: 'rgba(51,51,51,0.7)',
                        fontSize: '0.875rem',
                        margin: 0
                      }}>
                        When enabled, AI will follow your brand voice rules for all content generation.
                      </p>
                    </div>

                    {/* Brand Voice Settings (only show if enabled) */}
                    {brandVoiceSettings.enabled && (
                      <div>
                        {/* Industry Preset Selector */}
                        <div style={{ marginBottom: '2rem' }}>
                          <h4 style={{ color: '#333', marginBottom: '0.5rem' }}>Industry Preset</h4>
                          <p style={{ color: 'rgba(51,51,51,0.7)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                            Choose a preset that matches your industry for pre-configured voice settings.
                          </p>
                          <select
                            value={brandVoiceSettings.industry}
                            onChange={(e) => {
                              const industry = e.target.value;
                              if (industry !== brandVoiceSettings.industry && industryPresets[industry]) {
                                setSelectedPreset(industry);
                                setShowPresetConfirm(true);
                              } else {
                                setBrandVoiceSettings({ ...brandVoiceSettings, industry });
                              }
                            }}
                            style={{
                              width: '100%',
                              padding: '0.75rem',
                              background: 'rgba(255,255,255,0.8)',
                              border: '1px solid rgba(0,0,0,0.1)',
                              borderRadius: '6px',
                              color: '#333',
                              fontSize: '0.9rem'
                            }}
                          >
                            {Object.entries(industryPresets)
                              .filter(([key]) => tierConfig.availableIndustries.includes(key))
                              .map(([key, preset]) => (
                                <option key={key} value={key}>
                                  {preset.name} - {preset.description}
                                </option>
                              ))}
                          </select>

                          {/* Preset Confirmation Dialog */}
                          {showPresetConfirm && (
                            <div style={{
                              marginTop: '1rem',
                              padding: '1rem',
                              background: 'rgba(255, 193, 7, 0.1)',
                              border: '1px solid rgba(255, 193, 7, 0.3)',
                              borderRadius: '6px'
                            }}>
                              <p style={{ color: '#b45309', marginBottom: '1rem', fontSize: '0.875rem' }}>
                                <strong>Apply "{industryPresets[selectedPreset]?.name}" preset?</strong><br />
                                This will replace your current preferred terms, banned phrases, and custom instructions.
                              </p>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                  onClick={() => handleApplyPreset(selectedPreset)}
                                  style={{
                                    padding: '0.5rem 1rem',
                                    background: '#3b82f6',
                                    border: 'none',
                                    borderRadius: '4px',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem'
                                  }}
                                >
                                  Apply Preset
                                </button>
                                <button
                                  onClick={() => {
                                    setShowPresetConfirm(false);
                                    setSelectedPreset('');
                                  }}
                                  style={{
                                    padding: '0.5rem 1rem',
                                    background: 'transparent',
                                    border: '1px solid rgba(0,0,0,0.2)',
                                    borderRadius: '4px',
                                    color: '#333',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem'
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Preferred Terms */}
                        <div style={{ marginBottom: '2rem' }}>
                          <h4 style={{ color: '#333', marginBottom: '0.5rem' }}>
                            Preferred Terms ({brandVoiceSettings.preferredTerms.length}/{tierConfig.maxPreferredTerms})
                          </h4>
                          <p style={{ color: 'rgba(51,51,51,0.7)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                            Terms and phrases you want AI to use when possible.
                          </p>
                          
                          {/* Add New Term */}
                          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                            <input
                              type="text"
                              value={newPreferredTerm}
                              onChange={(e) => setNewPreferredTerm(e.target.value)}
                              placeholder="Add preferred term..."
                              onKeyPress={(e) => e.key === 'Enter' && handleAddPreferredTerm()}
                              style={{
                                flex: 1,
                                padding: '0.5rem',
                                border: '1px solid rgba(0,0,0,0.1)',
                                borderRadius: '4px',
                                fontSize: '0.875rem'
                              }}
                            />
                            <button
                              onClick={handleAddPreferredTerm}
                              disabled={brandVoiceSettings.preferredTerms.length >= tierConfig.maxPreferredTerms}
                              style={{
                                padding: '0.5rem 1rem',
                                background: '#3b82f6',
                                border: 'none',
                                borderRadius: '4px',
                                color: 'white',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                                opacity: brandVoiceSettings.preferredTerms.length >= tierConfig.maxPreferredTerms ? 0.5 : 1
                              }}
                            >
                              Add
                            </button>
                          </div>

                          {/* Terms List */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {brandVoiceSettings.preferredTerms.map((term, index) => (
                              <div
                                key={index}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  padding: '0.25rem 0.5rem',
                                  background: 'rgba(34, 197, 94, 0.1)',
                                  border: '1px solid rgba(34, 197, 94, 0.3)',
                                  borderRadius: '4px',
                                  fontSize: '0.875rem'
                                }}
                              >
                                <span>{term}</span>
                                <button
                                  onClick={() => handleRemovePreferredTerm(index)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#16a34a',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem',
                                    padding: '0.125rem'
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Banned Phrases */}
                        <div style={{ marginBottom: '2rem' }}>
                          <h4 style={{ color: '#333', marginBottom: '0.5rem' }}>
                            Banned Phrases ({brandVoiceSettings.bannedPhrases.length}/{tierConfig.maxBannedPhrases})
                          </h4>
                          <p style={{ color: 'rgba(51,51,51,0.7)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                            Terms and phrases AI should never use in your content.
                          </p>
                          
                          {/* Add New Phrase */}
                          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                            <input
                              type="text"
                              value={newBannedPhrase}
                              onChange={(e) => setNewBannedPhrase(e.target.value)}
                              placeholder="Add banned phrase..."
                              onKeyPress={(e) => e.key === 'Enter' && handleAddBannedPhrase()}
                              style={{
                                flex: 1,
                                padding: '0.5rem',
                                border: '1px solid rgba(0,0,0,0.1)',
                                borderRadius: '4px',
                                fontSize: '0.875rem'
                              }}
                            />
                            <button
                              onClick={handleAddBannedPhrase}
                              disabled={brandVoiceSettings.bannedPhrases.length >= tierConfig.maxBannedPhrases}
                              style={{
                                padding: '0.5rem 1rem',
                                background: '#ef4444',
                                border: 'none',
                                borderRadius: '4px',
                                color: 'white',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                                opacity: brandVoiceSettings.bannedPhrases.length >= tierConfig.maxBannedPhrases ? 0.5 : 1
                              }}
                            >
                              Add
                            </button>
                          </div>

                          {/* Phrases List */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {brandVoiceSettings.bannedPhrases.map((phrase, index) => (
                              <div
                                key={index}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  padding: '0.25rem 0.5rem',
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  borderRadius: '4px',
                                  fontSize: '0.875rem'
                                }}
                              >
                                <span>{phrase}</span>
                                <button
                                  onClick={() => handleRemoveBannedPhrase(index)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#dc2626',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem',
                                    padding: '0.125rem'
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Default Disclaimer */}
                        {tierConfig.canUseDisclaimer && (
                          <div style={{ marginBottom: '2rem' }}>
                            <h4 style={{ color: '#333', marginBottom: '0.5rem' }}>Default Disclaimer</h4>
                            <p style={{ color: 'rgba(51,51,51,0.7)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                              Disclaimer text to include in your content for legal protection.
                            </p>
                            <textarea
                              value={brandVoiceSettings.defaultDisclaimer}
                              onChange={(e) => setBrandVoiceSettings({ ...brandVoiceSettings, defaultDisclaimer: e.target.value })}
                              placeholder="e.g., This content is for educational purposes only..."
                              rows={3}
                              style={{
                                width: '100%',
                                padding: '0.75rem',
                                border: '1px solid rgba(0,0,0,0.1)',
                                borderRadius: '6px',
                                fontSize: '0.875rem',
                                resize: 'vertical'
                              }}
                            />
                          </div>
                        )}

                        {/* Custom Instructions */}
                        {tierConfig.canUseCustomInstructions && (
                          <div style={{ marginBottom: '2rem' }}>
                            <h4 style={{ color: '#333', marginBottom: '0.5rem' }}>Custom Instructions</h4>
                            <p style={{ color: 'rgba(51,51,51,0.7)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                              Additional tone and style guidelines for AI content generation.
                            </p>
                            <textarea
                              value={brandVoiceSettings.customInstructions}
                              onChange={(e) => setBrandVoiceSettings({ ...brandVoiceSettings, customInstructions: e.target.value })}
                              placeholder="e.g., Use a conversational tone, avoid jargon, focus on practical examples..."
                              rows={4}
                              style={{
                                width: '100%',
                                padding: '0.75rem',
                                border: '1px solid rgba(0,0,0,0.1)',
                                borderRadius: '6px',
                                fontSize: '0.875rem',
                                resize: 'vertical'
                              }}
                            />
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                          <button
                            onClick={handleSaveBrandVoice}
                            disabled={brandVoiceSaving}
                            style={{
                              padding: '0.75rem 1.5rem',
                              background: 'linear-gradient(135deg, #00D4FF 0%, #00A8CC 100%)',
                              border: 'none',
                              borderRadius: '6px',
                              color: '#0A0E27',
                              fontWeight: '600',
                              cursor: brandVoiceSaving ? 'not-allowed' : 'pointer',
                              opacity: brandVoiceSaving ? 0.6 : 1,
                              fontSize: '0.9rem'
                            }}
                          >
                            {brandVoiceSaving ? 'Saving...' : 'Save Brand Voice Settings'}
                          </button>
                          
                          <button
                            onClick={handleResetBrandVoice}
                            style={{
                              padding: '0.75rem 1.5rem',
                              background: 'transparent',
                              border: '1px solid rgba(0,0,0,0.2)',
                              borderRadius: '6px',
                              color: '#333',
                              cursor: 'pointer',
                              fontSize: '0.9rem'
                            }}
                          >
                            Reset to Defaults
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Branding Settings Tab */}
          {activeTab === 'branding' && (
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ color: '#333', marginBottom: '1rem' }}>Branding Settings</h3>
              <p style={{ color: 'rgba(51,51,51,0.7)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                Control whether "Powered by QueryFuel" branding appears on your published articles.
              </p>

              {brandingPreview && (
                <div style={{
                  background: 'rgba(59, 130, 246, 0.05)',
                  border: '1px solid rgba(59, 130, 246, 0.1)',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  marginBottom: '1.5rem'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    marginBottom: '1rem'
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M12 6v6l4 2"/>
                    </svg>
                    <h4 style={{
                      color: '#333',
                      fontSize: '1rem',
                      fontWeight: '600',
                      margin: 0
                    }}>
                      Current Plan: {tier || 'Free'}
                    </h4>
                  </div>
                  
                  <p style={{
                    color: 'rgba(51,51,51,0.8)',
                    fontSize: '0.875rem',
                    marginBottom: '1rem',
                    lineHeight: '1.5'
                  }}>
                    {brandingPreview.message}
                  </p>
                  
                  {/* Branding Toggle Control */}
                  {brandingPreview.canDisable && (
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.75rem',
                      padding: '1rem',
                      background: 'rgba(255, 255, 255, 0.5)',
                      borderRadius: '6px',
                      border: '1px solid rgba(59, 130, 246, 0.1)'
                    }}>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        color: '#333',
                        fontWeight: '500'
                      }}>
                        <input
                          type="checkbox"
                          checked={userBrandingSettings.showBranding === true}
                          onChange={(e) => handleToggleBranding(e.target.checked)}
                          disabled={savingBrandingSettings}
                          style={{
                            width: '16px',
                            height: '16px',
                            accentColor: '#3b82f6',
                            cursor: 'pointer'
                          }}
                        />
                        <span>Show "Powered by QueryFuel" branding on published articles</span>
                      </label>
                      {savingBrandingSettings && (
                        <div style={{
                          width: '16px',
                          height: '16px',
                          border: '2px solid rgba(59, 130, 246, 0.3)',
                          borderTop: '2px solid #3b82f6',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite'
                        }} />
                      )}
                    </div>
                  )}
                  
                  {!brandingPreview.canDisable && (
                    <div style={{
                      padding: '1rem',
                      background: 'rgba(255, 193, 7, 0.1)',
                      border: '1px solid rgba(255, 193, 7, 0.3)',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      color: '#b45309'
                    }}>
                      <strong>Upgrade Required:</strong> Upgrade to Growth plan or higher to control branding settings.
                    </div>
                  )}

                  {/* Branding Preview */}
                  {brandingPreview.brandingHtml && (
                    <div style={{
                      marginTop: '1rem',
                      padding: '1rem',
                      background: 'rgba(255, 255, 255, 0.8)',
                      border: '1px solid rgba(0, 0, 0, 0.1)',
                      borderRadius: '6px'
                    }}>
                      <h5 style={{
                        color: '#333',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        marginBottom: '0.5rem'
                      }}>
                        Preview:
                      </h5>
                      <div 
                        dangerouslySetInnerHTML={{ __html: brandingPreview.brandingHtml }}
                        style={{ fontSize: '0.875rem' }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Add CSS for spin animation */}
              <style jsx>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          )}
  </div>
        </div>
         
        </div>
      </div> 
    </div> 
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading...</p>
      </div>
    }>
      <ProfilePageContent />
    </Suspense>
  );
}