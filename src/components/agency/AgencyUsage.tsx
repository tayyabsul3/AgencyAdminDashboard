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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
            Client Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Monitor client usage and manage your agency credits
          </p>
        </div>
        <div className="flex gap-3">
          <div className="px-3 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full text-sm font-medium">
            {subscription.tier}
          </div>
          <Button
            onClick={openAddCreditsModal}
            className="rounded-full bg-green-500 hover:bg-green-600 px-5 py-2 text-white"
          >
            Buy Credits +
          </Button>
        </div>
      </div>

      {/* Agency Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Clients</p>
              <p className="text-2xl font-semibold text-gray-800 dark:text-white/90 mt-1">
                {clients.length}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {usedSeats}/{subscription.seats} seats used
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <span className="text-2xl">👥</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Articles Generated</p>
              <p className="text-2xl font-semibold text-gray-800 dark:text-white/90 mt-1">
                {totalArticlesGenerated}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Across all clients
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <span className="text-2xl">📊</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Credits Used</p>
              <p className="text-2xl font-semibold text-gray-800 dark:text-white/90 mt-1">
                {totalCreditsUsed}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                1 article = 1 credit
              </p>
            </div>
            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <span className="text-2xl">🔥</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Available Credits</p>
              <p className="text-2xl font-semibold text-gray-800 dark:text-white/90 mt-1">
                {availableCredits}
              </p>
              <p className={`text-xs mt-1 ${
                availableCredits < 10 
                  ? 'text-red-500 dark:text-red-400' 
                  : 'text-gray-500 dark:text-gray-400'
              }`}>
                {availableCredits < 10 ? 'Low credits' : 'Remaining'}
              </p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <span className="text-2xl">💎</span>
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Status */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-white/90">Subscription Status</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {subscription.tier} Plan • {subscription.billingCycle} • {subscription.status}
            </p>
          </div>
          <div className="flex gap-2">
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              subscription.status === 'active' 
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : subscription.status === 'unpaid'
                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}>
              {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
            </div>
            <div className="px-3 py-1 bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400 rounded-full text-sm font-medium">
              Updated: {formatFirestoreTimestamp(subscription.updatedAt)}
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="w-full sm:w-64">
            <Input
              type="text"
              placeholder="Search clients by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button className="rounded-full border border-gray-300 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              Active ({clients.filter(c => c.status === 'active').length})
            </Button>
            <Button className="rounded-full border border-gray-300 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              All Clients ({clients.length})
            </Button>
          </div>
        </div>
      </div>

      {/* Clients Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Client</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Status</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Articles Generated</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Credits Used</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Joined Date</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredClients.map((client) => (
                <tr key={client.userId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-800 dark:text-white/90">{client.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{client.email}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-1">
                        {client.userId.substring(0, 8)}...
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      client.status === 'active' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                    }`}>
                      {client.status.charAt(0).toUpperCase() + client.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold text-gray-800 dark:text-white/90">
                        {client.articlesGenerated || 0}
                      </span>
                      {(client.articlesGenerated || 0) > 0 && (
                        <span className="text-xs text-green-600 dark:text-green-400">
                          +{client.articlesGenerated} credits
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-800 dark:text-white/90 font-medium">
                      {client.articlesGenerated || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {formatFirestoreTimestamp(client.createdAt)}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleViewClientDetails(client)}
                      className="text-brand-500 hover:text-brand-600 dark:text-brand-400 text-sm font-medium"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
              
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <span className="text-4xl mb-4">👥</span>
                      <p className="text-gray-500 dark:text-gray-400 text-lg">
                        {searchTerm ? 'No clients found' : 'No clients yet'}
                      </p>
                      <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
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
      <Modal isOpen={isAddCreditsOpen} onClose={closeAddCreditsModal} className="max-w-4xl p-6">
        <h3 className="text-2xl font-bold text-gray-800 dark:text-white/90 mb-2">
          Buy Additional Credits
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Purchase credits to continue generating articles for your clients. Current balance: {availableCredits} credits.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Credit Packages */}
          <div>
            <Label className="mb-4 block">Choose a Package</Label>
            <div className="space-y-3">
              {getCreditPackages().map((pkg, index) => (
                <div
                  key={index}
                  className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
                    creditAmount === pkg.credits
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 dark:border-brand-400'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  } ${pkg.popular ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}`}
                  onClick={() => setCreditAmount(pkg.credits)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-gray-800 dark:text-white/90">
                        {pkg.credits} Credits
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        ${pkg.price.toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {pkg.popular && (
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
                          Popular
                        </span>
                      )}
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        creditAmount === pkg.credits
                          ? 'border-brand-500 bg-brand-500'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}></div>
                    </div>
                  </div>
                  {pkg.popular && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                      Best value per credit
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Custom Amount */}
            <div className="mt-6">
              <Label>Or enter custom amount</Label>
              <Input
                type="number"
                min="1"
                value={creditAmount}
                onChange={(e) => setCreditAmount(parseInt(e.target.value) || 1)}
                className="mt-2"
              />
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6">
            <h4 className="font-semibold text-gray-800 dark:text-white/90 mb-4">Order Summary</h4>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Credits</span>
                <span className="font-medium text-gray-800 dark:text-white/90">{creditAmount}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Price per credit</span>
                <span className="font-medium text-gray-800 dark:text-white/90">
                  ${(creditAmount <= 10 ? 0.99 : creditAmount <= 25 ? 0.92 : creditAmount <= 50 ? 0.80 : creditAmount <= 100 ? 0.75 : 0.72).toFixed(2)}
                </span>
              </div>
              
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                <div className="flex justify-between text-lg font-semibold">
                  <span className="text-gray-800 dark:text-white/90">Total</span>
                  <span className="text-brand-500">
                    ${(creditAmount * (creditAmount <= 10 ? 0.99 : creditAmount <= 25 ? 0.92 : creditAmount <= 50 ? 0.80 : creditAmount <= 100 ? 0.75 : 0.72)).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <Button
                onClick={handleAddCredits}
                className="w-full bg-green-500 hover:bg-green-600 text-white py-3"
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processing Payment...
                  </div>
                ) : (
                  `Buy ${creditAmount} Credits - $${(creditAmount * (creditAmount <= 10 ? 0.99 : creditAmount <= 25 ? 0.92 : creditAmount <= 50 ? 0.80 : creditAmount <= 100 ? 0.75 : 0.72)).toFixed(2)}`
                )}
              </Button>
              
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                Secure payment processed by Stripe. Your financial information is encrypted and secure.
              </p>
            </div>
          </div>
        </div>
      </Modal>

      {/* Client Details Modal */}
      <Modal isOpen={isClientDetailOpen} onClose={closeClientDetailModal} className="max-w-2xl p-6">
        {selectedClient && (
          <>
            <h3 className="text-2xl font-bold text-gray-800 dark:text-white/90 mb-2">
              {selectedClient.name}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{selectedClient.email}</p>

            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Articles Generated</p>
                <p className="text-2xl font-semibold text-gray-800 dark:text-white/90">
                  {selectedClient.articlesGenerated || 0}
                </p>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Credits Used</p>
                <p className="text-2xl font-semibold text-gray-800 dark:text-white/90">
                  {selectedClient.articlesGenerated || 0}
                </p>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h4 className="font-semibold text-gray-800 dark:text-white/90 mb-3">Client Information</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">User ID:</span>
                  <span className="font-mono text-gray-800 dark:text-white/90 text-xs">
                    {selectedClient.userId}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Status:</span>
                  <span className="capitalize text-gray-800 dark:text-white/90">{selectedClient.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Tier:</span>
                  <span className="text-gray-800 dark:text-white/90 capitalize">{selectedClient.tier}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Joined:</span>
                  <span className="text-gray-800 dark:text-white/90">
                    {formatFirestoreTimestamp(selectedClient.createdAt)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Last Updated:</span>
                  <span className="text-gray-800 dark:text-white/90">
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