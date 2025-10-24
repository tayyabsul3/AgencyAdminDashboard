'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './AuthForm.module.css';

const AuthForm = ({ mode = 'login', onSubmit, loading = false, error = null, successMessage = null, onForgotPassword }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: ''
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [isForgotPassword, setIsForgotPassword] = useState(false);

  const isLogin = mode === 'login';
  const title = isForgotPassword ? 'QueryFuel Reset Password' : (isLogin ? 'Welcome Back' : 'Create Account');
  const subtitle = isForgotPassword ? 'Enter your email to receive a password reset link' : (isLogin ? 'Sign in to continue to QueryFuel' : 'Sign up to start creating AI-friendly articles in minutes.');
  const buttonText = isForgotPassword ? 'Send Reset Email' : (isLogin ? 'Sign In' : 'Create Account');

  // Animations removed per request

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    // Only validate password fields if not in forgot password mode
    if (!isForgotPassword) {
      if (!formData.password) {
        errors.password = 'Password is required';
      } else if (formData.password.length < 6) {
        errors.password = 'Password must be at least 6 characters';
      }

      if (!isLogin) {
        if (!formData.name) {
          errors.name = 'Name is required';
        } else if (formData.name.length < 2) {
          errors.name = 'Name must be at least 2 characters';
        }
        
        if (!formData.confirmPassword) {
          errors.confirmPassword = 'Please confirm your password';
        } else if (formData.password !== formData.confirmPassword) {
          errors.confirmPassword = 'Passwords do not match';
        }
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear field error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (isForgotPassword && onForgotPassword) {
      onForgotPassword(formData);
    } else {
      onSubmit(formData);
    }
  };

  return (
    <div className={`${styles.container} mt-0`}>
      <div className={styles.bgAnimation}></div>
      <div className={`${styles.card} auth-form-card rounded-4 shadow-lg border border-1 py-5`}> 
        <div className={styles.header}>
          <h1 className={`${styles.title} d-flex align-items-center justify-content-center gap-1 mb-2 ms-n1`}>
            {!isForgotPassword && (
              <img
                src="/images/Queryfuel logo.svg"
                alt="QueryFuel"
                width={26}
                height={26}
                className="me-1"
                style={{ display: 'inline-block' }}
              />
            )}
            {title}
          </h1>
          <p className={`${styles.subtitle} mb-2`}>{subtitle}</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {!isLogin && !isForgotPassword && (
            <div className={`${styles.inputGroup} mb-3`}>
              <label htmlFor="name" className={`${styles.label} form-label fw-semibold fs-6`}>
                Full Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={formData.name}
                onChange={handleInputChange}
                className={`form-control form-control-lg ${styles.input} ${fieldErrors.name ? styles.inputError : ''}`}
                placeholder="Enter your full name"
              />

              {fieldErrors.name && (
                <div className={styles.errorMessage}>{fieldErrors.name}</div>
              )}
            </div>
          )}

          <div className={`${styles.inputGroup} mb-3`}>
            <label htmlFor="email" className={`${styles.label} form-label fw-semibold fs-6`}>
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={formData.email}
              onChange={handleInputChange}
              className={`form-control form-control-lg ${styles.input} ${fieldErrors.email ? styles.inputError : ''}`}
              placeholder="Enter your email address"
            />

            {fieldErrors.email && (
              <div className={styles.errorMessage}>{fieldErrors.email}</div>
            )}
          </div>

          {!isForgotPassword && (
            <>
              <div className={`${styles.inputGroup} mb-3`}>
                <label htmlFor="password" className={`${styles.label} form-label fw-semibold fs-6`}>
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className={`form-control form-control-lg ${styles.input} ${fieldErrors.password ? styles.inputError : ''}`}
                  placeholder="Enter your password"
                />

                {fieldErrors.password && (
                  <div className={styles.errorMessage}>{fieldErrors.password}</div>
                )}
              </div>

              {!isLogin && (
                <div className={`${styles.inputGroup} mb-3`}>
                  <label htmlFor="confirmPassword" className={`${styles.label} form-label fw-semibold fs-6`}>
                    Confirm password
                  </label>
                  <input
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className={`form-control form-control-lg ${styles.input} ${fieldErrors.confirmPassword ? styles.inputError : ''}`}
                    placeholder="Confirm your password"
                  />

                  {fieldErrors.confirmPassword && (
                    <div className={styles.errorMessage}>{fieldErrors.confirmPassword}</div>
                  )}
                </div>
              )}
            </>
          )}

          {successMessage && (
            <div style={{
              textAlign: 'center',
              marginBottom: '1rem',
              padding: '1rem',
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              borderRadius: '8px',
              color: '#16a34a',
              fontSize: '0.9rem'
            }}>
              {successMessage}
            </div>
          )}

          {error && (
            <div className={styles.errorMessage} style={{ textAlign: 'center', marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn text-white d-inline-flex align-items-center gap-2 fw-semibold align-self-center"
            style={{
              width: '277px',
              height: '56px',
              background: 'linear-gradient(135deg, #6aa6ff 0%, #6c71ff 50%, #6de0ff 100%)',
              boxShadow: '0 6px 18px rgba(76, 110, 245, 0.35)',
              padding: '14px 24px',
              borderRadius: '8px',
              border: '4px solid transparent',
              justifyContent: 'center',
              fontSize: '16px',
              lineHeight: '24px'
            }}
          >
            {loading && <div className={styles.spinner}></div>}
            {!loading && <i className="bi bi-rocket-takeoff"></i>}
            {loading ? 'Please wait...' : buttonText}
          </button>
        </form>

        {/* Forgot Password / Back to Login Links */}
        {isLogin && !isForgotPassword && (
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={() => setIsForgotPassword(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#3b82f6',
                cursor: 'pointer',
                fontSize: '0.9rem',
                textDecoration: 'underline'
              }}
            >
              Forgot your password?
            </button>
          </div>
        )}

        {isForgotPassword && (
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={() => setIsForgotPassword(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#3b82f6',
                cursor: 'pointer',
                fontSize: '0.9rem',
                textDecoration: 'underline'
              }}
            >
              ← Back to Login
            </button>
          </div>
        )}

        <div className={styles.footer}>
          {!isForgotPassword && (
            <p className={styles.footerText}>
              {isLogin ? "" : "Already have an account? "}
              <Link
                href="/login"
                className={styles.footerLink}
              >
                Sign in here
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthForm;