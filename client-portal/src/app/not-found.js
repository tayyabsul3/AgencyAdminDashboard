'use client';

import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>404</h1>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '2rem' }}>Page Not Found</h2>
      <p style={{ marginBottom: '2rem' }}>
        The page you're looking for doesn't exist.
      </p>
      <Link
        href="/"
        style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: '#007bff',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '0.25rem'
        }}
      >
        Go Home
      </Link>
    </div>
  );
}