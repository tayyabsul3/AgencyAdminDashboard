"use client";

import { useSidebar } from "@/context/SidebarContext";
import AppHeader from "@/layout/AppHeader";
import AppSidebar from "@/layout/AppSidebar";
import Backdrop from "@/layout/Backdrop";
import React from "react";
import { usePathname } from "next/navigation";
import Providers from "@/redux/Provider";
import { Toaster } from "sonner";
import AgencyProvider from "@/components/AgencyProvider";
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();

  // Check if the current path is a view page
  const isViewPage = pathname?.startsWith('/view/');

  // If it's a view page, render without the admin layout
  if (isViewPage) {
    return <div className="min-h-screen">{children}</div>;
  }

  // Dynamic class for main content margin based on sidebar state
  const mainContentMargin = isMobileOpen
    ? "ml-0"
    : isExpanded || isHovered
    ? "lg:ml-[290px]"
    : "lg:ml-[90px]";

  return (
    <div className="min-h-screen xl:flex">
      {/* Sidebar and Backdrop */}
      <Providers>
        <AgencyProvider>



<Toaster/>
      <AppSidebar />
      <Backdrop />
      {/* Main Content Area */}
      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${mainContentMargin}`}
      >
        {/* Header */}
        <AppHeader />
        {/* Page Content */}
        <div className="p-4 mx-auto max-w-(--breakpoint-2xl) md:p-6">{children}</div>
      </div>
        </AgencyProvider>

      </Providers>
    </div>
  );
}