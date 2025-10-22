import React from 'react';

const DevIndicator: React.FC = () => {
  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <div className="bg-green-600 text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg">
        Admin Portal - Dev
      </div>
    </div>
  );
};

export default DevIndicator;