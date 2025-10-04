import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { SidebarProvider } from "@/context/SidebarContext";

const outfit = Outfit({ subsets: ["latin"] });

export const metadata = {
  title: 'QueryFuel - AI-Powered Content Creation',
  description: 'Transform your expertise into professional blog articles with AI. From interview to published content in minutes, powered by GPT-4, DALL-E, and advanced AI tools.',
  icons: {
    icon: './favicon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${outfit.className} dark:bg-gray-900`}
        suppressHydrationWarning
      >
        <ThemeProvider>
          <SidebarProvider>{children}</SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}