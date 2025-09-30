"use client";
import React, { useState } from "react";
import { useSelector } from "react-redux";
import styles from "./AgencyBranding.module.css";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { setAgencyData } from "@/redux/slices/agencySlice";

export default function AgencyBranding() {
  const dispatch = useAppDispatch();
  const branding = useAppSelector((state) => state.agency.branding);

  const [formData, setFormData] = useState({
    logo: branding.logo,
    primaryColor: branding.primaryColor,
    customDomain: branding.customDomain,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    dispatch(setAgencyData({branding:formData}));
    alert("Branding saved (Redux state updated)");
  };

  return (
    <div className="p-6 border border-gray-200 rounded-2xl shadow-sm bg-white dark:bg-gray-900 dark:border-gray-700">
      <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">
        Agency Branding
      </h3>

      <div className="flex items-center gap-4 mb-6">
        <div className={`${styles.logoBox} w-20 h-20 rounded-full flex items-center justify-center border`}>
          <img src={formData.logo} alt="Agency Logo" className="w-16 h-16 object-contain" />
        </div>
        <button className="px-4 py-2 rounded-lg border bg-gray-50 hover:bg-gray-100 text-sm">
          Upload Logo (placeholder)
        </button>
      </div>

      {/* Primary Color */}
      <div className="mb-6">
        <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          Primary Color
        </label>
        <input
          type="color"
          name="primaryColor"
          value={formData.primaryColor}
          onChange={handleChange}
          className="w-16 h-10 cursor-pointer"
        />
      </div>

      {/* Custom Domain */}
      <div className="mb-6">
        <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          Custom Domain
        </label>
        <input
          type="text"
          name="customDomain"
          value={formData.customDomain}
          onChange={handleChange}
          placeholder="youragency.com"
          className="w-full px-3 py-2 border rounded-lg focus:ring focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-700"
        />
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium shadow"
      >
        Save
      </button>
    </div>
  );
}
