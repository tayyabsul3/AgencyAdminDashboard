import AgencyUsage from "@/components/agency/AgencyUsage";
import UserProfileCard from "@/components/user-profile/CombinedUserProfile";
import UserAddressCard from "@/components/user-profile/UserAddressCard";
import UserInfoCard from "@/components/user-profile/UserInfoCard";
import UserMetaCard from "@/components/user-profile/UserMetaCard";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Next.js Client Usage | QueryFuelAdmin - Next.js Dashboard Template",
  description:
    "This is Next.js Client Usage page for QueryFuelAdmin - Next.js ",
};

export default function Profile() {
  return (
    <div>
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <h3 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-7">
          Resourses Management
        </h3>
        <div className="space-y-6">
          {/* <UserMetaCard />
          <UserInfoCard />
          <UserAddressCard /> */}
          <AgencyUsage/>
        </div>
      </div>
    </div>
  );
}
