"use client";
import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";
// Add to imports at the top
import { encryptString } from "@/lib/encryption";
import Button from "@/components/ui/button/Button";
import { toast } from "sonner";

interface InviteData {
  inviteId: string;
  clientName: string;
  clientEmail: string;
  ownerId: string;
  agencyId: string;
  agencyName: string;
  status: string;
  createdAt: any;
  expiresAt: any;
  articleLimit?: number; // Add articleLimit to invite data interface
}

export default function InviteRegistration() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const agencyId = searchParams.get('agencyId');
  const inviteId = searchParams.get('inviteId');

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [isValidInvite, setIsValidInvite] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: ""
  });

  // Check invite validity on component mount
  useEffect(() => {
    const checkInvite = async () => {
      if (!agencyId || !inviteId) {
        setError("Invalid invitation link");
        setIsChecking(false);
        return;
      }

      try {
        // Get invite document from Firestore
        const inviteRef = doc(db, "invitations", agencyId, "invites", inviteId);
        const inviteSnap = await getDoc(inviteRef);
        console.log(inviteSnap)
        
        if (!inviteSnap.exists()) {
          setError("Invitation not found or expired");
          setIsChecking(false);
          return;
        }

        const data = inviteSnap.data() as InviteData;
        
        // Check if invite is expired
        if (data.expiresAt?.toDate() < new Date()) {
          setError("This invitation has expired");
          setIsChecking(false);
          return;
        }

        // Check if invite is already used
        if (data.status !== "pending") {
          setError("This invitation has already been used");
          setIsChecking(false);
          return;
        }

        setInviteData(data);
        setFormData({
          name: data.clientName,
          email: data.clientEmail,
          password: ""
        });
        setIsValidInvite(true);
        setIsChecking(false);

      } catch (err: any) {
        console.error("Error checking invite:", err);
        setError("Failed to validate invitation");
        setIsChecking(false);
      }
    };

    checkInvite();
  }, [agencyId, inviteId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

// In app/invite/InviteRegistration.tsx
const createClientAccount = async (user: any, clientPassword: string) => { 
  if (!inviteData) throw new Error("No invite data");

  const agencySecretKey = inviteData.agencyId; 
  const encryptedPassword = encryptString(clientPassword, agencySecretKey); 

  // Get article limit from invitation data, default to 10 if not provided
  const articleLimit = inviteData.articleLimit || 10;

  // Create client document in subscriptions collection with article limit
  const clientRef = doc(db, "subscriptions", user.uid);
  await setDoc(clientRef, {
    userId: user.uid,
    email: formData.email,
    name: formData.name,
    ownerId: inviteData.ownerId,
    agencyId: inviteData.agencyId,
    agencyName: inviteData.agencyName,
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    tier: "client",
    articlesGenerated: 0,
    articleLimit: articleLimit,
    // New: Store the encrypted password in the client's subscription document
    encryptedPassword: encryptedPassword, // 👈 New field
  });

  // Update invite status to "accepted"
  const inviteRef = doc(db, "invitations", inviteData.agencyId, "invites", inviteData.inviteId);
  await setDoc(inviteRef, {
    status: "accepted",
    acceptedAt: serverTimestamp(),
    clientUserId: user.uid
  }, { merge: true });

  // Add client to agency's clients array with article limit
  const agencyRef = doc(db, "agencies", inviteData.agencyId);
  const agencySnap = await getDoc(agencyRef);
  if (agencySnap.exists()) {
    const agencyData = agencySnap.data();
    const updatedClients = [
      ...(agencyData.clients || []),
      {
        userId: user.uid,
        email: formData.email,
        name: formData.name,
        ownerId: inviteData.ownerId,
        agencyId: inviteData.agencyId,
        agencyName: inviteData.agencyName,
        status: "active",
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        tier: "client",
        articlesGenerated: 0,
        articleLimit: articleLimit,
        // New: Store the encrypted password in the agency's client array
        encryptedPassword: encryptedPassword, // 👈 New field
      }
    ];
    await setDoc(agencyRef, {
      clients: updatedClients
    }, { merge: true });
      // Create email document
      const emailRef = doc(db, "email", user.uid);
      await setDoc(emailRef, {
        createdAt: Timestamp.now(),
        email: formData.email,
        uid: user.uid,
      });
    }
  };

  const handleSubmit = async () => {
    setError("");
    setIsLoading(true);

    if (!formData.password) {
      setError("Please enter a password");
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      setIsLoading(false);
      return;
    }

    try {
      // 1. Create user account in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );
      const user = userCredential.user;
     
      // 2. Update user profile with name
      await updateProfile(user, {
        displayName: formData.name
      });

      // 3. Create client record in Firestore
      await createClientAccount(user,formData.password);

      // 4. Save user in localStorage
      localStorage.setItem("user", JSON.stringify(user.uid));
      localStorage.setItem("userType", "client");

      // Show success message with article limit info
      const articleLimit = inviteData?.articleLimit || 10;
      toast.success(
        <div>
          <p className="font-semibold">Account created successfully!</p>
          <p className="mt-1 text-sm">
            Your article generation limit: <strong>{articleLimit} articles</strong>
          </p>
        </div>
      );

      // 5. Redirect to client dashboard
      setTimeout(() => {
        router.push("/signin");
      }, 2000);

    } catch (err: any) {
      console.error("Registration error:", err);
      
      if (err.code === 'auth/email-already-in-use') {
        setError("This email is already registered. Please sign in instead.");
      } else if (err.code === 'auth/weak-password') {
        setError("Password is too weak. Please choose a stronger password.");
      } else {
        setError(err.message || "Failed to create account");
      }
      setIsLoading(false);
    }
  };

  if (isChecking) {
    return (
      <div className="flex items-center lg:w-1/2 w-full flex-1 justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Validating your invitation...</p>
        </div>
      </div>
    );
  }

  if (!isValidInvite) {
    return (
      <div className="flex items-center lg:w-1/2 w-full flex-1 justify-center min-h-screen">
        <div className="text-center max-w-md p-6">
          <div className="text-red-500 text-4xl mb-4">❌</div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90 mb-2">
            Invalid Invitation
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <Button onClick={() => router.push("/")}>
            Return to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center w-full min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 p-6">
      <div className="w-full max-w-lg">
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <span className="text-white font-bold text-2xl">Q</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Join {inviteData?.agencyName}
          </h1>
          <p className="text-gray-600 text-lg">
            Complete your registration to get started
          </p>
          
          {/* Article Limit Info */}
          {inviteData?.articleLimit && (
            <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200 max-w-md mx-auto">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-blue-600 font-bold text-lg">📊</span>
                </div>
                <div>
                  <h4 className="font-bold text-blue-800 text-sm">Article Generation Limit</h4>
                  <p className="text-blue-700 font-semibold">
                    {inviteData.articleLimit} articles included
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Form Section */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8"
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
            {/* Name Field */}
            <div>
              <label className="block font-bold text-gray-900 mb-3 text-lg">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  disabled={true}
                  className="w-full pl-12 pr-4 py-4 text-gray-700 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-lg"
                />
              </div>
              <p className="text-gray-500 font-medium mt-2">
                Prefilled from invitation
              </p>
            </div>

            {/* Email Field */}
            <div>
              <label className="block font-bold text-gray-900 mb-3 text-lg">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                </div>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={true}
                  className="w-full pl-12 pr-4 py-4 text-gray-700 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-lg"
                />
              </div>
              <p className="text-gray-500 font-medium mt-2">
                Prefilled from invitation
              </p>
            </div>

            {/* Password Field */}
            <div>
              <label className="block font-bold text-gray-900 mb-3 text-lg">
                Create Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Create your secure password"
                  disabled={isLoading}
                  className="w-full pl-12 pr-12 py-4 text-gray-700 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-lg"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
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
              <p className="text-gray-500 font-medium mt-2">
                Must be at least 6 characters
              </p>
            </div>

            {/* Create Account Button */}
            <div>
              <button
                onClick={handleSubmit}
                disabled={isLoading || !formData.password}
                className="w-full py-4 text-white font-bold rounded-xl transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-lg"
                style={{
                  background: 'linear-gradient(135deg, #6aa6ff 0%, #6c71ff 50%, #6de0ff 100%)',
                  boxShadow: '0 8px 25px rgba(76, 110, 245, 0.4)'
                }}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Creating Account...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-3">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>Create Account</span>
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-center text-gray-600 font-medium">
              By creating an account, you agree to be added as a client of{" "}
              <strong className="text-gray-900">{inviteData?.agencyName}</strong>
              {inviteData?.articleLimit && (
                <span className="block mt-1">
                  with an article generation limit of <strong>{inviteData.articleLimit} articles</strong>
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}