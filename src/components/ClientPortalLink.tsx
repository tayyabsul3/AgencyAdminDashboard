import React from 'react';
import Link from 'next/link';

const ClientPortalLink: React.FC = () => {
  return (
    <div className="flex items-center space-x-2">
      <Link 
        // href="http://localhost:3000/client/login/" 
        href="https://agencyadmin-4f5d8.web.app/client/login/" 
        target="_blank"
        className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200"
      >
        <svg 
          className="w-4 h-4 mr-2" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" 
          />
        </svg>
        Open Client Portal
      </Link>
    </div>
  );
};

export default ClientPortalLink;