"use client";
import { ThemeToggleButton } from "@/components/common/ThemeToggleButton";
import NotificationDropdown from "@/components/header/NotificationDropdown";
import UserDropdown from "@/components/header/UserDropdown";
import { useSidebar } from "@/context/SidebarContext";
import Image from "next/image";
import Link from "next/link";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/redux/hooks";

const AppHeader: React.FC = () => {
  const [isApplicationMenuOpen, setApplicationMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const { agencyName } = useAppSelector(state => state.agency);
  const { agencyName: fromClient } = useAppSelector(state => state.client);

  useEffect(() => {
    const checkUser = () => {
      if (typeof window !== "undefined") {
        const userData = localStorage.getItem("user");
        if (userData) {
          setUser(JSON.parse(userData));
        } else {
          router.push("/signin");
        }
      }
    };

    checkUser();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "user") {
        if (e.newValue) {
          setUser(JSON.parse(e.newValue));
        } else {
          router.push("/signin");
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [router]);

  const handleToggle = () => {
    if (window.innerWidth >= 1024) {
      toggleSidebar();
    } else {
      toggleMobileSidebar();
    }
  };

  const toggleApplicationMenu = () => {
    setApplicationMenuOpen(!isApplicationMenuOpen);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (!user) {
    return (
      <header className="sticky top-0 flex w-full bg-white border-b border-gray-200 z-50 shadow-sm">
        <div className="flex items-center justify-center w-full h-16">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm text-gray-600">Loading...</span>
          </div>
        </div>
      </header>
    );
  }

 return (
  <header className="sticky top-0 flex shadow-sm  bg-white border-b border-gray-200 z-10  backdrop-blur-sm ">
    <div className="flex flex-col items-center justify-between grow lg:flex-row lg:px-8">
      {/* Left Section - Menu Toggle & Brand */}
      <div className="flex items-center justify-between w-full gap-4 px-6 py-3 border-b border-gray-100 lg:justify-normal lg:border-b-0 lg:px-0 lg:py-3">
        {/* Menu Toggle Button */}
        <button
          className="flex items-center justify-center w-12 h-12 text-gray-600 rounded-xl transition-all duration-200 hover:bg-gray-100 hover:text-gray-900 z-50 shadow-sm border border-gray-200"
          onClick={handleToggle}
          aria-label="Toggle Sidebar"
        >
          {isMobileOpen ? (
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-gray-700"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M6.21967 7.28131C5.92678 6.98841 5.92678 6.51354 6.21967 6.22065C6.51256 5.92775 6.98744 5.92775 7.28033 6.22065L11.999 10.9393L16.7176 6.22078C17.0105 5.92789 17.4854 5.92788 17.7782 6.22078C18.0711 6.51367 18.0711 6.98855 17.7782 7.28144L13.0597 12L17.7782 16.7186C18.0711 17.0115 18.0711 17.4863 17.7782 17.7792C17.4854 18.0721 17.0105 18.0721 16.7176 17.7792L11.999 13.0607L7.28033 17.7794C6.98744 18.0722 6.51256 18.0722 6.21967 17.7794C5.92678 17.4865 5.92678 17.0116 6.21967 16.7187L10.9384 12L6.21967 7.28131Z"
                fill="currentColor"
              />
            </svg>
          ) : (
            <svg
              width="20"
              height="16"
              viewBox="0 0 20 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-gray-700"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M0.5 1C0.5 0.585786 0.835786 0.25 1.25 0.25H18.75C19.1642 0.25 19.5 0.585786 19.5 1C19.5 1.41421 19.1642 1.75 18.75 1.75H1.25C0.835786 1.75 0.5 1.41421 0.5 1ZM0.5 8C0.5 7.58579 0.835786 7.25 1.25 7.25H18.75C19.1642 7.25 19.5 7.58579 19.5 8C19.5 8.41421 19.1642 8.75 18.75 8.75H1.25C0.835786 8.75 0.5 8.41421 0.5 8ZM1.25 14.25C0.835786 14.25 0.5 14.5858 0.5 15C0.5 15.4142 0.835786 15.75 1.25 15.75H18.75C19.1642 15.75 19.5 15.4142 19.5 15C19.5 14.5858 19.1642 14.25 18.75 14.25H1.25Z"
                fill="currentColor"
              />
            </svg>
          )}
        </button>

        {/* Mobile Brand */}
        <Link href="/" className="lg:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold">Q</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold text-gray-900">
                {agencyName || fromClient || "Queryfuel"}
              </span>
              <span className="text-gray-600 font-medium">
                {user === 'agency' ? 'Agency' : 'Client'}
              </span>
            </div>
          </div>
        </Link>

      

        {/* Mobile Menu Button */}
        <button
          onClick={toggleApplicationMenu}
          className="flex items-center justify-center w-12 h-12 text-gray-600 rounded-xl transition-all duration-200 hover:bg-gray-100 hover:text-gray-900 lg:hidden shadow-sm border border-gray-200"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M5.99902 10.4951C6.82745 10.4951 7.49902 11.1667 7.49902 11.9951V12.0051C7.49902 12.8335 6.82745 13.5051 5.99902 13.5051C5.1706 13.5051 4.49902 12.8335 4.49902 12.0051V11.9951C4.49902 11.1667 5.1706 10.4951 5.99902 10.4951ZM17.999 10.4951C18.8275 10.4951 19.499 11.1667 19.499 11.9951V12.0051C19.499 12.8335 18.8275 13.5051 17.999 13.5051C17.1706 13.5051 16.499 12.8335 16.499 12.0051V11.9951C16.499 11.1667 17.1706 10.4951 17.999 10.4951ZM13.499 11.9951C13.499 11.1667 12.8275 10.4951 11.999 10.4951C11.1706 10.4951 10.499 11.1667 10.499 11.9951V12.0051C10.499 12.8335 11.1706 13.5051 11.999 13.5051C12.8275 13.5051 13.499 12.8335 13.499 12.0051V11.9951Z"
              fill="currentColor"
            />
          </svg>
        </button>
      </div>

      {/* Right Section - User Controls */}
      <div
        className={`${
          isApplicationMenuOpen ? "flex" : "hidden"
        } items-center justify-between w-full gap-6 px-6 py-2  lg:flex lg:bg-transparent lg:justify-end lg:px-0 lg:py-3 border-t border-gray-100 lg:border-t-0`}
      >
      

        {/* Client Portal Link */}
        <Link 
          href="http://localhost:3000/client/login/" 
          target="_blank"
          className="inline-flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors duration-200"
        >
          <svg 
            className="w-4 h-4 mr-2" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" 
            />
          </svg>
          Client Portal
        </Link>

        {/* User Area */}
        <div className="flex items-center gap-4">
          <UserDropdown />
        </div>
      </div>
    </div>
  </header>
);
};

export default AppHeader;