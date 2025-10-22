'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const PageTransition = ({ children }) => {
  const [isLoaded, setIsLoaded] = useState(true); // Start with true to avoid hydration mismatch
  const [isMounted, setIsMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    
    // Smoother fade transition
    setIsLoaded(false);
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 10); // Reduced from 50ms to 10ms for smoother transition

    return () => clearTimeout(timer);
  }, [pathname, isMounted]);

  // Avoid hydration mismatch by not applying transition until mounted
  if (!isMounted) {
    return <div style={{ minHeight: '100vh' }}>{children}</div>;
  }

  return (
    <div style={{
      opacity: isLoaded ? 1 : 0.95, // Never fully transparent to prevent flash
      transition: 'opacity 0.15s ease-out', // Faster transition
      minHeight: '100vh',
      background: 'transparent'
    }}>
      {children}
    </div>
  );
};

export default PageTransition;