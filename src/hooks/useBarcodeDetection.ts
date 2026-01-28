import { useCallback, useEffect, useRef, useState } from 'react';
import Quagga from 'quagga';
import type { DetectionState } from '../types/barcode.types';
import { deduplicationManager } from '../utils/deduplication';

/**
 * Hook to manage barcode detection from video stream
 * Uses Quagga library - modern, actively maintained successor to ZXing
 * Detects MULTIPLE barcodes in real-time with excellent performance
 */
export const useBarcodeDetection = (
  videoRef: React.RefObject<HTMLVideoElement | null>,
  enabled: boolean = true
) => {
  const [detectionState, setDetectionState] = useState<DetectionState>({
    results: [],
    isScanning: false,
    error: null,
  });

  const isInitializedRef = useRef(false);
  const lastDetectionTimeRef = useRef(0);
  const detectionThrottleRef = useRef(100); // ms between detections
  const mountedRef = useRef(true);

  // Initialize Quagga
  useEffect(() => {
    if (!enabled || !videoRef.current) {
      return;
    }

    let mounted = true;
    mountedRef.current = true;

    const initializeQuagga = async () => {
      if (isInitializedRef.current) {
        return;
      }

      try {
        setDetectionState(prev => ({ ...prev, isScanning: true, error: null }));

        // Configure Quagga
        await new Promise<void>((resolve, reject) => {
          Quagga.init(
            {
              inputStream: {
                name: 'Live',
                type: 'LiveStream',
                target: videoRef.current!,
                constraints: {
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                  facingMode: 'environment',
                },
              },
              decoder: {
                readers: [
                  'code_128_reader',
                  'ean_reader',
                  'ean_8_reader',
                  'code_39_reader',
                  'code_39_vin_reader',
                  'codabar_reader',
                  'upc_reader',
                  'upc_e_reader',
                  'i2of5_reader',
                ],
                debug: {
                  showCanvas: false,
                  showPatterns: false,
                  showFrequency: false,
                  showErrors: false,
                },
              },
              locator: {
                halfSample: true,
                patchSize: 'medium',
              },
              numOfWorkers: navigator.hardwareConcurrency || 4,
              frequency: 10, // Detection frequency (every Nth frame)
            },
            (err: any) => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            }
          );
        });

        if (!mounted) return;

        // Set up detection handler
        Quagga.onDetected((result: any) => {
          if (!mounted || !mountedRef.current) return;

          // Throttle to avoid excessive state updates
          const now = Date.now();
          if (now - lastDetectionTimeRef.current < detectionThrottleRef.current) {
            return;
          }
          lastDetectionTimeRef.current = now;

          try {
            if (result && result.codeResult && result.codeResult.code) {
              const value = result.codeResult.code;
              const format = result.codeResult.format || 'unknown';

              // Add/update detection in deduplication manager
              const newResult = deduplicationManager.addOrUpdate(value, format, Date.now());

              if (newResult && mounted) {
                setDetectionState(prev => ({ ...prev, isScanning: true, error: null }));
                const results = deduplicationManager.getResults();
                setDetectionState(prev => ({ ...prev, results }));
              }
            }
          } catch (error) {
            // Silently continue scanning
          }
        });

        // Start scanning
        Quagga.start();
        isInitializedRef.current = true;

        if (mounted) {
          setDetectionState(prev => ({ ...prev, isScanning: true }));
        }
      } catch (error) {
        if (!mounted) return;

        const errorMessage =
          error instanceof Error ? error.message : 'Failed to initialize barcode scanner';

        setDetectionState(prev => ({
          ...prev,
          error: errorMessage,
          isScanning: false,
        }));
      }
    };

    initializeQuagga();

    return () => {
      mounted = false;
      // Note: We keep Quagga initialized for reuse, cleanup happens in the disable effect
    };
  }, [enabled, videoRef]);

  // Stop scanning when disabled
  useEffect(() => {
    if (!enabled && isInitializedRef.current) {
      try {
        Quagga.stop();
        isInitializedRef.current = false;
      } catch (error) {
        // Silently fail
      }
      setDetectionState(prev => ({ ...prev, isScanning: false }));
    }
  }, [enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (isInitializedRef.current) {
        try {
          Quagga.stop();
        } catch (error) {
          // Silently fail
        }
      }
    };
  }, []);

  const clearResults = useCallback(() => {
    deduplicationManager.clear();
    setDetectionState(prev => ({ ...prev, results: [] }));
  }, []);

  return {
    ...detectionState,
    clearResults,
  };
};
