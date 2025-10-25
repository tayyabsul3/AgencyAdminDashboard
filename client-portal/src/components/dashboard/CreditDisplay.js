'use client';

import { useState } from 'react';

const CreditDisplay = ({ creditsInfo }) => {
  const formatNumber = (num) => {
    return Math.max(0, Math.round(num));
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">
        Article Generation Limits
      </h3>
      <div className="space-y-4">
        {creditsInfo.isClientLimit ? (
          <>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Articles Generated</span>
              <span className="font-semibold text-gray-800 dark:text-white">
                {formatNumber(creditsInfo.used)} / {formatNumber(creditsInfo.total)}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full ${
                  creditsInfo.isLowOnCredits
                    ? 'bg-yellow-500'
                    : creditsInfo.isOutOfCredits
                    ? 'bg-red-500'
                    : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(100, creditsInfo.usagePercentage)}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                Articles Remaining
              </span>
              <span className={`font-medium ${
                creditsInfo.isOutOfCredits 
                  ? 'text-red-500' 
                  : creditsInfo.isLowOnCredits 
                  ? 'text-yellow-500' 
                  : 'text-green-500'
              }`}>
                {formatNumber(creditsInfo.remaining)}
              </span>
            </div>
          </>
        ) : (
          <div className="text-gray-600 dark:text-gray-400">
            Loading article limits...
          </div>
        )}
      </div>
    </div>
  );
};

export default CreditDisplay;