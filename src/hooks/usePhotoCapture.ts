import { useCallback, useRef } from 'react';

/**
 * Hook to capture photo from video stream
 * Returns Blob for upload to backend API
 * Optimized for iOS with proper encoding
 */
export const usePhotoCapture = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const captureAsBlob = useCallback(
    (videoRef: React.RefObject<HTMLVideoElement | null>): Promise<Blob | null> => {
      if (!videoRef.current) return Promise.resolve(null);

      const video = videoRef.current;

      // Create canvas if needed
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }

      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const context = canvas.getContext('2d');
      if (!context) return Promise.resolve(null);

      // Draw current video frame
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert to PNG Blob for upload (lossless, better for barcode detection)
      return new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/png');
      });
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

      // Return as PNG data URL
      return canvas.toDataURL('image/png');
    },
    []
  );

  return {
    captureAsBlob,
    captureAsDataUrl,
  };
};
