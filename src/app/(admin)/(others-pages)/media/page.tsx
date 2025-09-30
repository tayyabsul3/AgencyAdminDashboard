import MediaInput from "@/components/Media/MediaInput";
import MediaList from "@/components/tables/MediaList";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Next.js Profile | QueryFuelAdmin - Next.js Dashboard Template",
  description:
    "This is Next.js Profile page for QueryFuelAdmin - Next.js ",
};

export default function Profile() {
  return (
    <div>
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <h3 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-7">
          Media
        </h3>
        <div className="space-y-6 overscroll-auto">
<MediaInput/>
           {/* <ComponentCard title="Basic Table 1"> */}
          {/* <MediaList /> */}
        {/* </ComponentCard> */}
        </div>
      </div>
    </div>
  );
}
