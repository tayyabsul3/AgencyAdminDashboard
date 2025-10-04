import { Suspense } from 'react';
import InviteRegistration from "@/components/auth/InvitaionForm";

// It's good practice to have a fallback UI
function InviteFallback() {
  return (
    // You can customize this to match your app's style
    <div className="flex justify-center items-center min-h-screen">
      <div>Loading invitation...</div>
    </div>
  );
}

export default function SignIn() {
  return (
    <Suspense fallback={<InviteFallback />}>
      <InviteRegistration />
    </Suspense>
  );
}