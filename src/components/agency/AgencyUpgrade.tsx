// components/agency/AgencyTierUpgrade.tsx
"use client";
import React, { useState } from "react";
import { useModal } from "@/hooks/useModal";
import { Modal } from "@/components/ui/modal";
import { toast } from "sonner";


interface Subscription {
  billingCycle: string;
  credits: number;
  seats: number;
  status: string;
  tier: string;
  updatedAt: any;
  price: number;
}

interface Tier {
  name: string;
  price: number;
  seats: number;
  credits: number;
  features: string[];
  color: string;
  popular?: boolean;
  premium?: boolean;
}

interface AgencyTierUpgradeProps {
  agencyData: any;
  userType: 'agency' | 'client' | null;
  onTierUpdate?: () => void;
}

// Tier definitions with proper typing
const AGENCY_TIERS: Record<string, Tier> = {
  EntryAgency: {
    name: "Entry Agency",
    price: 1000,
    seats: 10,
    credits: 50,
    features: [
      "10 client seats",
      "50 credits/month",
      "White-label dashboard",
      "Basic analytics"
    ],
    color: "from-blue-500 to-cyan-500"
  },
  GrowthAgency: {
    name: "Growth Agency",
    price: 1500,
    seats: 30,
    credits: 150,
    features: [
      "30 client seats",
      "150 credits/month",
      "Advanced analytics",
      "Priority support",
      "Custom branding"
    ],
    color: "from-purple-500 to-pink-500",
    popular: true
  },
  ProAgency: {
    name: "Pro Agency",
    price: 2500,
    seats: 50,
    credits: 500,
    features: [
      "50+ client seats",
      "500+ credits/month",
      "Enterprise features",
      "API access",
      "Dedicated support",
      "Custom integrations"
    ],
    color: "from-orange-500 to-red-500",
    premium: true
  }
};

function AgencyTierUpgrade({ agencyData, userType, onTierUpdate }: AgencyTierUpgradeProps) {
  const { isOpen: isTierModalOpen, openModal: openTierModal, closeModal: closeTierModal } = useModal();
  
  const [selectedTier, setSelectedTier] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Get subscription data
  const subscription: Subscription = agencyData?.subscription || {
    credits: 0,
    seats: 0,
    status: "unpaid",
    tier: "EntryAgency",
    billingCycle: "monthly",
    updatedAt: null,
    price: 0
  };

  const currentTier = AGENCY_TIERS[subscription.tier];
  const currentClientCount = agencyData?.clients?.length || 0;

  const handleOpenTierModal = () => {
    setSelectedTier("");
    openTierModal();
  };

const handleTierUpgrade = async () => {
  if (!selectedTier) {
    toast.error("Please select a tier to upgrade");
    return;
  }

  const selectedTierData = AGENCY_TIERS[selectedTier];
  const stripeSubscriptionId = agencyData?.subscription?.stripeSubscriptionId;

  if (!stripeSubscriptionId) {
    toast.error("No active subscription found. Please contact support.");
    return;
  }

  // Check if current clients exceed new tier's seat limit
  if (currentClientCount > selectedTierData.seats) {
    toast.error(`Cannot downgrade: You have ${currentClientCount} clients but ${selectedTierData.name} only allows ${selectedTierData.seats} seats`);
    return;
  }

  setIsProcessing(true);

  try {
    // Call backend function to update tier
    const baseUrl = process.env.NEXT_PUBLIC_FUNCTIONS_EMULATOR_URL || "";
    const endpoint = baseUrl
      ? `${baseUrl}/updateAgencyTier`
      : "/api/update-agency-tier";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agencyId: agencyData.agencyId,
        newTier: selectedTier,
        stripeSubscriptionId: stripeSubscriptionId,
        tierData: {
          price: selectedTierData.price,
          seats: selectedTierData.seats,
          credits: selectedTierData.credits,
          name: selectedTierData.name
        }
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Failed to update tier");
    }

    toast.success(`Successfully upgraded to ${selectedTierData.name}!`);
    
    // Close modal and refresh data
  
    
    // Call callback to refresh parent component data
    if (onTierUpdate) {
      onTierUpdate();
    }
      closeTierModal();
    setIsProcessing(false);

  } catch (error:any) {
    console.error("Error updating tier:", error);
    toast.error(error.message || "Failed to update tier. Please try again.");
    setIsProcessing(false);
  }
};

  const calculateProratedPrice = (newTierPrice: number) => {
    const currentTierPrice = currentTier?.price || 0;
    const difference = newTierPrice - currentTierPrice;
    
    if (difference > 0) {
      return `+$${difference}/mo`;
    } else if (difference < 0) {
      return `-$${Math.abs(difference)}/mo`;
    } else {
      return "Same price";
    }
  };

  // Don't show for clients
  if (userType === 'client') {
    return null;
  }

  return (
    <>
      {/* Change Tier Button - to be placed beside Add Credits button */}
      <button
        onClick={handleOpenTierModal}
        className="px-6 py-3 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg transition-all duration-200 hover:bg-gray-50 hover:border-gray-400"
      >
        Change Tier
      </button>

      {/* Tier Upgrade Modal */}
      <Modal isOpen={isTierModalOpen} onClose={closeTierModal} className="max-w-6xl max-h-[100dvh] overflow-auto p-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
            <span className="text-white text-xl">🚀</span>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              Upgrade Your Agency Plan
            </h3>
            <p className="text-gray-600">
              Choose the perfect plan for your growing agency. All plans include white-label features and client management.
            </p>
          </div>
        </div>

        {/* Current Plan Banner */}
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-gray-900 text-lg mb-2">Current Plan</h4>
              <p className="text-gray-700">
                <span className="font-semibold">{currentTier?.name}</span> • 
                ${currentTier?.price}/month • 
                {currentTier?.seats} seats • 
                {currentTier?.credits} credits
              </p>
              <p className="text-gray-600 text-sm mt-1">
                {currentClientCount} of {currentTier?.seats} seats used
              </p>
            </div>
            <div className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg font-semibold">
              Active
            </div>
          </div>
        </div>

        {/* Tier Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {Object.entries(AGENCY_TIERS).map(([tierKey, tier]) => {
            const isCurrentTier = tierKey === subscription.tier;
            const isSelected = selectedTier === tierKey;
            
            return (
              <div
                key={tierKey}
                className={`relative border-2 rounded-2xl p-6 transition-all cursor-pointer ${
                  isSelected
                    ? 'border-purple-500 bg-purple-50 shadow-lg scale-[1.02]'
                    : isCurrentTier
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                } ${tier.popular ? 'ring-2 ring-purple-500 ring-opacity-30' : ''}`}
                onClick={() => !isCurrentTier && setSelectedTier(tierKey)}
              >
                {/* Popular Badge */}
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="px-4 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full font-semibold text-sm">
                      MOST POPULAR
                    </span>
                  </div>
                )}

                {/* Premium Badge */}
                {tier.premium && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="px-4 py-1 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-full font-semibold text-sm">
                      PREMIUM
                    </span>
                  </div>
                )}

                {/* Current Plan Badge */}
                {isCurrentTier && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="px-4 py-1 bg-blue-500 text-white rounded-full font-semibold text-sm">
                      CURRENT PLAN
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h4 className="font-bold text-gray-900 text-xl mb-2">{tier.name}</h4>
                  <div className={`inline-flex items-baseline justify-center mb-3 bg-gradient-to-r ${tier.color} text-white px-4 py-2 rounded-lg`}>
                    <span className="text-2xl font-bold">${tier.price}</span>
                    <span className="ml-1">/month</span>
                  </div>
                  
                  {!isCurrentTier && (
                    <p className="text-sm font-medium text-gray-600">
                      {calculateProratedPrice(tier.price)}
                    </p>
                  )}
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Client Seats</span>
                    <span className="font-semibold text-gray-900">{tier.seats}+</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Monthly Credits</span>
                    <span className="font-semibold text-gray-900">{tier.credits}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-gray-600">Rollover</span>
                    <span className="font-semibold text-gray-900">10%</span>
                  </div>
                </div>

                <ul className="space-y-2 mb-6">
                  {tier.features.map((feature, index) => (
                    <li key={index} className="flex items-center text-sm text-gray-600">
                      <svg className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="text-center">
                  {isCurrentTier ? (
                    <button
                      disabled
                      className="w-full py-3 bg-gray-100 text-gray-400 rounded-lg font-semibold cursor-not-allowed"
                    >
                      Current Plan
                    </button>
                  ) : (
                    <button
                      className={`w-full py-3 font-semibold rounded-lg transition-all ${
                        isSelected
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {isSelected ? 'Selected' : 'Select Plan'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Plan Summary */}
        {selectedTier && (
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-6 border border-gray-200 mb-6">
            <h4 className="font-bold text-gray-900 mb-4 text-lg">Plan Change Summary</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex justify-between items-center py-3 border-b border-gray-200">
                  <span className="text-gray-600">Current Plan</span>
                  <span className="font-semibold text-gray-900">{currentTier?.name}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-200">
                  <span className="text-gray-600">New Plan</span>
                  <span className="font-semibold text-gray-900">
                    {AGENCY_TIERS[selectedTier]?.name}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="text-gray-600">Monthly Change</span>
                  <span className={`font-bold text-lg ${
                    AGENCY_TIERS[selectedTier]?.price > (currentTier?.price || 0)
                      ? 'text-green-600'
                      : 'text-orange-600'
                  }`}>
                    {calculateProratedPrice(AGENCY_TIERS[selectedTier]?.price || 0)}
                  </span>
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center py-3 border-b border-gray-200">
                  <span className="text-gray-600">New Seat Limit</span>
                  <span className="font-semibold text-gray-900">
                    {AGENCY_TIERS[selectedTier]?.seats} seats
                  </span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-200">
                  <span className="text-gray-600">New Monthly Credits</span>
                  <span className="font-semibold text-gray-900">
                    {AGENCY_TIERS[selectedTier]?.credits} credits
                  </span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="text-gray-600">Your Clients</span>
                  <span className="font-semibold text-gray-900">
                    {currentClientCount} clients
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-4">
          <button
            onClick={closeTierModal}
            className="px-6 py-3 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleTierUpgrade}
            disabled={!selectedTier || isProcessing}
            className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:transform-none disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <div className="flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Processing Upgrade...
              </div>
            ) : (
              `Upgrade to ${selectedTier ? AGENCY_TIERS[selectedTier]?.name : 'Plan'}`
            )}
          </button>
        </div>
      </Modal>
    </>
  );
}

export default AgencyTierUpgrade