import Calendar from "@/components/calendar/Calendar";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Next.js Calender | QueryFuelAdmin - Next.js Dashboard Template",
  description:
    "This is Next.js Calender page for QueryFuelAdmin  ",
  // other metadata
};
export default function page() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Campaign Timeline" />
      <Calendar />
    </div>
  );
}
