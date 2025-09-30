"use client";
import Checkbox from "@/components/form/input/Checkbox";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { ChevronLeftIcon, EyeCloseIcon, EyeIcon } from "@/icons";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/Firebase"; // ✅ your firebase.ts
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useAppDispatch } from "@/redux/hooks";
import { setAgencyData} from "@/redux/slices/agencySlice";
import { setClientData } from "@/redux/slices/clientSlice";


export default function SignInForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasUser, setHasUser] = useState(false);
const dispatch = useAppDispatch()
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

const handleSubmit = async () => {
    setError("");
    setIsLoading(true);

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
        router.push("/");
        
      } else {
        // 3. Check if user is a Client
        const clientRef = doc(db, "subscriptions", user.uid);
        const clientSnap = await getDoc(clientRef);

        if (clientSnap.exists()) {
          // User is a Client
          const clientData = clientSnap.data();
          
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
          router.push("/client/dashboard");
          
        } else {
          throw new Error("No agency or client account found for this user");
        }
      }

    } catch (err: any) {
      console.error("Sign in error:", err);
      setError(err.message || "Failed to sign in");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 lg:w-1/2 w-full">
      {hasUser && (
        <div className="w-full max-w-md sm:pt-10 mx-auto mb-5">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <ChevronLeftIcon />
            Back to dashboard
          </Link>
        </div>
      )}
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
                <Link
                  href="/reset-password"
                  className="text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400"
                >
                  Forgot password?
                </Link>
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

            <div className="mt-5">
              <p className="text-sm font-normal text-center text-gray-700 dark:text-gray-400 sm:text-start">
                Don&apos;t have an account?{" "}
                <Link
                  href="/signup"
                  className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
                >
                  Sign Up
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
