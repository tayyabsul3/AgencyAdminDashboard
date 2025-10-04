// components/client/ClientProfile.tsx
"use client";
import React from "react";
import { withUserData } from "@/components/WithUserData";

interface ClientProfileProps {
  agencyData: any;
  clientData: any;
  userType: 'agency' | 'client' | null;
}

function ClientProfile({ agencyData, clientData, userType }: ClientProfileProps) {
  const client = clientData;

  // Don't show profile for agencies
  if (userType === 'agency') {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🏢</div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90 mb-2">
            Agency Account
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            This profile page is for client accounts only.
          </p>
        </div>
      </div>
    );
  }

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
  <div className="space-y-8">
    {/* Header */}
    <div className="flex justify-between items-center">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          Client Profile
        </h1>
        <p className="text-gray-600 text-lg">
          Manage your account and view your usage
        </p>
      </div>
      <div className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-bold">
        {client.status?.charAt(0).toUpperCase() + client.status?.slice(1) || "Active"}
      </div>
    </div>

    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
      {/* Left Column - Personal Information & Usage */}
      <div className="xl:col-span-2 space-y-8">
        {/* Personal Information Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-lg">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Personal Information</h2>
              <p className="text-gray-600">Your account details and preferences</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="font-bold text-gray-700">Full Name</label>
              <p className="text-gray-900 text-lg font-medium">{client.name || "N/A"}</p>
            </div>
            
            <div className="space-y-2">
              <label className="font-bold text-gray-700">Email Address</label>
              <p className="text-gray-900 text-lg font-medium">{client.email || "N/A"}</p>
            </div>
            
            <div className="space-y-2">
              <label className="font-bold text-gray-700">User ID</label>
              <p className="text-gray-900 font-mono bg-gray-100 px-3 py-2 rounded-lg text-sm break-all">{client.userId || "N/A"}</p>
            </div>
            
            <div className="space-y-2">
              <label className="font-bold text-gray-700">Account Status</label>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  client.status === 'active' ? 'bg-green-500' : 'bg-gray-400'
                }`}></div>
                <p className="text-gray-900 font-medium capitalize">{client.status || "N/A"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Subscription & Usage Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-lg">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Usage & Analytics</h2>
              <p className="text-gray-600">Your content generation statistics</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="text-center">
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-6 border border-blue-200">
                <p className="text-gray-600 font-bold mb-2">Articles Generated</p>
                <p className="text-4xl font-bold text-gray-900 mb-2">
                  {client.articlesGenerated || 0}
                </p>
                <p className="text-gray-500">Total content created</p>
              </div>
            </div>
            
            <div className="text-center">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200">
                <p className="text-gray-600 font-bold mb-2">Plan Tier</p>
                <p className="text-2xl font-bold text-gray-900 mb-2 capitalize">
                  {client.tier || "Standard"}
                </p>
                <p className="text-gray-500">Current plan level</p>
              </div>
            </div>
          </div>

          {client.agencySubscription && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Agency Resources</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-4 border border-orange-200">
                  <p className="text-gray-600 font-bold">Available Credits</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {client.agencySubscription.credits || 0}
                  </p>
                  <p className="text-gray-500">Shared agency credits</p>
                </div>
                
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-200">
                  <p className="text-gray-600 font-bold">Agency Plan</p>
                  <p className="text-xl font-bold text-gray-900 capitalize">
                    {client.agencySubscription.tier || "N/A"}
                  </p>
                  <p className="text-gray-500">Current agency tier</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Column - Agency Info & Actions */}
      <div className="space-y-8">
        {/* Agency Information Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Agency Information</h2>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="font-bold text-gray-700">Agency Name</label>
              <p className="text-gray-900 text-lg font-medium">{client.agencyName || "N/A"}</p>
            </div>
            
            <div className="space-y-2">
              <label className="font-bold text-gray-700">Agency ID</label>
              <p className="text-gray-900 font-mono bg-gray-100 px-3 py-2 rounded-lg text-sm break-all">{client.agencyId || "N/A"}</p>
            </div>
            
            <div className="pt-4 border-t border-gray-200">
              <p className="text-gray-600 font-medium">
                You are part of an agency workspace. Your subscription and usage are managed through the agency's plan.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Quick Actions</h2>
          </div>
          
          <div className="space-y-4">
            <button className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-gray-900">Generate Article</p>
                  <p className="text-gray-600">Create new content</p>
                </div>
              </div>
            </button>
            
            <button className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-green-500 hover:bg-green-50 transition-all duration-200 group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-gray-900">View Usage History</p>
                  <p className="text-gray-600">Check your activity</p>
                </div>
              </div>
            </button>
            
            <button className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-purple-500 hover:bg-purple-50 transition-all duration-200 group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-gray-900">Contact Agency</p>
                  <p className="text-gray-600">Get support</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* Agency Message */}
    {client.agencyName && (
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl p-6 border border-blue-200">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Agency Managed Account</h3>
            <p className="text-gray-700">
              Your account is managed by <strong>{client.agencyName}</strong>. They handle your subscription, 
              billing, and have access to your usage analytics. Contact them for any account-related inquiries.
            </p>
          </div>
        </div>
      </div>
    )}
  </div>
);
}

// Export the wrapped component
export default withUserData(ClientProfile);