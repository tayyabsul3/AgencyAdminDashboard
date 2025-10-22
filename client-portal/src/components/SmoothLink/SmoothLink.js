'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const SmoothLink = ({ href, children, className, ...props }) => {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  const handleClick = async (e) => {
    e.preventDefault();
    
    if (isNavigating) return;
    
    setIsNavigating(true);
    
    // Add a small delay to show transition
    setTimeout(() => {
      router.push(href);
      setIsNavigating(false);
    }, 150);
  };

  return (
    <Link 
      href={href} 
      className={`${className} ${isNavigating ? 'navigating' : ''}`}
      onClick={handleClick}
      {...props}
    >
      {children}
    </Link>
  );
};

export default SmoothLink;