"use client";
import React, { useState, useEffect } from "react";
import { FiLoader, FiX } from "react-icons/fi";
import { ref, onValue, DataSnapshot, off } from "firebase/database";
import { database } from "@/lib/Firebase"; // Import from our modular config
import MediaCarousel from "@/components/MediaCarousel";

interface Campaign {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "active" | "inactive";
  description: string;
  mediaItems: string[];
  createdAt?: number;
  updatedAt?: number;
  createdBy?: string;
}

interface MediaFile {
  id: string;
  name: string;
  url: string;
  type: "image" | "video";
  thumbnail?: string;
}

const ViewCampaignPage = ({ params }: { params: Promise<{ id: string }> }) => {
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [mediaLibrary, setMediaLibrary] = useState<MediaFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<MediaFile | null>(null);

  // Resolve the params promise
  useEffect(() => {
    const resolveParams = async () => {
      try {
        const resolved = await params;
        setResolvedParams(resolved);
      } catch (error) {
        console.error("Error resolving params:", error);
        setError("Failed to load campaign parameters");
        setIsLoading(false);
      }
    };
    
    resolveParams();
  }, [params]);

  useEffect(() => {
    if (!resolvedParams) return;

    const campaignId = resolvedParams.id;
    console.log("Campaign ID:", campaignId);
    const companyId = process.env.NEXT_PUBLIC_COMPANY_ID;

    if (!companyId) {
      console.error("Company ID is not defined");
      setMediaLibrary([]);
      setIsLoading(false);
      return;
    }

    // Check if Firebase database is available
    if (!database) {
      console.error("Firebase Database is not initialized");
      const localStorageMedia = loadMediaLibraryFromLocalStorage();
      setMediaLibrary(localStorageMedia);
      setIsLoading(false);
      return;
    }

    try {
      // CORRECTED PATH: mediaItems is a field within the campaign object
      const campaignRef = ref(database, `${companyId}/campaigns/${campaignId}`);

      const handleCampaignData = (snapshot: DataSnapshot) => {
        try {
          const campaignData = snapshot.val();
          console.log("Campaign data from Firebase:", campaignData);
          
          if (campaignData && campaignData.mediaItems && Array.isArray(campaignData.mediaItems)) {
            setMediaLibrary(campaignData.mediaItems);
            setCampaign(campaignData); // Also set the campaign data
          } else {
            console.log("No mediaItems found in campaign data");
            const localStorageMedia = loadMediaLibraryFromLocalStorage();
            setMediaLibrary(localStorageMedia);
          }
          setIsLoading(false);
        } catch (err) {
          console.error("Error processing campaign data:", err);
          const localStorageMedia = loadMediaLibraryFromLocalStorage();
          setMediaLibrary(localStorageMedia);
          setIsLoading(false);
        }
      };

      const handleError = (error: Error) => {
        console.error("Firebase real-time data error:", error);
        const localStorageMedia = loadMediaLibraryFromLocalStorage();
        setMediaLibrary(localStorageMedia);
        setIsLoading(false);
      };

      // Set up the real-time listener for the entire campaign
      onValue(campaignRef, handleCampaignData, handleError);

      // Cleanup function
      return () => {
        off(campaignRef, 'value', handleCampaignData);
      };
    } catch (error) {
      console.error("Firebase setup error:", error);
      const localStorageMedia = loadMediaLibraryFromLocalStorage();
      setMediaLibrary(localStorageMedia);
      setIsLoading(false);
    }
  }, [resolvedParams]);

  // Update the loadMediaLibraryFromLocalStorage function to return the data
  const loadMediaLibraryFromLocalStorage = (): MediaFile[] => {
    if (typeof window === 'undefined') return [];
    
    try {
      const savedMedia = localStorage.getItem('mediaLibrary');
      if (savedMedia) {
        const parsedMedia = JSON.parse(savedMedia);
        return Array.isArray(parsedMedia) ? parsedMedia : [];
      }
      return []; // Return empty array if nothing in localStorage
    } catch (error) {
      console.error("Error loading media from localStorage:", error);
      return []; // Return empty array on error
    }
  };
  
  const getCampaignMedia = () => {
    if (!mediaLibrary.length) return [];
    
    // If we have mediaLibrary from Firebase/localStorage, use it directly
    return mediaLibrary;
  };

  // Add this to see what's happening
  console.log("Media library state:", mediaLibrary);
  console.log("Campaign state:", campaign);

  const campaignMedia = getCampaignMedia();
  console.log("Campaign media to display:", campaignMedia);

  const closePage = () => {
    if (typeof window !== 'undefined') {
      window.open('', '_self')?.close();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="flex flex-col items-center">
          <FiLoader className="animate-spin h-12 w-12 text-white mb-4" />
          <p className="text-white">Loading media...</p>
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center p-8 bg-gray-900 rounded-lg">
          <h1 className="text-2xl font-bold text-white mb-4">Error</h1>
          <p className="text-gray-300 mb-6">
            {error || "Campaign not found or media unavailable"}
          </p>
          <button
            onClick={closePage}
            className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (campaignMedia.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center p-8 bg-gray-900 rounded-lg">
          <h1 className="text-2xl font-bold text-white mb-2">{campaign.name}</h1>
          <p className="text-gray-300 mb-6">No media files available for this campaign.</p>
          <button
            onClick={closePage}
            className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <MediaCarousel 
      mediaItems={mediaLibrary} 
      autoAdvanceDelay={30000} // Optional: custom delay in ms
    />
  );
};

export default ViewCampaignPage;