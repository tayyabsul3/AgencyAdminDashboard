import React from 'react';

const DevIndicator = () => {
  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '16px',
      left: '16px',
      zIndex: 50
    }}>
      <div style={{
        backgroundColor: '#2563eb',
        color: 'white',
        padding: '4px 12px',
        borderRadius: '9999px',
        fontSize: '12px',
        fontWeight: '500',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
      }}>
        Client Portal - Dev
      </div>
    </div>
  );
};

export default DevIndicator;