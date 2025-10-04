"use client";
import React, { useState, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { setAgencyData } from "@/redux/slices/agencySlice";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/Firebase";
import { toast } from "sonner";
import { FaSpinner } from "react-icons/fa";

export default function AgencyBranding() {
  const dispatch = useAppDispatch();
  const { agencyId, branding } = useAppSelector((state) => state.agency);

  const [formData, setFormData] = useState({
    logo: branding?.logo || "",
    primaryColor: branding?.primaryColor || "#7E22CE",
    secondaryColor: branding?.secondaryColor || "#9333EA",
    customDomain: branding?.customDomain || "",
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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

      // 🔸 Update Redux
      dispatch(setAgencyData({ branding: data.branding }));

      // 🔸 Update local form state
      setFormData({
        logo: data.branding?.logo || "",
        primaryColor: data.branding?.primaryColor || "#7E22CE",
        secondaryColor: data.branding?.secondaryColor || "#9333EA",
        customDomain: data.branding?.customDomain || "",
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
  }, []);

  // 🔹 Save branding to Firestore
  const handleSave = async () => {
    if (!formData.logo || !formData.primaryColor || !formData.secondaryColor) {
      toast.error("Please fill all branding details before saving.");
      return;
    }

    setIsSaving(true);
    try {
      const user = localStorage.getItem("user");
      const storedAgencyId = user ? JSON.parse(user) : null;
      if (!storedAgencyId) throw new Error("Agency not found");

      const agencyRef = doc(db, "agencies", storedAgencyId);

      await updateDoc(agencyRef, {
       
          logo: formData.logo,
          primaryColor: formData.primaryColor,
          secondaryColor: formData.secondaryColor,
          domain: formData.customDomain,
      
        updatedAt: serverTimestamp(),
      });

      dispatch(
        setAgencyData({
          branding: formData,
        })
      );

      toast.success("Branding updated successfully!");
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
    <div className="p-6 border border-gray-200 rounded-2xl shadow-sm bg-white dark:bg-gray-900 dark:border-gray-700">
      <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">
        Agency Branding
      </h3>

      {/* LOGO */}
      <div className="flex items-center gap-4 mb-6">
        <div
          className="w-20 h-20 rounded-full border flex items-center justify-center bg-gray-50 overflow-hidden"
          style={{ borderColor: formData.primaryColor }}
        >
          {formData.logo ? (
            <img
              src={formData.logo}
              alt="Agency Logo"
              className="w-16 h-16 object-contain"
            />
          ) : (
            <span className="text-gray-400 text-sm">No Logo</span>
          )}
        </div>
        <input
          type="text"
          placeholder="Paste logo URL"
          name="logo"
          value={formData.logo}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, logo: e.target.value }))
          }
          className="w-full px-3 py-2 border rounded-lg text-sm"
        />
      </div>

      {/* COLORS */}
      <div className="flex gap-6 mb-6">
        <div>
          <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Primary Color
          </label>
          <input
            type="color"
            value={formData.primaryColor}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, primaryColor: e.target.value }))
            }
            className="w-14 h-10 cursor-pointer"
          />
        </div>

        <div>
          <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Secondary Color
          </label>
          <input
            type="color"
            value={formData.secondaryColor}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                secondaryColor: e.target.value,
              }))
            }
            className="w-14 h-10 cursor-pointer"
          />
        </div>
      </div>

      {/* DOMAIN */}
      <div className="mb-6">
        <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          Custom Domain
        </label>
        <input
          type="text"
          name="customDomain"
          value={formData.customDomain}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, customDomain: e.target.value }))
          }
          placeholder="youragency.com"
          className="w-full px-3 py-2 border rounded-lg focus:ring focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-700"
        />
      </div>

      {/* PREVIEW */}
     {/* Preview Section */}
      <div className="mt-10 border-t pt-6">
        <h4 className="text-md font-semibold mb-3 text-gray-700 dark:text-gray-200">
          Live Branding Preview
        </h4>
        <div
          className="rounded-xl overflow-hidden shadow-sm border"
          style={{
            borderColor: formData.primaryColor,
          }}
        >
          {/* Simulated Header */}
          <div
            className="flex items-center justify-between px-6 py-3"
            style={{
              backgroundColor: formData.primaryColor,
              color: "#fff",
            }}
          >
            <div className="flex items-center gap-3">
              {formData.logo && (
                <img
                  src={formData.logo}
                  alt="Agency Logo"
                  className="w-8 h-8 rounded-full object-cover"
                />
              )}
              <span className="font-semibold">Your Agency</span>
            </div>
            <span
              className="text-sm font-medium"
              style={{ color: formData.secondaryColor }}
            >
              {formData.customDomain || "youragency.com"}
            </span>
          </div>

          {/* Simulated Dashboard */}
          <div className="p-6 bg-gray-50">
            <p className="text-gray-700 mb-2 font-medium">
              Dashboard Overview
            </p>
            <div
              className="rounded-lg h-24 flex items-center justify-center text-gray-600 text-sm"
              style={{
                backgroundColor: formData.secondaryColor + "20",
                border: `1px solid ${formData.secondaryColor}40`,
              }}
            >
              This is how your theme will look
            </div>
          </div>
          </div>
          </div>

      {/* SAVE BUTTON */}
      <button
        onClick={handleSave}
        disabled={isSaving}
        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium shadow flex items-center justify-center gap-2 w-full"
      >
        {isSaving ? (
          <>
            <FaSpinner className="w-4 h-4 animate-spin" />
            Saving...
          </>
        ) : (
          "Save Branding"
        )}
      </button>
    </div>
  );
}
