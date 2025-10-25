"use client";
import React, { useState, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { setAgencyData } from "@/redux/slices/agencySlice";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase"; // Ensure correct casing/path for Firebase
import { toast } from "sonner";
import { FaSpinner, FaUpload } from "react-icons/fa";

// Import components from your setup
import { Modal } from "../ui/modal"; // The Modal component you use
import Button from "../ui/button/Button"; // The Button component you use
import ImageUploader from "./ImageUploader"; // The new ImageCropper component

// Interface for the form data
interface BrandingData {
  agencyName: string; 
  logo: string;
  primaryColor: string;
  secondaryColor: string;
  customDomain: string;
}

export default function AgencyBranding() {
  const dispatch = useAppDispatch();
  const { agencyId, branding } = useAppSelector((state) => state.agency);

  const [formData, setFormData] = useState<BrandingData>({
    agencyName: branding?.agencyName || (agencyId ? agencyId.split('-')[0] : "Your Agency Name"), 
    logo: branding?.logoUrl || "",
    primaryColor: branding?.primaryColor || "#7E22CE",
    secondaryColor: branding?.secondaryColor || "#9333EA",
    customDomain: branding?.domainName || "",
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  // Using useState for the modal state as useModal hook is not available here
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false); 

  // 🔹 Fetch branding data from Firestore
  const fetchBranding = async () => {
    setIsLoading(true);
    try {
      const user = localStorage.getItem("user");
      const storedAgencyId = user ? JSON.parse(user) : null; 
      if (!storedAgencyId) throw new Error("Agency not found in localStorage");

      const agencyRef = doc(db, "agencies", storedAgencyId);
      const agencySnap = await getDoc(agencyRef);

      if (!agencySnap.exists()) throw new Error("Agency document not found");

      const data = agencySnap.data();

      dispatch(setAgencyData({ 
        agencyName: data.agencyName, 
        branding: data.branding 
      }));

      setFormData({
        agencyName: data.agencyName || "Your Agency Name",
        logo: data.branding?.logoUrl || "",
        primaryColor: data.branding?.primaryColor || "#7E22CE",
        secondaryColor: data.branding?.secondaryColor || "#9333EA",
        customDomain: data.branding?.domainName || "",
      });
    } catch (error) {
      console.error("Error fetching branding:", error);
      toast.error("Failed to load branding settings");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBranding();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🔹 Handler for when the ImageUploader returns a new logo URL
  const handleLogoUpdate = (newLogoUrl: string) => {
    setFormData((prev) => ({ ...prev, logo: newLogoUrl }));
  };

  // 🔹 Save branding to Firestore
  const handleSave = async () => {
    if (!formData.agencyName || !formData.logo || !formData.primaryColor || !formData.secondaryColor) {
      toast.error("Please ensure the Agency Name, Logo, and Colors are set before saving.");
      return;
    }

    setIsSaving(true);
    try {
      const user = localStorage.getItem("user");
      const storedAgencyId = user ? JSON.parse(user) : null;
      if (!storedAgencyId) throw new Error("Agency not found");

      const agencyRef = doc(db, "agencies", storedAgencyId);

      await updateDoc(agencyRef, {
        agencyName: formData.agencyName, 
        branding: {
          logoUrl: formData.logo,
          primaryColor: formData.primaryColor,
          secondaryColor: formData.secondaryColor,
          domainName: formData.customDomain,
        },
        updatedAt: serverTimestamp(),
      });

      dispatch(
        setAgencyData({
          agencyName: formData.agencyName,
          branding: {
            logoUrl: formData.logo,
            primaryColor: formData.primaryColor,
            secondaryColor: formData.secondaryColor,
            domainName: formData.customDomain,
          }
        })
      );

      toast.success("Branding updated successfully! 🎉");
    } catch (error) {
      console.error("Error saving branding:", error);
      toast.error("Failed to save branding settings");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40 text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p>Loading branding settings...</p>
        </div>
      </div>
    );
  }

return (
  <div className="p-8 bg-white rounded-2xl border border-gray-200 shadow-sm">
    {/* Header */}
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Agency Branding</h1>
        <p className="text-gray-600 mt-2">Customize your agency's appearance and domain</p>
      </div>
      <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"></div>
    </div>

    {/* AGENCY NAME SECTION */}
    <div className="mb-8 p-6 bg-gray-50 rounded-xl border border-gray-200">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-gradient-to-r from-teal-500 to-green-500 rounded-lg flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-900">Agency Name</h2>
      </div>
      <div>
        <label className="block font-semibold text-gray-700 mb-2">Agency Name</label>
        <input
          type="text"
          placeholder="Enter your agency's official name"
          name="agencyName"
          value={formData.agencyName}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, agencyName: e.target.value }))
          }
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
        />
      </div>
    </div>
    
    <hr className="my-8 border-gray-200" />

    {/* LOGO SECTION - Refactored for Uploader with Modal */}
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-900">Agency Logo</h2>
      </div>
      
      <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 space-y-6">
          
          {/* Current Logo Preview */}
          <div className="flex items-center gap-4 p-3 bg-white rounded-lg border border-gray-300">
            <div
              className="w-20 h-20 rounded-full border-2 flex items-center justify-center bg-white overflow-hidden shadow-md flex-shrink-0"
              style={{ borderColor: formData.primaryColor }}
            >
              {formData.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={formData.logo}
                  alt="Agency Logo"
                  className="w-full h-full object-contain"
                />
              ) : (
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </div>
            <div>
              <p className="font-bold text-gray-900">Current Logo Preview</p>
              <p className="text-sm text-gray-600">This logo will be used across all client-facing portals.</p>
            </div>
          </div>
          
          <div className="p-4 bg-white rounded-lg border border-gray-300">
             
            {/* BUTTON TO OPEN IMAGE UPLOADER MODAL */}
            <Button
                onClick={() => setIsLogoModalOpen(true)}
                className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 shadow-md"
            >
                <FaUpload /> Upload & Crop New Logo
            </Button>
            {/* ------------------------------------- */}

             <div className="mt-6 pt-4 border-t border-gray-200">
              <label className="block font-semibold text-gray-700 mb-2">Or, Paste Logo URL (Fallback)</label>
              <input
                type="text"
                placeholder="Paste your logo image URL here..."
                name="logo"
                value={formData.logo}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, logo: e.target.value }))
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              />
            </div>
          </div>
      </div>
    </div>

    <hr className="my-8 border-gray-200" />

    {/* COLORS SECTION - Same as before */}
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-900">Brand Colors</h2>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div 
              className="w-6 h-6 rounded-full border-2 border-gray-300 shadow-sm"
              style={{ backgroundColor: formData.primaryColor }}
            ></div>
            <label className="font-semibold text-gray-900">Primary Color</label>
          </div>
          <div className="space-y-3">
            <input
              type="color"
              value={formData.primaryColor}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, primaryColor: e.target.value }))
              }
              className="w-full h-14 cursor-pointer rounded-xl border border-gray-300 shadow-sm"
            />
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium">Color Value</span>
              <span className="font-mono text-gray-900 bg-gray-100 px-3 py-1 rounded-lg">
                {formData.primaryColor}
              </span>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-3">
            <div 
              className="w-6 h-6 rounded-full border-2 border-gray-300 shadow-sm"
              style={{ backgroundColor: formData.secondaryColor }}
            ></div>
            <label className="font-semibold text-gray-900">Secondary Color</label>
          </div>
          <div className="space-y-3">
            <input
              type="color"
              value={formData.secondaryColor}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  secondaryColor: e.target.value,
                }))
              }
              className="w-full h-14 cursor-pointer rounded-xl border border-gray-300 shadow-sm"
            />
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium">Color Value</span>
              <span className="font-mono text-gray-900 bg-gray-100 px-3 py-1 rounded-lg">
                {formData.secondaryColor}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <hr className="my-8 border-gray-200" />


    {/* DOMAIN SECTION - Same as before */}
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-900">Custom Domain</h2>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block font-semibold text-gray-700 mb-2">Domain Name</label>
          <div className="relative">
            <input
              type="text"
              name="customDomain"
              value={formData.customDomain}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, customDomain: e.target.value }))
              }
              placeholder="your-agency.com"
              className="w-full px-12 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-lg"
            />
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
              <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <div>
              <p className="text-green-800 font-medium">White-label Experience</p>
              <p className="text-green-700 mt-1">Connect your custom domain to provide a seamless branded experience for your clients</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <hr className="my-8 border-gray-200" />


    {/* PREVIEW SECTION - Same as before */}
    <div className="mt-12 pt-8 border-t border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-amber-500 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900">Live Preview</h2>
        </div>
        <span className="text-gray-500 font-medium">Real-time preview</span>
      </div>
      
      <div className="rounded-2xl overflow-hidden shadow-xl border border-gray-200">
        {/* Preview Header */}
        <div
          className="flex items-center justify-between px-8 py-6"
          style={{
            background: `linear-gradient(135deg, ${formData.primaryColor} 0%, ${formData.secondaryColor} 100%)`,
            color: "#fff",
          }}
        >
          <div className="flex items-center gap-4">
            {formData.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={formData.logo}
                alt="Agency Logo"
                className="w-10 h-10 rounded-lg object-cover shadow-lg"
              />
            )}
            <span className="font-bold text-white text-lg">{formData.agencyName}</span>
          </div>
          <div className="text-white bg-white/20 px-4 py-2 rounded-full font-medium">
            {formData.customDomain || "youragency.com"}
          </div>
        </div>

        {/* Preview Content */}
        <div className="p-8 bg-gradient-to-br from-gray-50 to-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-3 h-3 bg-green-500 rounded-full shadow-sm"></div>
            <p className="font-semibold text-gray-900 text-lg">Dashboard Overview</p>
          </div>
          
          <div
            className="rounded-2xl p-8 text-center border-2 border-dashed"
            style={{
              backgroundColor: formData.secondaryColor + "15",
              borderColor: formData.secondaryColor + "40",
            }}
          >
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-900 font-bold text-lg mb-2">
              Welcome to {formData.agencyName}'s Client Portal!
            </p>
            <p className="text-gray-600">
              This is how your clients will see the interface
            </p>
          </div>
        </div>
      </div>
    </div>

    {/* SAVE BUTTON */}
    <div className="mt-12 pt-8 border-t border-gray-200">
      <Button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full py-4 text-white font-bold rounded-xl transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg"
        // style={{
        //   background: 'linear-gradient(135deg, #6aa6ff 0%, #6c71ff 50%, #6de0ff 100%)',
        //   boxShadow: '0 8px 25px rgba(76, 110, 245, 0.35)'
        // }}
      >
        {isSaving ? (
          <div className="flex items-center justify-center gap-3">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span className="text-lg">Saving Changes...</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-lg">Save Branding Settings</span>
          </div>
        )}
      </Button>
    </div>

    {/* 🆕 LOGO UPLOAD MODAL */}
    <Modal
      isOpen={isLogoModalOpen}
      onClose={() => setIsLogoModalOpen(false)}
      className="max-w-[700px] m-4"
    >
        <div className="no-scrollbar mb-5 relative w-full max-h-[100dvh] max-w-[700px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
            <div className="px-2 pr-14">
                <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
                    Upload & Crop Agency Logo
                </h4>
                <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
                    Select an image file (PNG/JPG) to use as your agency logo. You can crop it to a perfect square or circle.
                </p>
            </div>
            
            <div className=" max-h-[80dvh] ">
                <ImageUploader 
                    onUploadComplete={handleLogoUpdate} 
                    onClose={() => setIsLogoModalOpen(false)} // Pass the modal close handler
                />
            </div>
        </div>
    </Modal>
  </div>
);
}