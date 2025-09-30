"use client";
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { buyCredits, setError, setLoading } from "@/redux/slices/subscriptionSlice";
import { FiLoader } from "react-icons/fi";
import { toast } from "sonner";

const CreditsUsage: React.FC = () => {
  const dispatch = useDispatch();
  const { limit, used, usageByClient, loading, error } = useSelector(
    (state: RootState) => state.subscription
  );

  const [localLoading, setLocalLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLocalLoading(false), 600); // fake loader
    return () => clearTimeout(timer);
  }, []);

  const handleBuyCredits = () => {
    try {
      dispatch(buyCredits(10)); // +10 credits
      toast.success("+10 credits added to your pool 🎉");
    } catch (err) {
      dispatch(setError("Failed to buy credits"));
      toast.error("Something went wrong while buying credits");
    }
  };

  if (localLoading || loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <FiLoader className="animate-spin h-8 w-8 text-brand-500" />
        <span className="ml-2 text-gray-500 dark:text-gray-400">Loading subscription...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400">
        {error}
      </div>
    );
  }

  const remaining = limit - used;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-6">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90 mb-4">
        Credits Usage
      </h2>

      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-gray-600 dark:text-gray-400">
            Total Credits: <span className="font-semibold">{limit}</span>
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Used: <span className="font-semibold">{used}</span>
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Remaining: <span className="font-semibold">{remaining}</span>
          </p>
        </div>
        <button
          onClick={handleBuyCredits}
          className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
        >
          Buy +10 Credits ($250)
        </button>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-800 dark:text-white/90 mb-2">
          Usage by Client
        </h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Client</th>
              <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Email</th>
              <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Status</th>
              <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Credits Used</th>
            </tr>
          </thead>
          <tbody>
            {usageByClient.map((client:any) => (
              <tr key={client.id} className="border-b border-gray-100 dark:border-gray-800">
                <td className="px-4 py-2 text-gray-800 dark:text-white/90">{client.name}</td>
                <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{client.email}</td>
                <td className="px-4 py-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      client.status === "accepted"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                        : client.status === "pending"
                        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
                        : "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400"
                    }`}
                  >
                    {client.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-gray-800 dark:text-white/90">
                  {client.creditsUsed}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CreditsUsage;
