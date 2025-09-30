"use client";
import React, { useState, useEffect, useRef } from "react";
import { FiLoader } from "react-icons/fi";

interface MediaFile {
  id: string;
  name: string;
  url: string;
  type: "image" | "video";
  thumbnail?: string;
}

interface MediaCarouselProps {
  mediaItems: MediaFile[];
  autoAdvanceDelay?: number; // in milliseconds
}

const MediaCarousel: React.FC<MediaCarouselProps> = ({ 
  mediaItems, 
  autoAdvanceDelay = 30000 // Default to 30 seconds
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Auto-advance carousel
  useEffect(() => {
    if (mediaItems.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => 
        prevIndex === mediaItems.length - 1 ? 0 : prevIndex + 1
      );
    }, autoAdvanceDelay);

    return () => clearInterval(interval);
  }, [mediaItems.length, autoAdvanceDelay]);

  // Handle video play
  useEffect(() => {
    if (videoRef.current && mediaItems[currentIndex]?.type === 'video') {
      videoRef.current.play().catch(error => {
        console.log("Video autoplay failed:", error);
      });
    }
  }, [currentIndex, mediaItems]);

  // Handle media loading
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [currentIndex]);

  if (mediaItems.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="w-24 h-24 mx-auto mb-4 bg-gray-800 rounded-full flex items-center justify-center">
            <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm">No media available</p>
        </div>
      </div>
    );
  }

  const currentMedia = mediaItems[currentIndex];

  return (
    <div className="min-h-screen bg-black relative overflow-hidden flex items-center justify-center">
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-10">
          <FiLoader className="animate-spin h-12 w-12 text-white" />
        </div>
      )}
      
      {/* Media display - full screen carousel */}
      <div className="w-full h-screen flex items-center justify-center">
        {currentMedia.type === 'image' ? (
          <div className="w-full h-full flex items-center justify-center">
            <img
              src={currentMedia.url}
              alt={currentMedia.name}
              className="object-contain w-full h-full"
              style={{ 
                maxWidth: '100vw', 
                maxHeight: '100dvh',
                aspectRatio: '16/9'
              }}
              onLoad={() => setIsLoading(false)}
              onError={() => setIsLoading(false)}
            />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <video
              ref={videoRef}
              className="object-contain w-full h-full"
              style={{ 
                maxWidth: '100vw', 
                maxHeight: '100dvh',
                aspectRatio: '16/9'
              }}
              muted
              autoPlay
              playsInline
              onLoadedData={() => setIsLoading(false)}
              onError={() => setIsLoading(false)}
            >
              <source src={currentMedia.url} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        )}
      </div>

      {/* Navigation dots */}
      {mediaItems.length > 1 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2 z-10">
          {mediaItems.map((_, index) => (
            <button
              key={index}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                index === currentIndex ? 'bg-white' : 'bg-gray-500'
              }`}
              onClick={() => setCurrentIndex(index)}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Progress bar */}
      {mediaItems.length > 1 && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gray-700 z-10">
          <div 
            className="h-full bg-white transition-all duration-300 ease-linear"
            style={{ 
              width: `${(currentIndex / (mediaItems.length - 1)) * 100}%` 
            }}
          />
        </div>
      )}
    </div>
  );
};

export default MediaCarousel;