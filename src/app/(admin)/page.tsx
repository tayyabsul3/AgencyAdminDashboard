// app/page.tsx
"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AgencyBranding from "@/components/agency/AgencyBranding";
import ClientProfile from "@/components/client/ClientProfile";
import { useAppSelector } from "@/redux/hooks";

export default function Dashboard() {
  const router = useRouter();
  const [userType, setUserType] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const agency = useAppSelector((state) => state.agency);
  const client = useAppSelector((state) => state.client);

  useEffect(() => {
    const checkAuth = () => {
      const storedUserType = localStorage.getItem("userType");
      const storedUser = localStorage.getItem("user");

      if (!storedUser) {
        router.push("/signin");
        return;
      }

      if (storedUserType) {
        setUserType(storedUserType);
        setIsLoading(false);
      } else if (agency.agencyId) {
        setUserType("agency");
        setIsLoading(false);
      } else if (client.userId) {
        setUserType("client");
        setIsLoading(false);
      } else {
        // Give it a moment for Redux to load
        const timer = setTimeout(() => {
          if (!agency.agencyId && !client.userId) {
            router.push("/signin");
          }
        }, 1000);

        return () => clearTimeout(timer);
      }
    };

    checkAuth();
  }, [agency.agencyId, client.userId, router]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {userType === "agency" && <AgencyBranding />}
      {userType === "client" && <ClientProfile />}
    </div>
  );
}