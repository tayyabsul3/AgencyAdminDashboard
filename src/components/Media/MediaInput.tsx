"use client";
import React, { useState, useCallback, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Image from "next/image";
import ImageCropper from "./ImageCropper";
import { deleteObject, ref } from "firebase/storage";
import { FiLoader, FiTrash2, FiEdit, FiCheck, FiX } from "react-icons/fi";
import { storage } from "@/lib/Firebase";
import VideoUploader from "./VideoUpload";
import axios from "axios";

interface MediaInfo {
  id: string;
  name: string;
  description: string;
  tags: string;
  type: "image" | "video";
  dimensions: {
    width: number;
    height: number;
  };
  fileSize: string;
  url: string;
  thumbnail?: string;
  createdAt: string;
  storagePath?: string;
  createdBy?: any;
}

const MediaInput = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [mediaInfo, setMediaInfo] = useState<Omit<MediaInfo, 'id' | 'url' | 'createdAt' | 'dimensions' | 'fileSize' | 'type'>>({
    name: "",
    description: "",
    tags: ""
  });
  const [mediaList, setMediaList] = useState<MediaInfo[]>([]);
  const [editingMode, setEditingMode] = useState<"new" | "existing">("new");
  const [fileData, setFileData] = useState<any>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [mediaToDelete, setMediaToDelete] = useState<MediaInfo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Store file data in a ref to preserve it across renders
  const fileDataRef = useRef<any>(null);
  const originalFileRef = useRef<File | null>(null);

  // Load media from API on mount
  useEffect(() => {
    fetchMediaFromAPI();
  }, []);

  // Keep refs in sync with state
  useEffect(() => {
    fileDataRef.current = fileData;
    originalFileRef.current = originalFile;
  }, [fileData, originalFile]);

  // Fetch media from API
  const fetchMediaFromAPI = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/media`, {
        params: { 
          company: process.env.NEXT_PUBLIC_COMPANY_ID 
        }
      });
      
      if (response.data.media) {
        setMediaList(response.data.media);
        localStorage.setItem('mediaLibrary',JSON.stringify(response.data.media));
      }
    } catch (error) {
      console.error("Failed to fetch media:", error);
      // Fallback to localStorage if API fails
      const savedMedia = localStorage.getItem('mediaLibrary');
      if (savedMedia) {
        setMediaList(JSON.parse(savedMedia));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Save media to API
  const saveMediaToAPI = async (mediaData: any, isUpdate = false) => {
    try {
      setIsSaving(true);
      
      if (isUpdate) {
        // Update existing media
        await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/api/media/update`, {
          company: process.env.NEXT_PUBLIC_COMPANY_ID,
          mediaId: mediaData.id,
          mediaData: mediaData
        });
      } else {
        // Create new media
        await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/media/new`, {
          company: process.env.NEXT_PUBLIC_COMPANY_ID,
          mediaData: {
            ...mediaData,
            createdBy: JSON.parse(localStorage.getItem("user") || "{}") // Safer parsing
          }
        });
      }
      
      // Refresh the media list after saving
      await fetchMediaFromAPI();
    } catch (error) {
      console.error("Failed to save media:", error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  // Delete media from API
  const deleteMediaFromAPI = async (mediaId: string) => {
    try {
      setIsDeleting(true);
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/api/media/delete`, {
        params: {
          company: process.env.NEXT_PUBLIC_COMPANY_ID,
          mediaId: mediaId
        }
      });
      
      // Refresh the media list after deletion
      await fetchMediaFromAPI();
    } catch (error) {
      console.error("Failed to delete media:", error);
      throw error;
    } finally {
      setIsDeleting(false);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles?.length) {
      const file = acceptedFiles[0];
      
      if (file.type.startsWith('image/')) {
        setOriginalFile(file);
        originalFileRef.current = file;
        
        const reader = new FileReader();
        reader.onloadend = () => {
          const imageUrl = reader.result?.toString() || "";
          const fileDataObj = {
            name: file.name,
            imgSrc: imageUrl,
            MIN_DIMENSION: 150,
            shape: false,
            ASPECT_RATIO: 9/16,
            onCropComplete: handleCropComplete,
            onClose: () => setIsCropModalOpen(false),
            storagePath: "media-library",
            fallbackToDataUrl: false
          };
          
          setFileData(fileDataObj);
          fileDataRef.current = fileDataObj;
          setIsCropModalOpen(true);
        };
        reader.readAsDataURL(file);
      } else if (file.type.startsWith('video/')) {
        setVideoFile(file);
        setIsVideoModalOpen(true);
      }
    }
  }, []);

  const handleCropComplete = async (firebaseDownloadUrl: string) => {
    console.log("Crop complete callback received URL:", firebaseDownloadUrl);
    
    // Use ref values instead of state to ensure we have the latest data
    const currentFileData = fileDataRef.current;
    const currentOriginalFile = originalFileRef.current;
    
    if (currentFileData && currentOriginalFile) {
      try {
        const dimensions = await getDimensions(currentOriginalFile);
        const fileSize = `${(currentOriginalFile.size / (1024 * 1024)).toFixed(2)} MB`;
        
        const newMedia: MediaInfo = {
          id: Date.now().toString(),
          name: currentFileData.name,
          description: "",
          tags: "",
          type: 'image',
          dimensions,
          fileSize,
          url: firebaseDownloadUrl,
          thumbnail: firebaseDownloadUrl,
          createdAt: new Date().toISOString(),
          storagePath: extractPathFromFirebaseUrl(firebaseDownloadUrl) || ""
        };

        try {
          await saveMediaToAPI(newMedia);
          setIsCropModalOpen(false);
          setOriginalFile(null);
          originalFileRef.current = null;
          setFileData(null);
          fileDataRef.current = null;
        } catch (error) {
          console.error("Failed to save media to API:", error);
          // Fallback to local state if API fails
          setMediaList(prev => [...prev, newMedia]);
          setIsCropModalOpen(false);
          setOriginalFile(null);
          originalFileRef.current = null;
          setFileData(null);
          fileDataRef.current = null;
        }
      } catch (error) {
        console.error("Error in handleCropComplete:", error);
        setIsCropModalOpen(false);
      }
    } else {
      console.error("File data or original file not available in callback");
      console.log("File data:", currentFileData);
      console.log("Original file:", currentOriginalFile);
      setIsCropModalOpen(false);
    }
  };

  const handleVideoUploadComplete = async (videoData: {
    url: string;
    thumbnail: string;
    name: string;
    dimensions: { width: number; height: number };
    fileSize: string;
  }) => {
    const newMedia: MediaInfo = {
      id: Date.now().toString(),
      name: videoData.name,
      description: "",
      tags: "",
      type: 'video',
      dimensions: videoData.dimensions,
      fileSize: videoData.fileSize,
      url: videoData.url,
      thumbnail: videoData.thumbnail,
      createdAt: new Date().toISOString(),
      storagePath: extractPathFromFirebaseUrl(videoData.url) || ""
    };

    try {
      await saveMediaToAPI(newMedia);
      setVideoFile(null);
    } catch (error) {
      console.error("Failed to save video to API:", error);
      // Fallback to local state if API fails
      setMediaList(prev => [...prev, newMedia]);
      setVideoFile(null);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.svg'],
      'video/*': ['.mp4', '.webm']
    },
    maxFiles: 1,
    multiple: false
  });

  const getDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      if (typeof window === "undefined") {
        resolve({ width: 1920, height: 1080 });
        return;
      }

      if (file.type.startsWith("image/")) {
        const img = new window.Image();
        img.onload = () => {
          resolve({ width: img.width, height: img.height });
          URL.revokeObjectURL(img.src);
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      } else {
        resolve({ width: 1920, height: 1080 });
      }
    });
  };

  const openEditModal = (index: number) => {
    setCurrentFileIndex(index);
    setEditingMode("existing");
    const media = mediaList[index];
    setMediaInfo({
      name: media.name,
      description: media.description,
      tags: media.tags
    });
    setIsModalOpen(true);
  };

  const handleInfoSubmit = async () => {
    const updatedMedia = {
      ...mediaList[currentFileIndex],
      name: mediaInfo.name,
      description: mediaInfo.description,
      tags: mediaInfo.tags
    };

    try {
      await saveMediaToAPI(updatedMedia, true);
      setIsModalOpen(false);
      setMediaInfo({ name: "", description: "", tags: "" });
    } catch (error) {
      console.error("Failed to update media:", error);
      // Fallback to local state if API fails
      const updatedMediaList = [...mediaList];
      updatedMediaList[currentFileIndex] = updatedMedia;
      setMediaList(updatedMediaList);
      setIsModalOpen(false);
      setMediaInfo({ name: "", description: "", tags: "" });
    }
  };

  const extractPathFromFirebaseUrl = (url: string): string | null => {
    try {
      const urlObj = new URL(url);
      
      if (!urlObj.hostname.includes('firebasestorage.googleapis.com')) {
        return null;
      }
      
      const pathMatch = urlObj.pathname.match(/\/o\/(.+)$/);
      if (!pathMatch) {
        return null;
      }
      
      const encodedPath = pathMatch[1];
      const decodedPath = decodeURIComponent(encodedPath);
      const cleanPath = decodedPath.split('?')[0];
      
      return cleanPath;
    } catch (error) {
      console.error("Error parsing Firebase URL:", error);
      return null;
    }
  };

  const openDeleteModal = (media: MediaInfo) => {
    setMediaToDelete(media);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setMediaToDelete(null);
  };

  const handleDeleteConfirm = async () => {
    if (!mediaToDelete) return;
    
    try {
      // First delete from Firebase Storage
      const filePath = extractPathFromFirebaseUrl(mediaToDelete.url);
      if (filePath && storage) {
        const fileRef = ref(storage, filePath);
        await deleteObject(fileRef);
      }
      
      // Then delete from API
      await deleteMediaFromAPI(mediaToDelete.id);
      closeDeleteModal();
    } catch (error) {
      console.error("Error deleting media:", error);
      
      if (error instanceof Error && 'code' in error) {
        const firebaseError = error as { code: string; message: string };
        if (firebaseError.code === 'storage/object-not-found') {
          // If file not found in storage, still try to delete from API
          try {
            await deleteMediaFromAPI(mediaToDelete.id);
          } catch (apiError) {
            console.error("Failed to delete from API:", apiError);
            alert("Failed to delete media. Please try again.");
          }
        }
      } else {
        alert("Failed to delete media. Please try again.");
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Dropzone Area */}
      <div className="transition border border-gray-300 border-dashed cursor-pointer dark:hover:border-brand-500 dark:border-gray-700 rounded-xl hover:border-brand-500">
        <div
          {...getRootProps()}
          className={`dropzone rounded-xl border-dashed p-7 lg:p-10 ${
            isDragActive
              ? "border-brand-500 bg-gray-100 dark:bg-gray-800"
              : "border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900"
          }`}
        >
          <input {...getInputProps()} />
          <div className="dz-message flex flex-col items-center m-0!">
            <div className="mb-[22px] flex justify-center">
              <div className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400">
                <svg
                  className="fill-current"
                  width="29"
                  height="28"
                  viewBox="0 0 29 28"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M14.5019 3.91699C14.2852 3.91699 14.0899 4.00891 13.953 4.15589L8.57363 9.53186C8.28065 9.82466 8.2805 10.2995 8.5733 10.5925C8.8661 10.8855 9.34097 10.8857 9.63396 10.5929L13.7519 6.47752V18.667C13.7519 19.0812 14.0877 19.417 14.5019 19.417C14.9161 19.417 15.2519 19.0812 15.2519 18.667V6.48234L19.3653 10.5929C19.6583 10.8857 20.1332 10.8855 20.426 10.5925C20.7188 10.2995 20.7186 9.82463 20.4256 9.53184L15.0838 4.19378C14.9463 4.02488 14.7367 3.91699 14.5019 3.91699ZM5.91626 18.667C5.91626 18.2528 5.58047 17.917 5.16626 17.917C4.75205 17.917 4.41626 18.2528 4.41626 18.667V21.8337C4.41626 23.0763 5.42362 24.0837 6.66626 24.0837H22.3339C23.5766 24.0837 24.5839 23.0763 24.5839 21.8337V18.667C24.5839 18.2528 24.2482 17.917 23.8339 17.917C23.4197 17.917 23.0839 18.2528 23.0839 18.667V21.8337C23.0839 22.2479 22.7482 22.5837 22.3339 22.5837H6.66626C6.25205 22.5837 5.91626 22.2479 5.91626 21.8337V18.667Z"
                  />
                </svg>
              </div>
            </div>
            <h4 className="mb-3 font-semibold text-gray-800 text-theme-xl dark:text-white/90">
              {isDragActive ? "Drop Files Here" : "Drag & Drop Files Here"}
            </h4>
            <span className="text-center mb-5 block w-full max-w-[290px] text-sm text-gray-700 dark:text-gray-400">
              Drag and drop your images or videos here or browse
            </span>
            <Button size="sm" variant="outline">
              Browse Files
            </Button>
          </div>
        </div>
      </div>

      {/* Media Library */}
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <span className="flex items-center">
            <FiLoader className="animate-spin mr-2" />
            Loading media...
          </span>
        </div>
      ) : mediaList.length > 0 ? (
        <div className="mt-8">
          <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
            Media Library
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {mediaList.map((media, index) => (
              <div key={media.id} className="relative p-2 border rounded-lg group border-gray-200 dark:border-gray-700">
                <div className="overflow-hidden rounded-md aspect-video bg-gray-100 dark:bg-gray-800">
                  {media.type === 'image' ? (
                    <img
                      src={media.url}
                      alt={media.name}
                      width={200}
                      height={200}
                      className="object-contain w-full h-full"
                    />
                  ) : (
                    <img
                      src={media.thumbnail || ''}
                      alt={media.name}
                      width={200}
                      height={200}
                      className="object-contain w-full h-full"
                    />
                  )}
                </div>
                <div className="mt-2 space-y-1">
                  <div className="text-sm font-medium text-gray-800 truncate dark:text-white/90">
                    {media.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {media.dimensions.width}×{media.dimensions.height}px
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {media.fileSize} • {media.type}
                  </div>
                  <div className="text-xs text-green-500 truncate" title={media.url}>
                    ✅ Stored in Firebase
                  </div>
                </div>
                <button
                  onClick={() => openDeleteModal(media)}
                  className="absolute top-0 right-0 p-1 text-gray-500 transition-opacity opacity-0 bg-white rounded-full group-hover:opacity-100 dark:bg-gray-800 dark:text-gray-400"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-2"
                  onClick={() => openEditModal(index)}
                >
                  <FiEdit className="mr-1" />
                  Edit Details
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">No media files found. Upload your first file to get started.</p>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal 
        isOpen={isDeleteModalOpen} 
        className="max-w-md m-4" 
        onClose={closeDeleteModal}
      >
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">
            Delete Media
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Are you sure you want to delete "{mediaToDelete?.name}"? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button 
              variant="outline" 
              onClick={closeDeleteModal}
              disabled={isDeleting}
            >
              <FiX className="mr-1" />
              Cancel
            </Button>
            <Button 
              variant="primary" 
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <span className="flex items-center">
                  <FiLoader className="animate-spin mr-2" />
                  Deleting...
                </span>
              ) : (
                <span className="flex items-center">
                  <FiTrash2 className="mr-1" />
                  Delete
                </span>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Media Info Modal */}
      <Modal 
        isOpen={isModalOpen} 
        className="max-w-[700px] m-4" 
        onClose={() => setIsModalOpen(false)}
      >
        <div className="flex flex-col h-[calc(100vh-2rem)] max-h-[90vh]">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Edit Media Information
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6">
            {mediaList[currentFileIndex] && (
              <div className="mb-6">
                <div className="w-full overflow-hidden rounded-md aspect-video bg-gray-100 dark:bg-gray-800">
                  {mediaList[currentFileIndex].type === 'image' ? (
                    <img
                      src={mediaList[currentFileIndex].url}
                      alt={mediaList[currentFileIndex].name}
                      className="object-contain w-full h-full"
                    />
                  ) : (
                    <video
                      src={mediaList[currentFileIndex].url}
                      controls
                      className="max-h-full mx-auto max-w-full object-contain"
                      muted
                    />
                  )}
                </div>
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <Label>Media Name</Label>
                <Input
                  value={mediaInfo.name}
                  onChange={(e) => setMediaInfo({...mediaInfo, name: e.target.value})}
                  placeholder="Enter media name"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Type</Label>
                  <div className="px-3 py-2 text-sm border rounded-lg border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    {mediaList[currentFileIndex]?.type}
                  </div>
                </div>
                
                <div>
                  <Label>Dimensions</Label>
                  <div className="px-3 py-2 text-sm border rounded-lg border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    {mediaList[currentFileIndex]?.dimensions.width}×{mediaList[currentFileIndex]?.dimensions.height}px
                  </div>
                </div>
              </div>
              
              <div>
                <Label>Description</Label>
                <Input
                  value={mediaInfo.description}
                  onChange={(e) => setMediaInfo({...mediaInfo, description: e.target.value})}
                  placeholder="Enter description"
                />
              </div>
              
              <div>
                <Label>Tags (comma separated)</Label>
                <Input
                  value={mediaInfo.tags}
                  onChange={(e) => setMediaInfo({...mediaInfo, tags: e.target.value})}
                  placeholder="tag1, tag2, tag3"
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              <FiX className="mr-1" />
              Cancel
            </Button>
            <Button onClick={handleInfoSubmit} disabled={isSaving}>
              {isSaving ? (
                <span className="flex items-center">
                  <FiLoader className="animate-spin mr-2" />
                  Saving...
                </span>
              ) : (
                <span className="flex items-center">
                  <FiCheck className="mr-1" />
                  Save Changes
                </span>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Crop Modal */}
      <Modal 
        isOpen={isCropModalOpen} 
        className="max-w-3xl m-4" 
        onClose={() => setIsCropModalOpen(false)}
      >
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">
            Crop Image (9:16 Aspect Ratio)
          </h3>
          {fileData && (
            <ImageCropper 
              data={fileData} 
            />
          )}
        </div>
      </Modal>

      <VideoUploader
        isOpen={isVideoModalOpen}
        onClose={() => {
          setIsVideoModalOpen(false);
          setVideoFile(null);
        }}
        onUploadComplete={handleVideoUploadComplete}
        videoFile={videoFile}
      />
    </div>
  );
};

export default MediaInput;