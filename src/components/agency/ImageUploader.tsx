// src/components/agency/ImageUploader.tsx
"use client";
import React, { useState, useRef, useCallback, useEffect } from "react";
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase"; // Ensure correct path/casing
import { toast } from "sonner";
import { FaSpinner, FaUpload, FaCrop, FaTimes, FaCircle, FaSquare } from "react-icons/fa";
// Assuming you have a Button component like the one in your environment
import Button from "../ui/button/Button"; 

interface ImageUploaderProps {
  onUploadComplete: (logoUrl: string) => void; // Callback after successful upload
  onClose: () => void; // Callback to close the modal
}

// Helper function to generate a formatted timestamp string (e.g., 20251025_222045_123)
const generateTimestampFilename = () => {
    const now = new Date();
    const pad = (num: number) => num.toString().padStart(2, '0');
    const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const millisecondPart = now.getMilliseconds().toString().padStart(3, '0');
    return `${datePart}_${timePart}_${millisecondPart}`;
};

export default function ImageUploader({ onUploadComplete, onClose }: ImageUploaderProps) {
  const [upImg, setUpImg] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isUploading, setIsUploading] = useState(false);
  const [cropShape, setCropShape] = useState<'square' | 'circle'>('square');
  const [fileInputKey, setFileInputKey] = useState(Date.now());

  // Utility function to convert cropped area to a Blob file
  const generateCroppedImageFile = useCallback(
    async (image: HTMLImageElement, pixelCrop: PixelCrop): Promise<Blob> => {
      const canvas = document.createElement('canvas');
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) throw new Error('No 2d context for cropping.');

      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;

      ctx.drawImage(
        image,
        pixelCrop.x * scaleX,
        pixelCrop.y * scaleY,
        pixelCrop.width * scaleX,
        pixelCrop.height * scaleY,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
      );

      return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas to Blob failed.'));
          }
        }, 'image/png');
      });
    },
    []
  );

  const resetCropper = () => {
      setUpImg(null);
      setCrop(undefined);
      setCompletedCrop(undefined);
      setIsUploading(false);
      setFileInputKey(Date.now()); // Reset input field for re-selection
  }

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
          toast.error("File size must be less than 2MB.");
          // Reset file input via key change to clear selection
          setFileInputKey(Date.now()); 
          return;
      }
      setCrop(undefined); 
      setCompletedCrop(undefined);
      const reader = new FileReader();
      reader.addEventListener('load', () => setUpImg(reader.result as string));
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!completedCrop || !upImg || !imgRef.current) {
      toast.error('Please select an image and define a crop area first.');
      return;
    }
    
    setIsUploading(true);
    try {
      const croppedBlob = await generateCroppedImageFile(imgRef.current, completedCrop);
      
      const timestampName = generateTimestampFilename();
      const filePath = `agencyLogos/logo_${timestampName}.png`;

      const fileRef = storageRef(storage, filePath);
      await uploadBytes(fileRef, croppedBlob);
      const publicUrl = await getDownloadURL(fileRef);

      onUploadComplete(publicUrl); 
      resetCropper(); // Clear cropper state
      onClose(); // Close modal after successful upload
      toast.success('Logo uploaded and cropped successfully!');

    } catch (error) {
      console.error('Upload Error:', error);
      toast.error('Failed to upload logo.');
    } finally {
      setIsUploading(false);
    }
  };


  return (
    <div className="space-y-6 ">
        <label className="block text-sm font-medium text-gray-700">Select Image File (Max 2MB)</label>
        <input 
            key={fileInputKey} // Key to force reset
            type="file" 
            accept="image/*" 
            onChange={onSelectFile} 
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
        />

        {upImg && (
            <div className="border border-indigo-300 rounded-xl p-4 bg-indigo-50 shadow-inner">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                        <FaCrop className="text-indigo-600"/>
                        <h3 className="font-bold text-indigo-800">Crop and Preview</h3>
                    </div>
                </div>

                {/* Crop Shape Selector */}
                <div className="flex space-x-3 mb-4">
                    <button 
                        onClick={() => setCropShape('square')}
                        className={`text-sm px-4 py-2 rounded-full font-medium transition flex items-center gap-2 ${cropShape === 'square' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-indigo-700 hover:bg-indigo-100 border border-indigo-300'}`}
                    >
                        <FaSquare/> Square
                    </button>
                    <button 
                        onClick={() => setCropShape('circle')}
                        className={`text-sm px-4 py-2 rounded-full font-medium transition flex items-center gap-2 ${cropShape === 'circle' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-indigo-700 hover:bg-indigo-100 border border-indigo-300'}`}
                    >
                        <FaCircle/> Circular
                    </button>
                </div>
                
                {/* Image Cropper Area */}
                <div className="max-w-full overflow-auto bg-gray-100 p-2 rounded-lg">
                    <ReactCrop
                        crop={crop}
                        onChange={(_, percentCrop) => setCrop(percentCrop)}
                        onComplete={(c) => setCompletedCrop(c)}
                        aspect={1}
                        circularCrop={cropShape === 'circle'}
                        ruleOfThirds
                        minWidth={50}
                        minHeight={50}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img ref={imgRef} alt="Crop preview" src={upImg} className="max-w-full h-auto block" />
                    </ReactCrop>
                </div>
                
                {/* Upload Button */}
                <div className="flex justify-between gap-4 mt-6">
                    <Button 
                        onClick={onClose}
                        variant="outline"
                        className="w-1/2 py-3"
                    >
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleUpload}
                        disabled={isUploading || !completedCrop || (completedCrop.width === 0 && completedCrop.height === 0)}
                        className="w-1/2 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition disabled:bg-gray-400 flex items-center justify-center gap-2 shadow-lg"
                    >
                        {isUploading ? (
                            <>
                                <FaSpinner className="animate-spin" /> 
                                <span>Uploading...</span>
                            </>
                        ) : (
                            <>
                                <FaUpload />
                                <span>Upload Logo</span>
                            </>
                        )}
                    </Button>
                </div>
            </div>
        )}
        {!upImg && (
             <div className="mt-8 flex justify-end gap-4">
                <Button 
                    onClick={onClose}
                    variant="outline"
                    className="px-5 py-2.5"
                >
                    Close
                </Button>
             </div>
        )}
    </div>
  );
}