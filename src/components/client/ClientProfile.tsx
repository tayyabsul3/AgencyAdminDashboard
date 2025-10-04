// components/client/ClientProfile.tsx
"use client";
import React from "react";
import { useAppSelector } from "@/redux/hooks";

export default function ClientProfile() {
  const client = useAppSelector((state) => state.client);

  // Format timestamp to readable date
  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A";
    
    try {
      if (timestamp.toDate) {
        // Firestore timestamp
        return timestamp.toDate().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      } else if (timestamp.seconds) {
        // Firestore timestamp from server
        return new Date(timestamp.seconds * 1000).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
      return "Invalid Date";
    } catch (error) {
      return "N/A";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
            Client Profile
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your account and view your usage
          </p>
        </div>
        <div className="px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full text-sm font-medium">
          {client.status?.charAt(0).toUpperCase() + client.status?.slice(1) || "Active"}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Personal Information Card */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">
              Personal Information
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Full Name</label>
                <p className="text-gray-800 dark:text-white/90 text-lg">{client.name || "N/A"}</p>
              </div>
              
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Email Address</label>
                <p className="text-gray-800 dark:text-white/90 text-lg">{client.email || "N/A"}</p>
              </div>
              
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">User ID</label>
                <p className="text-gray-800 dark:text-white/90 font-mono text-sm break-all">{client.userId || "N/A"}</p>
              </div>
              
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Account Status</label>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    client.status === 'active' ? 'bg-green-500' : 'bg-gray-400'
                  }`}></div>
                  <p className="text-gray-800 dark:text-white/90 capitalize">{client.status || "N/A"}</p>
                </div>
              </div>
              
              
          </div>

          {/* Subscription & Usage */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">
              Subscription & Usage
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Plan Tier</label>
                <p className="text-gray-800 dark:text-white/90 capitalize">{client.tier || "N/A"}</p>
              </div>
              
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Articles Generated</label>
                <p className="text-gray-800 dark:text-white/90 text-2xl font-semibold ">
                  {client.articlesGenerated || 0}
                </p>
              </div>
              
              {client.agencySubscription && (
                <>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Agency Credits Available</label>
                    <p className="text-gray-800 dark:text-white/90 text-lg">
                      {client.agencySubscription.credits || 0} credits
                    </p>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Agency Plan</label>
                    <p className="text-gray-800 dark:text-white/90 capitalize">
                      {client.agencySubscription.tier || "N/A"}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Agency Information Card */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">
              Agency Information
            </h2>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Agency Name</label>
                <p className="text-gray-800 dark:text-white/90 text-lg">{client.agencyName || "N/A"}</p>
              </div>
              
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Agency ID</label>
                <p className="text-gray-800 dark:text-white/90 font-mono text-sm break-all">{client.agencyId || "N/A"}</p>
              </div>
              
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Owner ID</label>
                <p className="text-gray-800 dark:text-white/90 font-mono text-sm break-all">{client.ownerId || "N/A"}</p>
              </div>
              
              <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  You are part of an agency workspace. Your subscription and usage are managed through the agency's plan.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">
              Quick Actions
            </h2>
            
            <div className="space-y-3">
              <button className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <p className="font-medium text-gray-800 dark:text-white/90">Generate Article</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Create new content</p>
              </button>
              
              <button className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <p className="font-medium text-gray-800 dark:text-white/90">View Usage History</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Check your activity</p>
              </button>
              
              <button className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <p className="font-medium text-gray-800 dark:text-white/90">Contact Agency</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Get support</p>
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Data Debug Section (Remove in production) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-400 mb-2">
            Debug Information
          </h3>
          <pre className="text-xs text-yellow-700 dark:text-yellow-300 overflow-auto">
            {JSON.stringify(client, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}