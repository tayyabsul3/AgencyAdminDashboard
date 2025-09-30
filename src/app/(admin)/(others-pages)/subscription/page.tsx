import AgencySeats from "@/components/agency/AgencySeats";
import SubscriptionBilling from "@/components/agency/AgencySubscriptions";
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
      <SubscriptionBilling/>
    </div>
  );
}
