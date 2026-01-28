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
 * Special handling for Safari iOS camera restart
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
    console.log('[Camera] Lifecycle change - enabled:', enabled);

    if (!enabled) {
      console.log('[Camera] Disabling camera - stopping all tracks');
      // COMPLETE cleanup when disabling
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          console.log('[Camera] Stopping track:', track.kind);
          track.stop();
        });
        streamRef.current = null;
      }

      // Clear video element completely
      if (videoRef.current) {
        console.log('[Camera] Clearing video element');
        videoRef.current.srcObject = null;
        videoRef.current.pause();
        // Reset video element attributes (critical for iOS)
        videoRef.current.muted = true;
        videoRef.current.autoplay = false;
        videoRef.current.playsInline = true;
      }

      // Reset camera state
      setCameraState(prev => ({
        ...prev,
        stream: null,
        error: null,
        isLoading: false,
      }));

      return;
    }

    let mounted = true;

    const initializeCamera = async () => {
      try {
        console.log('[Camera] Initializing camera...');
        setCameraState(prev => ({ ...prev, isLoading: true, error: null }));

        // Check if browser supports getUserMedia
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera access not supported in your browser');
        }

        // Clear any previous stream before requesting new one
        if (streamRef.current) {
          console.log('[Camera] Clearing previous stream before new request');
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        // Small delay to ensure previous stream is fully released (critical for iOS)
        await new Promise(resolve => setTimeout(resolve, 100));

        // Request camera access
        console.log('[Camera] Requesting getUserMedia...');
        const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);

        if (!mounted) {
          console.log('[Camera] Component unmounted, stopping stream');
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        streamRef.current = stream;
        console.log('[Camera] Stream obtained, attaching to video element');

        // Attach stream to video element
        if (videoRef.current) {
          // Ensure video element is ready
          videoRef.current.autoplay = true;
          videoRef.current.muted = true;
          videoRef.current.playsInline = true;
          videoRef.current.srcObject = stream;

          console.log('[Camera] Waiting for video to load metadata...');
          // Wait for video to be ready
          await new Promise<void>((resolve, reject) => {
            const handleLoadedMetadata = () => {
              console.log('[Camera] Video metadata loaded');
              videoRef.current?.removeEventListener('loadedmetadata', handleLoadedMetadata);
              videoRef.current?.removeEventListener('error', handleError);
              resolve();
            };

            const handleError = (err: Event) => {
              console.error('[Camera] Video element error:', err);
              videoRef.current?.removeEventListener('loadedmetadata', handleLoadedMetadata);
              videoRef.current?.removeEventListener('error', handleError);
              reject(new Error('Video element failed to load'));
            };

            // Set timeout for video loading (5 seconds)
            const timeoutId = setTimeout(() => {
              console.warn('[Camera] Video metadata timeout, continuing anyway');
              videoRef.current?.removeEventListener('loadedmetadata', handleLoadedMetadata);
              videoRef.current?.removeEventListener('error', handleError);
              resolve();
            }, 5000);

            videoRef.current?.addEventListener('loadedmetadata', handleLoadedMetadata);
            videoRef.current?.addEventListener('error', handleError);

            // Also clean up timeout if we load before timeout
            const originalResolve = resolve;
            resolve = () => {
              clearTimeout(timeoutId);
              originalResolve();
            };
          });
        }

        if (!mounted) return;

        console.log('[Camera] Camera initialized successfully');
        setCameraState(prev => ({
          ...prev,
          stream,
          hasPermission: true,
          isLoading: false,
        }));
      } catch (error) {
        if (!mounted) return;

        const errorMessage = error instanceof Error ? error.message : 'Failed to access camera';
        console.error('[Camera] Initialization error:', errorMessage);

        // Distinguish permission denial
        if (error instanceof DOMException && error.name === 'NotAllowedError') {
          console.warn('[Camera] Permission denied by user');
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
      console.log('[Camera] Cleanup called');
      mounted = false;

      // Stop all video and audio tracks
      if (streamRef.current) {
        console.log('[Camera] Stopping all tracks in cleanup');
        streamRef.current.getTracks().forEach(track => {
          console.log('[Camera] Stopping track in cleanup:', track.kind);
          track.stop();
        });
        streamRef.current = null;
      }

      // Clear video element source
      if (videoRef.current) {
        console.log('[Camera] Clearing video element in cleanup');
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
