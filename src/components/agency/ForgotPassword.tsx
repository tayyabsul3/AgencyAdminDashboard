"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {  sendPasswordResetEmail } from "firebase/auth";
import { toast } from "sonner";
import { auth } from "@/lib/firebase";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [error, setError] = useState("");
  
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!email) {
      setError("Please enter your email address");
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setIsLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setIsEmailSent(true);
      toast.success("Password reset email sent!");
    } catch (error: any) {
      console.error("Password reset error:", error);
      
      // Don't reveal if email exists for security
      if (error.code === 'auth/user-not-found') {
        // Still show success for security reasons
        setIsEmailSent(true);
      } else if (error.code === 'auth/invalid-email') {
        setError("Please enter a valid email address");
      } else if (error.code === 'auth/too-many-requests') {
        setError("Too many attempts. Please try again later.");
      } else {
        setError("Failed to send reset email. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToSignIn = () => {
    router.push("/signin");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header Section */}
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <span className="text-white font-bold text-2xl">Q</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Forgot Password
          </h1>
          <p className="text-gray-600 text-lg">
            {isEmailSent 
              ? "Check your email for reset instructions" 
              : "Enter your email to reset your password"
            }
          </p>
        </div>

        {/* Form Section */}
        <div className="p-8 border border-gray-200 rounded-2xl bg-white shadow-xl"
             style={{
               background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.95) 100%)'
             }}>
          
          {!isEmailSent ? (
            <>
              {error && (
                <div className="p-4 mb-6 text-red-700 bg-red-50 rounded-xl border border-red-200">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span className="font-medium">{error}</span>
                  </div>
                </div>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Email Field */}
                <div>
                  <label className="block font-bold text-gray-900 mb-3 text-lg">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                      </svg>
                    </div>
                    <input
                      type="email"
                      placeholder="Enter your email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      className="w-full pl-12 pr-4 py-4 text-gray-700 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-lg"
                      required
                    />
                  </div>
                </div>

                {/* Send Reset Link Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-4 text-white font-bold rounded-xl transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-lg"
                  style={{
                    background: 'linear-gradient(135deg, #6aa6ff 0%, #6c71ff 50%, #6de0ff 100%)',
                    boxShadow: '0 8px 25px rgba(76, 110, 245, 0.4)'
                  }}
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Sending...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-3">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span>Send Reset Link</span>
                    </div>
                  )}
                </button>
              </form>
            </>
          ) : (
            /* Success State */
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-gray-900">
                  Check Your Email
                </h3>
                <p className="text-gray-600">
                  We've sent password reset instructions to:
                </p>
                <p className="font-bold text-blue-600 text-lg">{email}</p>
                <p className="text-gray-500 text-sm">
                  The link will expire in 1 hour. Don't forget to check your spam folder.
                </p>
              </div>

              <div className="space-y-4 pt-4">
                <button
                  onClick={handleBackToSignIn}
                  className="w-full py-4 text-white font-bold rounded-xl transition-all duration-200 transform hover:scale-[1.02] text-lg"
                  style={{
                    background: 'linear-gradient(135deg, #6aa6ff 0%, #6c71ff 50%, #6de0ff 100%)',
                    boxShadow: '0 8px 25px rgba(76, 110, 245, 0.4)'
                  }}
                >
                  Back to Sign In
                </button>
                
                <button
                  onClick={() => setIsEmailSent(false)}
                  className="w-full py-3 border-2 border-gray-300 bg-white text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all duration-200"
                >
                  Try Different Email
                </button>
              </div>
            </div>
          )}

          {/* Back to Sign In Link */}
          {!isEmailSent && (
            <div className="mt-6 text-center">
              <button
                onClick={handleBackToSignIn}
                className="text-blue-600 hover:text-blue-700 font-medium text-lg transition-colors"
              >
                ← Back to Sign In
              </button>
            </div>
          )}
        </div>

        {/* Help Text */}
        <div className="text-center text-sm text-gray-500">
          <p>Enter your email address and we'll send you a link to reset your password.</p>
        </div>
      </div>
    </div>
  );
}