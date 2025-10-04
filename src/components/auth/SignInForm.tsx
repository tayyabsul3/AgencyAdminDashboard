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
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
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

  const checkSubscriptionStatus = async (userType: 'agency' | 'client', userId: string, agencyId?: string) => {
    try {
      if (userType === 'agency') {
        // Check agency's own subscription status
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
            return false; // Subscription not paid
          }
          return true; // Subscription is paid
        }
      } else if (userType === 'client' && agencyId) {
        // Check the agency's subscription status that the client belongs to
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
            return false; // Agency subscription not paid
          }
          return true; // Agency subscription is paid
        }
      }
      
      return true; // Default to allowing access if status can't be determined
    } catch (error) {
      console.error("Error checking subscription status:", error);
      return true; // Allow access on error to prevent blocking users
    }
  };

  const handleSubmit = async () => {
    setError("");
    setIsLoading(true);
    setShowPaymentModal(false);

    if (!formData.email || !formData.password) {
      setError("Please fill in all fields");
      setIsLoading(false);
      return;
    }

    try {
      // 1. Firebase login
      const userCredential = await signInWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );
      const user = userCredential.user;

      // 2. Check if user is an Agency
      const agencyRef = doc(db, "agencies", user.uid);
      const agencySnap = await getDoc(agencyRef);

      if (agencySnap.exists()) {
        // User is an Agency
        const agencyData = agencySnap.data();
        
        // Check subscription status
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
        // 3. Check if user is a Client
        const clientRef = doc(db, "subscriptions", user.uid);
        const clientSnap = await getDoc(clientRef);

        if (clientSnap.exists()) {
          // User is a Client
          const clientData = clientSnap.data();
          
          // Check the agency's subscription status
          const isSubscriptionPaid = await checkSubscriptionStatus('client', user.uid, clientData.agencyId);
          
          if (!isSubscriptionPaid) {
            toast.error("Agency subscription payment required");
            setShowPaymentModal(true);
            setIsLoading(false);
            return;
          }

          // Get agency data for client context
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
    
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              Sign In
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enter your email and password to sign in!
            </p>
          </div>
          <div>
            {error && (
              <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-900/30 dark:text-red-300">
                {error}
              </div>
            )}
            <div className="space-y-6">
              <div>
                <Label>
                  Email <span className="text-error-500">*</span>
                </Label>
                <Input
                  placeholder="info@gmail.com"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={isLoading}
                />
              </div>
              <div>
                <Label>
                  Password <span className="text-error-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    disabled={isLoading}
                  />
                  <span
                    onClick={() =>
                      !isLoading && setShowPassword(!showPassword)
                    }
                    className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                  >
                    {showPassword ? (
                      <div className="fill-gray-500 dark:fill-gray-400">
                        <EyeIcon />
                      </div>
                    ) : (
                      <div className="fill-gray-500 dark:fill-gray-400">
                        <EyeCloseIcon />
                      </div>
                    )}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={isChecked}
                    onChange={setIsChecked}
                    disabled={isLoading}
                  />
                  <span className="block font-normal text-gray-700 text-theme-sm dark:text-gray-400">
                    Keep me logged in
                  </span>
                </div>
              </div>
              <div>
                <Button
                  onClick={handleSubmit}
                  className="w-full"
                  size="sm"
                  disabled={isLoading}
                >
                  {isLoading ? "Signing in..." : "Sign in"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Required Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full">
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">💰</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-2">
                Subscription Payment Required
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                {agencyName} needs to complete their subscription payment to activate the service.
              </p>
            </div>

            {paymentLink ? (
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Payment Link:</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 break-all font-mono">
                    {paymentLink}
                  </p>
                </div>
                
                <div className="flex gap-3">
                  <Button
                  variant="outline"
                    onClick={handleCopyPaymentLink}
                    className="flex-1 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
                  >
                    Copy Link
                  </Button>
                  <Button
                    onClick={handleOpenPaymentLink}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                  >
                    Pay Now
                  </Button>
                </div>
                
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  After payment, please wait a few minutes and try signing in again.
                </p>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  No payment link available. Please contact the agency administrator.
                </p>
                <Button
                  variant="outline"

                  onClick={() => setShowPaymentModal(false)}
                  className="bg-gray-500 hover:bg-gray-600  "
                >
                  Close
                </Button>
              </div>
            )}
            
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                  variant="outline"

                onClick={() => {
                  setShowPaymentModal(false);
                  setIsLoading(false);
                }}
                className="w-full border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
              >
                Try Again Later
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}