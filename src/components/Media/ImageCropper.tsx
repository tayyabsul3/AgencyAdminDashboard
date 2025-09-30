"use client";
import React, { useState, useRef, useEffect } from "react";
import ReactCrop, { Crop,  centerCrop, makeAspectCrop, convertToPixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
// Import from our new Firebase config
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/Firebase";

// Canvas preview function
const setCanvasPreview = (
  image: any,
  canvas: any,
  crop: any
) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("No 2d context");
  }

  const pixelRatio = window.devicePixelRatio;
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  canvas.width = Math.floor(crop.width * scaleX * pixelRatio);
  canvas.height = Math.floor(crop.height * scaleY * pixelRatio);

  ctx.scale(pixelRatio, pixelRatio);
  ctx.imageSmoothingQuality = "high";
  ctx.save();

  const cropX = crop.x * scaleX;
  const cropY = crop.y * scaleY;

  ctx.translate(-cropX, -cropY);
  ctx.drawImage(
    image,
    0,
    0,
    image.naturalWidth,
    image.naturalHeight,
    0,
    0,
    image.naturalWidth,
    image.naturalHeight
  );

  ctx.restore();
};

interface ImageCropperProps {
  data: {
    imgSrc: string;
    name: string;
    ASPECT_RATIO: number;
    MIN_DIMENSION: number;
    shape: boolean;
    onCropComplete: (downloadUrl: string) => void;
    onClose: () => void;
    storagePath?: string;
    fallbackToDataUrl?: boolean;
  };
}

const ImageCropper: React.FC<ImageCropperProps> = ({ data }) => {
  const { 
    imgSrc, 
    ASPECT_RATIO, 
    MIN_DIMENSION, 
    shape, 
    onCropComplete, 
    onClose,
    storagePath = "images",
    fallbackToDataUrl = true
  } = data;
  
  const imgRef = useRef<HTMLImageElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Function to set initial crop when image loads
  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    
    const crop = makeAspectCrop(
      {
        unit: "%",
        width: 80,
      },
      ASPECT_RATIO,
      width,
      height
    );
    
    const centeredCrop = centerCrop(crop, width, height);
    setCrop(centeredCrop);
  };

  // Function to upload image to Firebase Storage
  const uploadToFirebase = async (blob: Blob, fileName: string): Promise<string> => {
    if (!storage) {
      throw new Error("Firebase Storage is not initialized");
    }

    try {
      // Create storage reference with custom path
      const fileExtension = fileName.split('.').pop() || 'jpg';
      const timestamp = Date.now();
      const storageRef = ref(storage, `${storagePath}/${fileName}_${timestamp}.${fileExtension}`);
      
      // Upload the file
      const snapshot = await uploadBytes(storageRef, blob);
      
      // Get the download URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      return downloadURL;
    } catch (error) {
      console.error("Error uploading to Firebase:", error);
      throw error;
    }
  };

  // Function to get cropped image and upload to Firebase
  const getCroppedImg = async () => {
    if (!imgRef.current || !crop || !previewCanvasRef.current) {
      console.error("Missing required elements for cropping");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const pixelCrop = convertToPixelCrop(
        crop,
        imgRef.current.width,
        imgRef.current.height
      );
      
      setCanvasPreview(
        imgRef.current,
        previewCanvasRef.current,
        pixelCrop
      );
      
      // Convert canvas to blob
      previewCanvasRef.current.toBlob(async (blob) => {
        if (blob) {
          try {
            let resultUrl: string;
            
            if (storage) {
              try {
                const downloadURL = await uploadToFirebase(blob, data.name);
                resultUrl = downloadURL;
                console.log("URI",downloadURL)
              } catch (firebaseError) {
                console.error("Firebase upload failed:", firebaseError);
                
                if (fallbackToDataUrl) {
                  console.log("Falling back to data URL");
                  resultUrl = URL.createObjectURL(blob);
                } else {
                  throw firebaseError;
                }
              }
            } else {
              console.log("Firebase not available, using data URL");
              resultUrl = URL.createObjectURL(blob);
            }
            
            // Return the result URL
            onCropComplete(resultUrl);
            // onClose();
          } catch (error) {
            console.error("Upload failed:", error);
            setUploadError(error instanceof Error ? error.message : "Upload failed");
          } finally {
            setIsUploading(false);
          }
        } else {
          console.error("Failed to create blob from canvas");
          setUploadError("Failed to process image");
          setIsUploading(false);
        }
      }, "image/jpeg", 0.9);
    } catch (error) {
      console.error("Error cropping image:", error);
      setUploadError(error instanceof Error ? error.message : "Cropping failed");
      setIsUploading(false);
    }
  };

  // Handle Enter key to crop image
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !isUploading) {
        e.preventDefault();
        getCroppedImg();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [crop, isUploading]);

  return (
    <>
      {imgSrc && (
        <div className="flex flex-col items-center">
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={() => {}}
            aspect={ASPECT_RATIO}
            minWidth={MIN_DIMENSION}
            circularCrop={shape}
            keepSelection
            className="max-h-[400px]"
            disabled={isUploading}
          >
            <img
              ref={imgRef}
              src={imgSrc}
              alt="Upload"
              onLoad={onImageLoad}
              style={{ maxHeight: "70vh" }}
              className="max-h-[400px] object-contain"
            />
          </ReactCrop>

          {uploadError && (
            <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-md">
              {uploadError}
            </div>
          )}

          <div className="buttons flex gap-5 justify-center items-center mt-10">
            <button
              onClick={onClose}
              className="bg-gray-200 text-black px-5 rounded-full p-1.5 h-fit disabled:opacity-50"
              disabled={isUploading}
            >
              Cancel
            </button>
            <button
              className="p-1.5 h-fit bg-black rounded-full text-white px-5 disabled:opacity-50 flex items-center justify-center min-w-[120px]"
              onClick={getCroppedImg}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Uploading...
                </>
              ) : (
                "Crop Image"
              )}
            </button>
          </div>
        </div>
      )}
      {crop && (
        <canvas
          ref={previewCanvasRef}
          className="mt-4"
          style={{
            display: "none",
            border: "1px solid black",
            objectFit: "contain",
            width: 150,
            height: 150,
          }}
        />
      )}
    </>
  );
};

export default ImageCropper;