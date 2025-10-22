import PasswordReset from '@/components/agency/PasswordReset'
import React from 'react'

import { Suspense } from 'react';

// It's good practice to have a fallback UI
function Fallback() {
  return (
    // You can customize this to match your app's style
    <div className="flex justify-center items-center min-h-screen">
      <div>Loading ...</div>
    </div>
  );
}

export default function page() {
  return (
    <Suspense fallback={<Fallback />}>
             <PasswordReset/>

    </Suspense>
  );
}