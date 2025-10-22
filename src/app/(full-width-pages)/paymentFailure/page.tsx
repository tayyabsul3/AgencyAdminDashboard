import { Suspense } from 'react';
import PaymentFailure from '@/components/agency/PaymentFailure';


function Fallback() {
  return (
   
    <div className="flex justify-center items-center min-h-screen">
      <div>Loading ...</div>
    </div>
  );
}

export default function page() {
  return (
    <Suspense fallback={<Fallback />}>
      <PaymentFailure />
    </Suspense>
  );
}