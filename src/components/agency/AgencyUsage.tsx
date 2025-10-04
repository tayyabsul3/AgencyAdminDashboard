// components/agency/AgencyClientManagement.tsx
"use client";
import React, { useState } from "react";
import { useModal } from "@/hooks/useModal";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { toast } from "sonner";
import { withUserData } from "@/components/WithUserData";

interface Client {
  userId: string;
  name: string;
  email: string;
  status: "active" | "inactive";
  articlesGenerated: number;
  tier: string;
  createdAt: any;
  updatedAt: any;
  agencyId: string;
  agencyName: string;
  ownerId: string;
}

interface Subscription {
  billingCycle: string;
  credits: number;
  seats: number;
  status: string;
  tier: string;
  updatedAt: any;
}

interface AgencyClientManagementProps {
  agencyData: any;
  clientData: any;
  userType: 'agency' | 'client' | null;
}

function AgencyClientManagement({ agencyData, userType }: AgencyClientManagementProps) {
  const { isOpen: isAddCreditsOpen, openModal: openAddCreditsModal, closeModal: closeAddCreditsModal } = useModal();
  const { isOpen: isClientDetailOpen, openModal: openClientDetailModal, closeModal: closeClientDetailModal } = useModal();
  
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [creditAmount, setCreditAmount] = useState(10);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Get clients from agencyData
  const clients: Client[] = agencyData?.clients || [];

  // Get subscription data
  const subscription: Subscription = agencyData?.subscription || {
    credits: 0,
    seats: 0,
    status: "unpaid",
    tier: "EntryAgency",
    billingCycle: "monthly",
    updatedAt: null
  };

  // Filter clients based on search
  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate total usage
  const totalArticlesGenerated = clients.reduce((sum, client) => sum + (client.articlesGenerated || 0), 0);
  const totalCreditsUsed = totalArticlesGenerated; // 1 article = 1 credit
  const availableCredits = subscription.credits || 0;
  const usedSeats = clients.length;
  const availableSeats = (subscription.seats || 0) - usedSeats;

  // Format Firestore timestamp
  const formatFirestoreTimestamp = (timestamp: any) => {
    if (!timestamp) return "N/A";
    
    try {
      if (timestamp.toDate) {
        return timestamp.toDate().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      } else if (timestamp.seconds) {
        return new Date(timestamp.seconds * 1000).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      }
      return "Invalid Date";
    } catch (error) {
      return "N/A";
    }
  };

  const handleAddCredits = async () => {
    if (creditAmount < 1) {
      toast.error("Please enter a valid credit amount");
      return;
    }

    setIsProcessing(true);
    
    // Simulate payment processing
    setTimeout(() => {
      toast.success(`Successfully added ${creditAmount} credits to your account!`);
      closeAddCreditsModal();
      setCreditAmount(10);
      setIsProcessing(false);
      
      // In real implementation:
      // 1. Process payment via Stripe/other provider
      // 2. Update agency subscription credits in Firestore
      // 3. Refresh data
    }, 2000);
  };

  const handleViewClientDetails = (client: Client) => {
    setSelectedClient(client);
    openClientDetailModal();
  };

  const getCreditPackages = () => [
    { credits: 10, price: 9.99, popular: false },
    { credits: 25, price: 22.99, popular: false },
    { credits: 50, price: 39.99, popular: true },
    { credits: 100, price: 74.99, popular: false },
    { credits: 250, price: 179.99, popular: false },
  ];

  // Don't show for clients
  if (userType === 'client') {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="text-4xl mb-4">👥</div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90 mb-2">
            Agency Portal
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            This section is for agency owners only.
          </p>
        </div>
      </div>
    );
  }

 return (
  <div className="space-y-8">
    {/* Header */}
    <div className="flex justify-between items-center">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Client Management
        </h1>
        <p className="text-gray-600">
          Monitor client usage and manage your agency credits
        </p>
      </div>
      <div className="flex items-center gap-4">
        <div className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-semibold">
          {subscription.tier}
        </div>
        <button
          onClick={openAddCreditsModal}
          className="px-6 py-3 text-white font-semibold rounded-lg transition-all duration-200 hover:scale-[1.02]"
          style={{
            background: 'linear-gradient(135deg, #6aa6ff 0%, #6c71ff 50%, #6de0ff 100%)',
            boxShadow: '0 4px 12px rgba(76, 110, 245, 0.3)'
          }}
        >
          Buy Credits +
        </button>
      </div>
    </div>

    {/* Agency Overview Cards */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-600 font-medium">Total Clients</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {clients.length}
            </p>
            <p className="text-gray-500 mt-1">
              {usedSeats}/{subscription.seats} seats used
            </p>
          </div>
          <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
            <span className="text-white text-lg">👥</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-600 font-medium">Articles Generated</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {totalArticlesGenerated}
            </p>
            <p className="text-gray-500 mt-1">
              Across all clients
            </p>
          </div>
          <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
            <span className="text-white text-lg">📊</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-600 font-medium">Credits Used</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {totalCreditsUsed}
            </p>
            <p className="text-gray-500 mt-1">
              1 article = 1 credit
            </p>
          </div>
          <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl flex items-center justify-center">
            <span className="text-white text-lg">🔥</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-600 font-medium">Available Credits</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {availableCredits}
            </p>
            <p className={`font-medium mt-1 ${
              availableCredits < 10 
                ? 'text-red-600' 
                : 'text-gray-500'
            }`}>
              {availableCredits < 10 ? 'Low credits' : 'Remaining'}
            </p>
          </div>
          <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
            <span className="text-white text-lg">💎</span>
          </div>
        </div>
      </div>
    </div>

    {/* Subscription Status */}
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h3 className="font-bold text-gray-900 text-lg">Subscription Status</h3>
          <p className="text-gray-600">
            {subscription.tier} Plan • {subscription.billingCycle} • {subscription.status}
          </p>
        </div>
        <div className="flex gap-3">
          <div className={`px-4 py-2 rounded-lg font-semibold ${
            subscription.status === 'active' 
              ? 'bg-green-100 text-green-700' 
              : subscription.status === 'unpaid'
              ? 'bg-yellow-100 text-yellow-700'
              : 'bg-red-100 text-red-700'
          }`}>
            {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
          </div>
          <div className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium">
            Updated: {formatFirestoreTimestamp(subscription.updatedAt)}
          </div>
        </div>
      </div>
    </div>

    {/* Search and Filters */}
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
        <div className="w-full lg:w-80">
          <div className="relative">
            <input
              type="text"
              placeholder="Search clients by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 pl-11 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            />
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors">
            Active ({clients.filter(c => c.status === 'active').length})
          </button>
          <button className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors">
            All Clients ({clients.length})
          </button>
        </div>
      </div>
    </div>

    {/* Clients Table */}
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-6 py-4 text-left font-semibold text-gray-900">Client</th>
              <th className="px-6 py-4 text-left font-semibold text-gray-900">Status</th>
              <th className="px-6 py-4 text-left font-semibold text-gray-900">Articles</th>
              <th className="px-6 py-4 text-left font-semibold text-gray-900">Credits Used</th>
              <th className="px-6 py-4 text-left font-semibold text-gray-900">Joined Date</th>
              <th className="px-6 py-4 text-left font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredClients.map((client) => (
              <tr key={client.userId} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <div>
                    <p className="font-semibold text-gray-900">{client.name}</p>
                    <p className="text-gray-600">{client.email}</p>
                    <p className="text-gray-400 font-mono mt-1">
                      {client.userId.substring(0, 8)}...
                    </p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full font-medium ${
                    client.status === 'active' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {client.status === 'active' && (
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    )}
                    {client.status.charAt(0).toUpperCase() + client.status.slice(1)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-gray-900">
                      {client.articlesGenerated || 0}
                    </span>
                    {(client.articlesGenerated || 0) > 0 && (
                      <span className="text-green-600 font-medium">
                        +{client.articlesGenerated}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-gray-900 font-bold">
                    {client.articlesGenerated || 0}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-600">
                  {formatFirestoreTimestamp(client.createdAt)}
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => handleViewClientDetails(client)}
                    className="text-blue-600 hover:text-blue-700 font-semibold transition-colors"
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
            
            {filteredClients.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <span className="text-2xl">👥</span>
                    </div>
                    <p className="text-gray-900 font-semibold text-lg mb-2">
                      {searchTerm ? 'No clients found' : 'No clients yet'}
                    </p>
                    <p className="text-gray-600">
                      {searchTerm ? 'Try adjusting your search terms' : 'Start by inviting clients to your agency'}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>

    {/* Add Credits Modal */}
    <Modal isOpen={isAddCreditsOpen} onClose={closeAddCreditsModal} className="max-w-4xl p-8">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
          <span className="text-white text-xl">💎</span>
        </div>
        <div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            Buy Additional Credits
          </h3>
          <p className="text-gray-600">
            Purchase credits to continue generating articles for your clients. Current balance: {availableCredits} credits.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Credit Packages */}
        <div>
          <h4 className="font-bold text-gray-900 mb-4">Choose a Package</h4>
          <div className="space-y-4">
            {getCreditPackages().map((pkg, index) => (
              <div
                key={index}
                className={`border-2 rounded-xl p-5 cursor-pointer transition-all ${
                  creditAmount === pkg.credits
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-200 hover:border-gray-300'
                } ${pkg.popular ? 'ring-2 ring-blue-500 ring-opacity-30' : ''}`}
                onClick={() => setCreditAmount(pkg.credits)}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold text-gray-900 text-lg">
                      {pkg.credits} Credits
                    </p>
                    <p className="text-gray-600">
                      ${pkg.price.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {pkg.popular && (
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                        Popular
                      </span>
                    )}
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      creditAmount === pkg.credits
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300'
                    }`}>
                      {creditAmount === pkg.credits && (
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </div>
                  </div>
                </div>
                {pkg.popular && (
                  <p className="text-blue-600 font-medium mt-2">
                    Best value per credit
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Custom Amount */}
          <div className="mt-6">
            <label className="block font-semibold text-gray-900 mb-2">Or enter custom amount</label>
            <input
              type="number"
              min="1"
              value={creditAmount}
              onChange={(e) => setCreditAmount(parseInt(e.target.value) || 1)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            />
          </div>
        </div>

        {/* Order Summary */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6 border border-gray-200">
          <h4 className="font-bold text-gray-900 mb-6 text-lg">Order Summary</h4>
          
          <div className="space-y-4 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Credits</span>
              <span className="font-bold text-gray-900">{creditAmount}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Price per credit</span>
              <span className="font-bold text-gray-900">
                ${(creditAmount <= 10 ? 0.99 : creditAmount <= 25 ? 0.92 : creditAmount <= 50 ? 0.80 : creditAmount <= 100 ? 0.75 : 0.72).toFixed(2)}
              </span>
            </div>
            
            <div className="border-t border-gray-300 pt-4">
              <div className="flex justify-between items-center text-xl font-bold">
                <span className="text-gray-900">Total</span>
                <span className="text-blue-600">
                  ${(creditAmount * (creditAmount <= 10 ? 0.99 : creditAmount <= 25 ? 0.92 : creditAmount <= 50 ? 0.80 : creditAmount <= 100 ? 0.75 : 0.72)).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleAddCredits}
              disabled={isProcessing}
              className="w-full py-4 text-white font-bold rounded-lg transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:transform-none"
              style={{
                background: 'linear-gradient(135deg, #6aa6ff 0%, #6c71ff 50%, #6de0ff 100%)',
                boxShadow: '0 4px 12px rgba(76, 110, 245, 0.3)'
              }}
            >
              {isProcessing ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Processing Payment...
                </div>
              ) : (
                `Buy ${creditAmount} Credits - $${(creditAmount * (creditAmount <= 10 ? 0.99 : creditAmount <= 25 ? 0.92 : creditAmount <= 50 ? 0.80 : creditAmount <= 100 ? 0.75 : 0.72)).toFixed(2)}`
              )}
            </button>
            
            <p className="text-gray-500 text-center">
              Secure payment processed by Stripe. Your financial information is encrypted and secure.
            </p>
          </div>
        </div>
      </div>
    </Modal>

    {/* Client Details Modal */}
    <Modal isOpen={isClientDetailOpen} onClose={closeClientDetailModal} className="max-w-2xl p-8">
      {selectedClient && (
        <>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center">
              <span className="text-white text-xl font-bold">
                {selectedClient.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">
                {selectedClient.name}
              </h3>
              <p className="text-gray-600">{selectedClient.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-5 border border-blue-100">
              <p className="text-gray-600 font-medium">Articles Generated</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {selectedClient.articlesGenerated || 0}
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border border-green-100">
              <p className="text-gray-600 font-medium">Credits Used</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {selectedClient.articlesGenerated || 0}
              </p>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h4 className="font-bold text-gray-900 mb-4 text-lg">Client Information</h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-gray-600 font-medium">User ID:</span>
                <span className="font-mono text-gray-900 bg-gray-100 px-3 py-1 rounded-lg">
                  {selectedClient.userId.substring(0, 12)}...
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-gray-600 font-medium">Status:</span>
                <span className="capitalize text-gray-900 font-medium">{selectedClient.status}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-gray-600 font-medium">Tier:</span>
                <span className="text-gray-900 font-medium capitalize">{selectedClient.tier}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-gray-600 font-medium">Joined:</span>
                <span className="text-gray-900 font-medium">
                  {formatFirestoreTimestamp(selectedClient.createdAt)}
                </span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-gray-600 font-medium">Last Updated:</span>
                <span className="text-gray-900 font-medium">
                  {formatFirestoreTimestamp(selectedClient.updatedAt)}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </Modal>
  </div>
);
}

export default withUserData(AgencyClientManagement);