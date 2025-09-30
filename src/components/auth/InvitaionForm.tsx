"use client";
import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, db } from "@/lib/Firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { EyeCloseIcon, EyeIcon } from "@/icons";
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

  const createClientAccount = async (user: any) => {
    if (!inviteData) throw new Error("No invite data");

    // Create client document in clients collection
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
    articlesGenerated: 0
  });

    // Update invite status to "accepted"
    const inviteRef = doc(db, "invitations", inviteData.agencyId, "invites", inviteData.inviteId);
    await setDoc(inviteRef, {
      status: "accepted",
      acceptedAt: serverTimestamp(),
      clientUserId: user.uid
    }, { merge: true });

    // Add client to agency's clients array (optional - if you maintain this)
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
     createdAt: Timestamp.now(), // Use Timestamp.now() here
      updatedAt: Timestamp.now(),
    tier: "client",
    articlesGenerated: 0
        }
      ];
      await setDoc(agencyRef, {
        clients: updatedClients
      }, { merge: true });

      const emailRef = doc(db, "emails", user.uid);
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
      await createClientAccount(user);

      // 4. Save user in localStorage
      localStorage.setItem("user", JSON.stringify(user.uid));
      localStorage.setItem("userType", "client");

      toast.success("Account created successfully! Redirecting to dashboard...");

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
    <div className="flex items-center justify-center lg:w-1/2 w-full flex-1 min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90 mb-2">
              Join {inviteData?.agencyName}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Complete your registration to get started
            </p>
          </div>

          {error && (
            <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-900/30 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label>Full Name</Label>
              <Input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                disabled={true}
                className="bg-gray-50 dark:bg-gray-700"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Prefilled from invitation
              </p>
            </div>

            <div>
              <Label>Email</Label>
              <Input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                disabled={true}
                className="bg-gray-50 dark:bg-gray-700"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Prefilled from invitation
              </p>
            </div>

            <div>
              <Label>
                Password <span className="text-error-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Create your password"
                  disabled={isLoading}
                />
                <span
                  onClick={() => setShowPassword(!showPassword)}
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
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Must be at least 6 characters
              </p>
            </div>

            <Button
              onClick={handleSubmit}
              className="w-full"
              size="sm"
              disabled={isLoading || !formData.password}
            >
              {isLoading ? "Creating Account..." : "Create Account"}
            </Button>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <p className="text-center text-sm text-gray-500 dark:text-gray-400">
              By creating an account, you agree to be added as a client of{" "}
              <strong>{inviteData?.agencyName}</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}