import { useCallback, useRef } from 'react';

/**
 * Hook to capture photo from video stream and return as ImageData
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

      // Return as data URL
      return canvas.toDataURL('image/jpeg', 0.9);
    },
    []
  );

  return {
    capturePhoto,
    captureAsDataUrl,
  };
};
