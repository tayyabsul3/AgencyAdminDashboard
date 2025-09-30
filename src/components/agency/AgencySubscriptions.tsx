"use client";
import React, { useEffect, useState } from "react";
import { useAppSelector, useAppDispatch } from "@/redux/hooks";
import { addCredits } from "@/redux/slices/agencySlice";
import { Modal } from "@/components/ui/modal";
import { FiLoader, FiAlertTriangle } from "react-icons/fi";
import { toast } from "sonner";

const SubscriptionBilling: React.FC = () => {
  const subscriptionFromStore = useAppSelector(
    (state) => state.agency?.subscription
  );
  const dispatch = useAppDispatch();

  const [subscription, setSubscription] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creditsToBuy, setCreditsToBuy] = useState<number>(10);

  // Sync Redux -> local state
  useEffect(() => {
    if (subscriptionFromStore) {
      setSubscription(subscriptionFromStore);
    } else {
      setSubscription(null);
    }
    setIsLoading(false);
  }, [subscriptionFromStore]);

  const handleBuyCredits = () => {
    if (!creditsToBuy || creditsToBuy <= 0) {
      toast.error("Please enter a valid credit amount.");
      return;
    }
    dispatch(addCredits(creditsToBuy));
    toast.success(`${creditsToBuy} credits purchased successfully!`);
    setIsModalOpen(false);
    setCreditsToBuy(10);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <FiLoader className="animate-spin h-6 w-6 text-brand-500" />
        <span className="ml-2 text-gray-500 dark:text-gray-400">
          Loading subscription...
        </span>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="p-6 rounded-xl border border-gray-200 bg-white text-center dark:border-gray-700 dark:bg-gray-900">
        <FiAlertTriangle className="mx-auto h-8 w-8 text-yellow-500" />
        <h2 className="mt-2 text-lg font-semibold text-gray-800 dark:text-white">
          No subscription found
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Please subscribe to view billing details.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
          Subscription & Billing
        </h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 text-sm rounded-lg bg-brand-500 text-white hover:bg-brand-600"
        >
          Buy Credits +
        </button>
      </div>

      {/* Subscription Info */}
      <div className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          <span className="font-medium">Plan:</span> {subscription.plan}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          <span className="font-medium">Price:</span> ${subscription.price}/mo
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          <span className="font-medium">Seats:</span> {subscription.seatLimit}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          <span className="font-medium">Credits:</span>{" "}
          {subscription.creditAllowance}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          <span className="font-medium">Renewal Date:</span>{" "}
          {subscription.renewalDate}
        </p>
      </div>

      {/* Billing History */}
      <div className="mt-6">
        <h3 className="text-md font-semibold text-gray-700 dark:text-gray-200 mb-3">
          Billing History
        </h3>
        {subscription.billingHistory.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No invoices yet.
          </p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {subscription.billingHistory.map((invoice: any) => (
              <li
                key={invoice.id}
                className="flex justify-between py-3 text-sm text-gray-700 dark:text-gray-300"
              >
                <span>
                  {invoice.date} - ${invoice.amount}
                </span>
                <span
                  className={`${
                    invoice.status === "paid"
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {invoice.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Buy Credits Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        className="max-w-md p-6"
      >
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Buy Credits
        </h3>
        <input
          type="number"
          value={creditsToBuy}
          onChange={(e) => setCreditsToBuy(Number(e.target.value))}
          className="w-full h-11 rounded-lg border border-gray-300 bg-transparent px-4 py-2 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => setIsModalOpen(false)}
            className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleBuyCredits}
            className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600"
          >
            Buy
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default SubscriptionBilling;
