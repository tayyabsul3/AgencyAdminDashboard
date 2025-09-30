"use client";
import React, { useState, useRef } from "react";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import { FaSpinner, FaTimes } from "react-icons/fa";
import { storage } from "@/lib/Firebase";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";



// Initialize Firebase



interface VideoUploaderProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: (videoData: {
    url: string;
    thumbnail: string;
    name: string;
    dimensions: { width: number; height: number };
    fileSize: string;
  }) => void;
  videoFile: File | null;
}

const VideoUploader: React.FC<VideoUploaderProps> = ({
  isOpen,
  onClose,
  onUploadComplete,
  videoFile
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

 

  const uploadVideoToFirebase = async (file: File): Promise<{
    url: string;
    thumbnail: string;
    dimensions: { width: number; height: number };
  }> => {
    if (!storage) {
      throw new Error("Firebase Storage is not initialized");
    }

    try {
      // Get video dimensions
      const dimensions = await getVideoDimensions(file);
      
      // Generate thumbnail
      const thumbnail = await generateVideoThumbnail(file);
      
      // Upload video to Firebase
      const fileExtension = file.name.split('.').pop() || 'mp4';
      const timestamp = Date.now();
      const storagePath = `videos/${file.name}_${timestamp}.${fileExtension}`;
      const storageRef = ref(storage, storagePath);
      
      // Upload the file
      const snapshot = await uploadBytes(storageRef, file);
      
      // Get the download URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      return {
        url: downloadURL,
        thumbnail,
        dimensions
      };
    } catch (error) {
      console.error("Error uploading video:", error);
      throw error;
    }
  };

  const getVideoDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      
      video.onloadedmetadata = () => {
        resolve({
          width: video.videoWidth,
          height: video.videoHeight
        });
        URL.revokeObjectURL(video.src);
      };
      
      video.onerror = () => {
        // Fallback dimensions if we can't get them
        resolve({ width: 1920, height: 1080 });
        URL.revokeObjectURL(video.src);
      };
    });
  };

  const generateVideoThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      
      video.onloadedmetadata = () => {
        video.currentTime = 0.1; // Seek to a small time to capture a frame
      };
      
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg'));
        } else {
          resolve('');
        }
        URL.revokeObjectURL(video.src);
      };
      
      video.onerror = () => {
        resolve(''); // Empty string if we can't generate thumbnail
        URL.revokeObjectURL(video.src);
      };
    });
  };

  const handleUpload = async () => {
    if (!videoFile) return;
    
    setIsUploading(true);
    try {
      const { url, thumbnail, dimensions } = await uploadVideoToFirebase(videoFile);
      
      onUploadComplete({
        url,
        thumbnail,
        name: videoFile.name,
        dimensions,
        fileSize: `${(videoFile.size / (1024 * 1024)).toFixed(2)} MB`
      });
      
      onClose();
    } catch (error) {
      console.error("Video upload failed:", error);
      alert("Failed to upload video. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleVideoLoad = () => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {
        // Autoplay might be blocked, that's okay
      });
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      className="max-w-3xl m-4" 
      onClose={onClose}
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Upload Video
          </h3>
          <button
            onClick={onClose}
            disabled={isUploading}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
          >
            <FaTimes className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6">
          <div className="relative flex items-center justify-center w-full h-64 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
            {videoFile && (
              <video
                ref={videoRef}
                src={URL.createObjectURL(videoFile)}
                onLoadedData={handleVideoLoad}
                controls
                className="max-h-full max-w-full object-contain"
                muted
              />
            )}
          </div>
          
          {videoFile && (
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              <p>File: {videoFile.name}</p>
              <p>Size: {(videoFile.size / (1024 * 1024)).toFixed(2)} MB</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleUpload}
            disabled={isUploading || !videoFile}
          >
            {isUploading ? (
              <>
                <FaSpinner className="animate-spin mr-2" />
                Uploading...
              </>
            ) : (
              "Upload Video"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default VideoUploader;