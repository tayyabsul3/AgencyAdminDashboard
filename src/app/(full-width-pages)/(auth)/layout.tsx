
import { ThemeProvider } from "@/context/ThemeContext";

import React from "react";

export const metadata = {
  title: 'QueryFuel - AI-Powered Content Creation',
  description: 'Transform your expertise into professional blog articles with AI. From interview to published content in minutes, powered by GPT-4, DALL-E, and advanced AI tools.',
  icons: {
    icon: './favicon.svg',
  },
}
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative p-6 bg-white z-1 dark:bg-gray-900 sm:p-0">
      <ThemeProvider>
        <div className="relative flex lg:flex-row w-full h-screen justify-center flex-col  dark:bg-gray-900 sm:p-0">
          {children}
        
         
        </div>
      </ThemeProvider>
    </div>
  );
}
