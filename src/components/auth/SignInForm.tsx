"use client";
import Checkbox from "@/components/form/input/Checkbox";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { ChevronLeftIcon, EyeCloseIcon, EyeIcon } from "@/icons";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/Firebase";
import { 
  signInWithEmailAndPassword, 
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword
} from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useAppDispatch } from "@/redux/hooks";
import { setAgencyData } from "@/redux/slices/agencySlice";
import { setClientData } from "@/redux/slices/clientSlice";
import { toast } from "sonner";

export default function SignInForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasUser, setHasUser] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentLink, setPaymentLink] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [passwordChangeModal, setPasswordChangeModal] = useState(false);
  const [passwordChangeData, setPasswordChangeData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  const dispatch = useAppDispatch();
  
  useEffect(() => {
    const user = localStorage.getItem("user");
    setHasUser(!!user);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePasswordChangeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordChangeData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const checkSubscriptionStatus = async (userType: 'agency' | 'client', userId: string, agencyId?: string) => {
    try {
      if (userType === 'agency') {
        const agencyRef = doc(db, "agencies", userId);
        const agencySnap = await getDoc(agencyRef);
        
        if (agencySnap.exists()) {
          const agencyData = agencySnap.data();
          const subscriptionStatus = agencyData.subscription?.status;
          const paymentLink = agencyData?.paymentLink;
          const agencyName = agencyData.agencyName;
          
          if (subscriptionStatus !== 'paid') {
            setPaymentLink(paymentLink || '');
            setAgencyName(agencyName || 'Your Agency');
            return false;
          }
          return true;
        }
      } else if (userType === 'client' && agencyId) {
        const agencyRef = doc(db, "agencies", agencyId);
        const agencySnap = await getDoc(agencyRef);
        
        if (agencySnap.exists()) {
          const agencyData = agencySnap.data();
          const subscriptionStatus = agencyData.subscription?.status;
          const paymentLink = agencyData.subscription?.paymentLink;
          const agencyName = agencyData.agencyName;
          
          if (subscriptionStatus !== 'paid') {
            setPaymentLink(paymentLink || '');
            setAgencyName(agencyName || 'The Agency');
            return false;
          }
          return true;
        }
      }
      
      return true;
    } catch (error) {
      console.error("Error checking subscription status:", error);
      return true;
    }
  };

  const handleSubmit = async () => {
    setError("");
    setIsLoading(true);
    setShowPaymentModal(false);
    setPasswordChangeModal(false);

    if (!formData.email || !formData.password) {
      setError("Please fill in all fields");
      setIsLoading(false);
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );
      const user = userCredential.user;
      setCurrentUser(user);

      const agencyRef = doc(db, "agencies", user.uid);
      const agencySnap = await getDoc(agencyRef);

      if (agencySnap.exists()) {
        const agencyData = agencySnap.data();
        // alert(agencyData.isFirstLogin)
        // Check if it's first time login
        if (agencyData?.isFirstLogin) {
          setPasswordChangeModal(true);
          setIsLoading(false);
          return;
        }
        
        const isSubscriptionPaid = await checkSubscriptionStatus('agency', user.uid);
        
        if (!isSubscriptionPaid) {
          toast.error("Subscription payment required");
          setShowPaymentModal(true);
          setIsLoading(false);
          return;
        }
        
        dispatch(
          setAgencyData({
            agencyId: agencyData.agencyId,
            ownerId: agencyData.ownerId,
            agencyName: agencyData.agencyName,
            email: agencyData.email,
            subscription: agencyData.subscription,
            clients: agencyData.clients || [],
          })
        );

        localStorage.setItem("user", JSON.stringify(user.uid));
        localStorage.setItem("userType", "agency");

        console.log("Signed in as Agency:", agencyData);
        toast.success("Welcome back to your agency!");
        router.push("/");
        
      } else {
        const clientRef = doc(db, "subscriptions", user.uid);
        const clientSnap = await getDoc(clientRef);

        if (clientSnap.exists()) {
          const clientData = clientSnap.data();
          
          const isSubscriptionPaid = await checkSubscriptionStatus('client', user.uid, clientData.agencyId);
          
          if (!isSubscriptionPaid) {
            toast.error("Agency subscription payment required");
            setShowPaymentModal(true);
            setIsLoading(false);
            return;
          }

          const clientAgencyRef = doc(db, "agencies", clientData.agencyId);
          const clientAgencySnap = await getDoc(clientAgencyRef);
          const agencyData = clientAgencySnap.exists() ? clientAgencySnap.data() : null;

          dispatch(
            setClientData({
              userId: clientData.userId,
              email: clientData.email,
              name: clientData.name,
              ownerId: clientData.ownerId,
              agencyId: clientData.agencyId,
              agencyName: clientData.agencyName,
              status: clientData.status,
              tier: clientData.tier,
              articlesGenerated: clientData.articlesGenerated,
              agencySubscription: agencyData?.subscription || null
            })
          );

          localStorage.setItem("user", JSON.stringify(user.uid));
          localStorage.setItem("userType", "client");

          console.log("Signed in as Client:", clientData);
          toast.success("Welcome back!");
          router.push("/");
          
        } else {
          throw new Error("No agency or client account found for this user");
        }
      }

    } catch (err: any) {
      console.error("Sign in error:", err);
      setError(err.message || "Failed to sign in");
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordChangeLoading(true);
    
    try {
      const { currentPassword, newPassword, confirmPassword } = passwordChangeData;

      if (!currentPassword || !newPassword || !confirmPassword) {
        toast.error("Please fill in all fields");
        setPasswordChangeLoading(false);
        return;
      }

      if (newPassword !== confirmPassword) {
        toast.error("New passwords don't match");
        setPasswordChangeLoading(false);
        return;
      }

      if (newPassword.length < 6) {
        toast.error("Password must be at least 6 characters long");
        setPasswordChangeLoading(false);
        return;
      }

      // Re-authenticate user with current password
      const credential = EmailAuthProvider.credential(
        currentUser.email, 
        currentPassword
      );
      
      await reauthenticateWithCredential(currentUser, credential);
      
      // Update password
      await updatePassword(currentUser, newPassword);
      
      // Update Firestore to mark first login as completed
      const agencyRef = doc(db, "agencies", currentUser.uid);
      await updateDoc(agencyRef, {
        isFirstLogin: false
      });

      toast.success("Password changed successfully!");
      
      // Refresh the agency data and proceed
      const agencySnap = await getDoc(agencyRef);
      if (agencySnap.exists()) {
        const agencyData = agencySnap.data();
        
        const isSubscriptionPaid = await checkSubscriptionStatus('agency', currentUser.uid);
        
        if (!isSubscriptionPaid) {
          setPasswordChangeModal(false);
          setShowPaymentModal(true);
          setPasswordChangeLoading(false);
          return;
        }
        
        dispatch(
          setAgencyData({
            agencyId: agencyData.agencyId,
            ownerId: agencyData.ownerId,
            agencyName: agencyData.agencyName,
            email: agencyData.email,
            subscription: agencyData.subscription,
            clients: agencyData.clients || [],
          })
        );

        localStorage.setItem("user", JSON.stringify(currentUser.uid));
        localStorage.setItem("userType", "agency");

        setPasswordChangeModal(false);
        toast.success("Welcome to your agency!");
        router.push("/");
      }
      
    } catch (error: any) {
      console.error("Password change error:", error);
      
      if (error.code === 'auth/wrong-password') {
        toast.error("Current password is incorrect");
      } else if (error.code === 'auth/weak-password') {
        toast.error("Password is too weak");
      } else {
        toast.error(error.message || "Failed to change password");
      }
    } finally {
      setPasswordChangeLoading(false);
    }
  };

  const handleCopyPaymentLink = () => {
    if (paymentLink) {
      navigator.clipboard.writeText(paymentLink);
      toast.success("Payment link copied to clipboard!");
    }
  };

  const handleOpenPaymentLink = () => {
    if (paymentLink) {
      window.open(paymentLink, '_blank');
    }
  };

  return (
    <div className="flex flex-col flex-1 lg:w-1/2 w-full">
      <div className="flex flex-col justify-center flex-1 w-full max-w-lg mx-auto">
        <div>
          {/* Header Section */}
          <div className="mb-12 text-center">
            <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <span className="text-white font-bold text-2xl">Q</span>
            </div>
            <h1 className="mb-4 text-4xl font-bold text-gray-900">
              Welcome Back
            </h1>
            <p className="text-gray-600 text-lg">
              Enter your email and password to access your account
            </p>
          </div>

          {/* Form Section */}
          <div className="p-8 border border-gray-200 rounded-2xl bg-white shadow-xl"
               style={{
                 background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.95) 100%)'
               }}>
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
            
            <div className="space-y-6">
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
                    placeholder="Enter your email address"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    className="w-full pl-12 pr-4 py-4 text-gray-700 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-lg"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label className="block font-bold text-gray-900 mb-3 text-lg">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    className="w-full pl-12 pr-12 py-4 text-gray-700 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-lg"
                  />
                  <button
                    type="button"
                    onClick={() => !isLoading && setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors p-2 rounded-lg hover:bg-gray-100"
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => setIsChecked(e.target.checked)}
                      disabled={isLoading}
                      className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                    />
                  </div>
                  <span className="text-gray-700 font-medium">
                    Keep me logged in
                  </span>
                </div>
             
              </div>

              {/* Sign In Button */}
              <div>
                <button
                  onClick={handleSubmit}
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
                      <span>Signing in...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-3">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                      </svg>
                      <span>Sign In</span>
                    </div>
                  )}
                </button>
              </div>

          
            </div>
          </div>
        </div>
      </div>

      {/* Payment Required Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl border border-gray-200"
               style={{
                 background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.95) 100%)'
               }}>
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                <span className="text-white text-2xl">💰</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                Subscription Required
              </h3>
              <p className="text-gray-600 text-lg">
                {agencyName} needs to complete their subscription to activate the service.
              </p>
            </div>

            {paymentLink ? (
              <div className="space-y-6">
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <p className="text-gray-600 font-medium mb-2">Payment Link:</p>
                  <div className="bg-white p-3 rounded-lg border border-gray-300">
                    <p className="text-gray-700 break-all font-mono text-sm">
                      {paymentLink}
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <button
                    onClick={handleCopyPaymentLink}
                    className="flex-1 py-3 border-2 border-gray-300 bg-white text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all duration-200 hover:scale-[1.02]"
                  >
                    Copy Link
                  </button>
                  <button
                    onClick={handleOpenPaymentLink}
                    className="flex-1 py-3 text-white rounded-xl font-bold transition-all duration-200 hover:scale-[1.02] shadow-lg"
                    style={{
                      background: 'linear-gradient(135deg, #6aa6ff 0%, #6c71ff 50%, #6de0ff 100%)',
                      boxShadow: '0 8px 25px rgba(76, 110, 245, 0.4)'
                    }}
                  >
                    Pay Now
                  </button>
                </div>
                
                <p className="text-gray-500 text-center">
                  After payment, please wait a few minutes and try signing in again.
                </p>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-600 text-lg mb-6">
                  Please contact the agency administrator.
                </p>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="px-8 py-3 border-2 border-gray-300 bg-white text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all duration-200 hover:scale-[1.02]"
                >
                  Close
                </button>
              </div>
            )}
            
            <div className="mt-8 pt-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setIsLoading(false);
                }}
                className="w-full py-3 border-2 border-gray-300 bg-white text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all duration-200 hover:scale-[1.02]"
              >
                Try Again Later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Change Modal */}
      {passwordChangeModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl border border-gray-200"
               style={{
                 background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.95) 100%)'
               }}>
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                <span className="text-white text-2xl">🔒</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                Change Your Password
              </h3>
              <p className="text-gray-600 text-lg">
                For security reasons, please change your password before first login.
              </p>
            </div>

            <div className="space-y-6">
              {/* Current Password */}
              <div>
                <label className="block font-bold text-gray-900 mb-3 text-lg">
                  Current Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    type="password"
                    placeholder="Enter current password"
                    name="currentPassword"
                    value={passwordChangeData.currentPassword}
                    onChange={handlePasswordChangeInput}
                    disabled={passwordChangeLoading}
                    className="w-full pl-12 pr-4 py-4 text-gray-700 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-lg"
                  />
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block font-bold text-gray-900 mb-3 text-lg">
                  New Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    name="newPassword"
                    value={passwordChangeData.newPassword}
                    onChange={handlePasswordChangeInput}
                    disabled={passwordChangeLoading}
                    className="w-full pl-12 pr-12 py-4 text-gray-700 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-lg"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors p-2 rounded-lg hover:bg-gray-100"
                    disabled={passwordChangeLoading}
                  >
                    {showNewPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block font-bold text-gray-900 mb-3 text-lg">
                  Confirm New Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    name="confirmPassword"
                    value={passwordChangeData.confirmPassword}
                    onChange={handlePasswordChangeInput}
                    disabled={passwordChangeLoading}
                    className="w-full pl-12 pr-12 py-4 text-gray-700 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-lg"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors p-2 rounded-lg hover:bg-gray-100"
                    disabled={passwordChangeLoading}
                  >
                    {showConfirmPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Change Password Button */}
              <button
                onClick={handlePasswordChange}
                disabled={passwordChangeLoading}
                className="w-full py-4 text-white font-bold rounded-xl transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-lg"
                style={{
                  background: 'linear-gradient(135deg, #6aa6ff 0%, #6c71ff 50%, #6de0ff 100%)',
                  boxShadow: '0 8px 25px rgba(76, 110, 245, 0.4)'
                }}
              >
                {passwordChangeLoading ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Changing Password...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-3">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span>Change Password</span>
                  </div>
                )}
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200 text-center">
              <p className="text-gray-500 text-sm">
                You must change your password to continue to your account.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}