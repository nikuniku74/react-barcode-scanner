import { useEffect, useRef, useState } from 'react';
import type { CameraState, CameraConstraints } from '../types/barcode.types';

const CAMERA_CONSTRAINTS: CameraConstraints = {
  video: {
    facingMode: 'environment',
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
  audio: false,
};

/**
 * Hook to manage camera access and streaming
 * Handles permissions, stream lifecycle, and error states
 */
export const useCamera = (enabled: boolean = true) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraState, setCameraState] = useState<CameraState>({
    stream: null,
    error: null,
    isLoading: false,
    hasPermission: null,
  });

  useEffect(() => {
    if (!enabled) return;

    let mounted = true;
    const initializeCamera = async () => {
      try {
        setCameraState(prev => ({ ...prev, isLoading: true, error: null }));

        // Check if browser supports getUserMedia
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera access not supported in your browser');
        }

        // Request camera access
        const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);

        if (!mounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        streamRef.current = stream;

        // Attach stream to video element
        if (videoRef.current) {
          videoRef.current.srcObject = stream;

          // Wait for video to be ready
          await new Promise<void>((resolve) => {
            const handleLoadedMetadata = () => {
              videoRef.current?.removeEventListener('loadedmetadata', handleLoadedMetadata);
              resolve();
            };
            videoRef.current?.addEventListener('loadedmetadata', handleLoadedMetadata);
          });
        }

        setCameraState(prev => ({
          ...prev,
          stream,
          hasPermission: true,
          isLoading: false,
        }));
      } catch (error) {
        if (!mounted) return;

        const errorMessage = error instanceof Error ? error.message : 'Failed to access camera';

        // Distinguish permission denial
        if (error instanceof DOMException && error.name === 'NotAllowedError') {
          setCameraState(prev => ({
            ...prev,
            hasPermission: false,
            error: 'Camera permission denied',
            isLoading: false,
          }));
        } else {
          setCameraState(prev => ({
            ...prev,
            hasPermission: false,
            error: errorMessage,
            isLoading: false,
          }));
        }
      }
    };

    initializeCamera();

    // Cleanup
    return () => {
      mounted = false;
      // Stop all video and audio tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      // Clear video element source
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.pause();
      }
    };
  }, [enabled]);

  return {
    videoRef,
    ...cameraState,
  };
};
