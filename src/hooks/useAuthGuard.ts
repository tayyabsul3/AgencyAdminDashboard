// hooks/useAuthGuard.ts
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export const useAuthGuard = (requiredUserType?: 'agency' | 'client') => {
  const router = useRouter();

  useEffect(() => {
    const user = localStorage.getItem("user");
    const userType = localStorage.getItem("userType");

    if (!user) {
      router.push('/signin');
      return;
    }

    if (requiredUserType && userType !== requiredUserType) {
      // Redirect to appropriate dashboard
      if (userType === 'agency') {
        router.push('/');
      } else {
        router.push('/');
      }
    }
  }, [router, requiredUserType]);
};