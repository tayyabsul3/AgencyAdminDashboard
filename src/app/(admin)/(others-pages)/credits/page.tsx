import CreditsUsage from "@/components/agency/AgencyCredits";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Subscriptions | QueryFuelAdmin - Next.js Dashboard Template",
  description:
    "This is Next.js Seats page for QueryFuelAdmin  ",
  // other metadata
};
export default function page() {
  return (
    <div>
      <CreditsUsage/>
    </div>
  );
}
