// components/withUserData.tsx
import React from 'react';
import { useUserData } from '@/hooks/useUserData';

interface WithUserDataProps {
  agencyData: any;
  clientData: any;
  userType: 'agency' | 'client' | null;
}

export function withUserData<P extends WithUserDataProps>(
  WrappedComponent: React.ComponentType<P>
) {
  return function ComponentWithUserData(props: Omit<P, keyof WithUserDataProps>) {
    const { agencyData, clientData, isLoading, error, userType } = useUserData();

    if (isLoading) {
      return (
        <div className="flex justify-center items-center h-40 text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
            Loading your data...
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex justify-center items-center h-40">
          <div className="text-center">
            <div className="text-red-500 text-lg mb-2">⚠️</div>
            <p className="text-gray-600 dark:text-gray-400">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-3 text-sm text-brand-500 hover:text-brand-600"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return (
      <WrappedComponent
        {...(props as P)}
        agencyData={agencyData}
        clientData={clientData}
        userType={userType}
      />
    );
  };
}