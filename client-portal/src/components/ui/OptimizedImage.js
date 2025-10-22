'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

/**
 * Optimized image component with lazy loading, blur placeholder, and error handling
 */
const OptimizedImage = ({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  quality = 75,
  placeholder = 'blur',
  blurDataURL,
  onLoad,
  onError,
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const imgRef = useRef(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || !imgRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '50px' // Start loading 50px before image comes into view
      }
    );

    observer.observe(imgRef.current);

    return () => observer.disconnect();
  }, [priority]);

  // Generate blur placeholder if not provided
  const generateBlurDataURL = (w = 10, h = 10) => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    // Create a simple gradient blur placeholder
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, '#f3f4f6');
    gradient.addColorStop(1, '#e5e7eb');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    return canvas.toDataURL();
  };

  const handleLoad = (event) => {
    setIsLoading(false);
    onLoad?.(event);
  };

  const handleError = (event) => {
    setIsLoading(false);
    setHasError(true);
    onError?.(event);
  };

  // Error fallback component
  if (hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 text-gray-400 ${className}`}
        style={{ width, height }}
        {...props}
      >
        <svg
          className="w-8 h-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    );
  }

  return (
    <div ref={imgRef} className={`relative ${className}`}>
      {isInView && (
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          quality={quality}
          priority={priority}
          placeholder={placeholder}
          blurDataURL={blurDataURL || generateBlurDataURL(width, height)}
          onLoad={handleLoad}
          onError={handleError}
          className={`transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'
            }`}
          {...props}
        />
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div
          className="absolute inset-0 bg-gray-200 animate-pulse rounded"
          style={{ width, height }}
        />
      )}
    </div>
  );
};

export default OptimizedImage;