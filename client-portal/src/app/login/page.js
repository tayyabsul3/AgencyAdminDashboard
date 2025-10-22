'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import AuthForm from '../../components/AuthForm/AuthForm';
import Link from 'next/link';
import LandingNavbar from '../../components/LandingNavbar/LandingNavbar';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const router = useRouter();
  const { login, user } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  // Check for URL parameters (password reset success, etc.)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const message = urlParams.get('message');

    if (message === 'password-updated') {
      setSuccessMessage('Password updated successfully! Please log in with your new password.');
      // Clean up the URL
      router.replace('/login', undefined, { shallow: true });
    }
  }, [router]);

  const handleLogin = async (formData) => {
    setLoading(true);
    setError('');

    try {
      const result = await login(formData.email, formData.password);

      if (result.error) {
        // Map Firebase errors to user-friendly messages
        const errorMessages = {
          'Firebase: Error (auth/user-not-found).': 'No account found with this email address.',
          'Firebase: Error (auth/wrong-password).': 'Incorrect password. Please try again.',
          'Firebase: Error (auth/invalid-email).': 'Please enter a valid email address.',
          'Firebase: Error (auth/too-many-requests).': 'Too many failed attempts. Please try again later.',
          'Firebase: Error (auth/user-disabled).': 'This account has been disabled.',
          'Firebase: Error (auth/invalid-credential).': 'Invalid email or password. Please check your credentials.'
        };

        setError(errorMessages[result.error] || 'Login failed. Please try again.');
      } else {
        // Success - user will be redirected by useEffect
        router.push('/dashboard');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (formData) => {
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      await sendPasswordResetEmail(auth, formData.email);
      setSuccessMessage('Password reset email sent! Check your inbox and follow the instructions.');
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

  return (
    <main className="position-relative bg-light overflow-hidden d-flex flex-column min-vh-100">
      {/* Top nav: reusable component */}
      <LandingNavbar containerClass="mt-2 mb-2" showDrawer={false} />

      {/* Login content: centered form card */}
      <section className="pt-1 flex-grow-1">
        <div
          className="container d-flex justify-content-center align-items-center"
          style={{ minHeight: 'calc(100vh - 120px)' }}
        >
          <div className="w-100" style={{ maxWidth: '440px' }}>
            <AuthForm
              mode="login"
              onSubmit={handleLogin}
              onForgotPassword={handleForgotPassword}
              loading={loading}
              error={error}
              successMessage={successMessage}
            />
          </div>
        </div>
      </section>
    </main>
  );
}