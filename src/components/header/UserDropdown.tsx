"use client";
import Image from "next/image";
import Link from "next/link";
import React, { useState, useEffect } from "react";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/redux/hooks";

interface UserProfile {
  address: {
    country: string;
    state: string;
    city: string;
    fullAddress: string;
    postalCode: string;
    taxId: string;
  };
  firstName: string;
  lastName: string;
  title: string;
  phone: string;
  bio: string;
  socialLinks: {
    facebook: string;
    twitter: string;
    linkedin: string;
    instagram: string;
  };
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
  profile: UserProfile;
}

export default function UserDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [isComingSoonOpen, setIsComingSoonOpen] = useState(false);
  const [comingSoonTitle, setComingSoonTitle] = useState("");
  const [userType, setUserType] = useState<string | null>(null);
  
  const agencyData = useAppSelector((state) => state.agency);
  const clientData = useAppSelector((state) => state.client);
  const router = useRouter();

  // Load user type from localStorage on component mount
  useEffect(() => {
    const loadUserType = () => {
      try {
        const storedUserType = localStorage.getItem("userType");
        setUserType(storedUserType);
      } catch (error) {
        console.error("Failed to load user type from localStorage:", error);
      }
    };

    loadUserType();
  }, []);

  function toggleDropdown(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  const handleComingSoon = (title: string) => {
    setComingSoonTitle(title);
    setIsComingSoonOpen(true);
    closeDropdown();
  };

  const closeComingSoon = () => {
    setIsComingSoonOpen(false);
  };

  const handleSignOut = () => {
    // Remove user from localStorage
    localStorage.removeItem("user");
    localStorage.removeItem("userType");
    router.push("/signin");
  };

  // Navigate to password reset page
  const handleChangePassword = () => {
    router.push("/passwordChange");
    closeDropdown();
  };

  // Get user data based on userType
  const getUserData = () => {
    if (userType === 'agency') {
      return {
        name: agencyData.agencyName || "Agency Owner",
        email: agencyData.email || "agency@example.com",
        avatar: "/images/user/owner.jpg" // You can add agency logo to Redux if needed
      };
    } else if (userType === 'client') {
      return {
        name: clientData.name || "Client User",
        email: clientData.email || "client@example.com",
        avatar: "/images/user/owner.jpg"
      };
    } else {
      return {
        name: "User",
        email: "user@example.com",
        avatar: "/images/user/owner.jpg"
      };
    }
  };

  const userData = getUserData();
  const displayName = userData.name;
  const displayEmail = userData.email;
  const avatarSrc = userData.avatar;

  return (
    <>
      <div className="relative">
        <button
          onClick={toggleDropdown}
          className="flex items-center gap-3 px-4 py-3 text-gray-700 rounded-xl transition-all duration-200 hover:bg-gray-100 border border-gray-200 shadow-sm"
        >
          <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-base">
              {displayName?.charAt(0).toUpperCase()}
            </span>
          </div>
          
          <div className="flex flex-col items-start">
            <span className="font-bold text-gray-900">
              {displayName}
            </span>
            <span className="text-gray-600 font-medium">
              {userType === 'agency' ? 'Agency Owner' : 'Client'}
            </span>
          </div>

          <svg
            className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <Dropdown
          isOpen={isOpen}
          onClose={closeDropdown}
          className="absolute right-0 mt-3 w-80 rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl"
        >
          {/* User Info Header */}
          <div className="flex items-center gap-4 pb-6 border-b border-gray-100">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-lg">
                {displayName?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 truncate text-lg">
                {displayName}
              </p>
              <p className="text-gray-600 truncate font-medium">
                {displayEmail}
              </p>
              <span className={`inline-block mt-2 px-3 py-1 rounded-full font-bold ${
                userType === 'agency' 
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-green-100 text-green-700'
              }`}>
                {userType === 'agency' ? 'Agency Owner' : 'Client'}
              </span>
            </div>
          </div>

          {/* Change Password Button - ADDED THIS SECTION */}
          <div className="py-4 border-b border-gray-100">
            <button
              onClick={handleChangePassword}
              className="flex items-center gap-4 w-full px-4 py-3 text-blue-600 rounded-xl transition-all duration-200 hover:bg-blue-50 hover:scale-[1.02] group"
            >
              <div className="w-10 h-10 bg-gradient-to-r from-blue-100 to-cyan-100 rounded-lg flex items-center justify-center group-hover:from-blue-200 group-hover:to-cyan-200">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <p className="font-bold text-blue-600">Change Password</p>
                <p className="text-blue-500">Update your password</p>
              </div>
            </button>
          </div>

          {/* Sign Out */}
          <div className="pt-4 border-t border-gray-100">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-4 w-full px-4 py-3 text-red-600 rounded-xl transition-all duration-200 hover:bg-red-50 hover:scale-[1.02] group"
            >
              <div className="w-10 h-10 bg-gradient-to-r from-red-100 to-pink-100 rounded-lg flex items-center justify-center group-hover:from-red-200 group-hover:to-pink-200">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <p className="font-bold text-red-600">Sign Out</p>
                <p className="text-red-500">Log out of your account</p>
              </div>
            </button>
          </div>
        </Dropdown>
      </div>

      {/* Coming Soon Modal */}
      <Modal
        isOpen={isComingSoonOpen}
        onClose={closeComingSoon}
        className="max-w-md p-8"
      >
        <div className="text-center">
          <div className="mx-auto w-20 h-20 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mb-6 shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3">
            Coming Soon!
          </h3>
          <p className="text-gray-600 mb-8 text-lg">
            {comingSoonTitle} is under development. We're working hard to bring you this feature soon.
          </p>
          <button 
            onClick={closeComingSoon}
            className="w-full py-4 text-white font-bold rounded-xl transition-all duration-200 hover:scale-[1.02] shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #6aa6ff 0%, #6c71ff 50%, #6de0ff 100%)',
              boxShadow: '0 8px 25px rgba(76, 110, 245, 0.4)'
            }}
          >
            Got it!
          </button>
        </div>
      </Modal>
    </>
  );
}