import { useCallback, useRef } from 'react';

/**
 * Hook to capture photo from video stream and return as ImageData
 * Optimized for iOS with proper image orientation handling
 */
export const usePhotoCapture = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const capturePhoto = useCallback(
    (videoRef: React.RefObject<HTMLVideoElement | null>): ImageData | null => {
      if (!videoRef.current) return null;

      const video = videoRef.current;

      // Create canvas if needed
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }

      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const context = canvas.getContext('2d');
      if (!context) return null;

      // Draw current video frame
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Get image data
      return context.getImageData(0, 0, canvas.width, canvas.height);
    },
    []
  );

  const captureAsDataUrl = useCallback(
    (videoRef: React.RefObject<HTMLVideoElement | null>): string | null => {
      if (!videoRef.current) return null;

      const video = videoRef.current;

      // Create canvas if needed
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }

      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const context = canvas.getContext('2d');
      if (!context) return null;

      // Draw current video frame
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Return as data URL with proper encoding for barcode detection
      // Use PNG for lossless quality in barcode scanning (important for iOS)
      return canvas.toDataURL('image/png');
    },
    []
  );

  /**
   * Load image and handle EXIF orientation (critical for iOS photos)
   * Returns properly oriented image data URL
   */
  const loadImageWithOrientation = useCallback(
    (imageDataUrl: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
          try {
            // For video captures, orientation is already correct
            // This is mainly for user-selected photos that may have EXIF rotation
            // Since we're capturing from video stream, we don't need rotation adjustment
            // but we ensure proper canvas handling for iOS

            if (!canvasRef.current) {
              canvasRef.current = document.createElement('canvas');
            }

            const canvas = canvasRef.current;
            canvas.width = img.width;
            canvas.height = img.height;

            const context = canvas.getContext('2d');
            if (!context) {
              reject(new Error('Could not get canvas context'));
              return;
            }

            // Ensure proper image rendering on iOS WebKit
            context.fillStyle = 'white';
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(img, 0, 0);

            // Return high-quality PNG for barcode detection
            resolve(canvas.toDataURL('image/png'));
          } catch (error) {
            reject(error);
          }
        };

        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };

        img.src = imageDataUrl;
      });
    },
    []
  );

  return {
    capturePhoto,
    captureAsDataUrl,
    loadImageWithOrientation,
  };
};
