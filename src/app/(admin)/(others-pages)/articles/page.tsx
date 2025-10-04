import AgencySeats from "@/components/agency/AgencySeats";
import Calendar from "@/components/calendar/Calendar";
import ClientArticles from "@/components/client/ClientArticles";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Seats | QueryFuelAdmin - Next.js Dashboard Template",
  description:
    "This is Next.js Seats page for QueryFuelAdmin  ",
  // other metadata
};
export default function page() {
  return (
    <div>
      <ClientArticles/>
    </div>
  );
}
