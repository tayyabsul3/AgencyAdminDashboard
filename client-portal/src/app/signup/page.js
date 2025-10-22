'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import AuthForm from '../../components/AuthForm/AuthForm';
import Link from 'next/link';
import LandingNavbar from '../../components/LandingNavbar/LandingNavbar';

export default function SignupPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { signup, user } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const handleSignup = async (formData) => {
    setLoading(true);
    setError('');

    try {
      const result = await signup(formData.email, formData.password, formData.name);
      
      if (result.error) {
        // Map Firebase errors to user-friendly messages
        const errorMessages = {
          'Firebase: Error (auth/email-already-in-use).': 'An account with this email already exists.',
          'Firebase: Error (auth/weak-password).': 'Password should be at least 6 characters long.',
          'Firebase: Error (auth/invalid-email).': 'Please enter a valid email address.',
          'Firebase: Error (auth/operation-not-allowed).': 'Account creation is currently disabled.',
        };
        
        setError(errorMessages[result.error] || 'Failed to create account. Please try again.');
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

  return (
    <main className="position-relative bg-light overflow-hidden d-flex flex-column min-vh-100">
      {/* Top nav: reusable component */}
      <LandingNavbar containerClass="mt-2 mb-2" showDrawer={false} />

      {/* Signup content: keep only the inner form card */}
      <section className="pt-1 flex-grow-1">
        <div
          className="container d-flex justify-content-center align-items-center"
          style={{ minHeight: 'calc(100vh - 120px)' }}
        >
          <div className="w-100" style={{ maxWidth: '440px' }}>
            <AuthForm
              mode="signup"
              onSubmit={handleSignup}
              loading={loading}
              error={error}
            />
          </div>
        </div>
      </section>
    </main>
  );
}