import { Suspense } from 'react';
import InviteRegistration from "@/components/auth/InvitaionForm";
import PaymentSuccess from '@/components/agency/PaymentSuccess';

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
      <PaymentSuccess />
    </Suspense>
  );
}