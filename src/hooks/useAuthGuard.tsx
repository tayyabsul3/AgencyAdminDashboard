// components/AuthGuard.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch } from "@/redux/hooks";
import { setAgencyData } from "@/redux/slices/agencySlice";
import { setClientData } from "@/redux/slices/clientSlice";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();
  const dispatch = useAppDispatch();

  useEffect(() => {
    const checkAuth = async () => {
      setIsLoading(true)
        const user = localStorage.getItem("user");
        
        if (!user) {
          router.push("/signin");
      setIsLoading(false)

          return;
        }else{
          setIsAuthenticated(true)
          router.push("/")
        }
      setIsLoading(false)

    
     
    };

    checkAuth();
  }, [router, dispatch]);

  if (isLoading) {
    return (
      <div className="flex min-w-screen justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}