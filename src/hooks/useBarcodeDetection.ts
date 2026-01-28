import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
  RGBLuminanceSource,
  BinaryBitmap,
  HybridBinarizer,
} from '@zxing/library';
import type { DetectionState } from '../types/barcode.types';
import { deduplicationManager } from '../utils/deduplication';

// Frame processing configuration
const FRAME_SKIP = 2; // Process every Nth frame for performance
const MAX_FRAME_RATE_MS = 100; // Max 10 frames per second for detection

/**
 * Hook to manage barcode detection from video stream
 * Detects MULTIPLE barcodes in the same frame
 * Uses canvas + ImageData for frame capture and multi-barcode detection
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

  const readerRef = useRef<MultiFormatReader | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameCounterRef = useRef(0);
  const lastDetectionTimeRef = useRef(0);
  const isDetectingRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  // Initialize reader and canvas
  useEffect(() => {
    try {
      // Create reader with multi-format hints
      const hints = new Map();
      hints.set(
        DecodeHintType.POSSIBLE_FORMATS,
        [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.QR_CODE,
          BarcodeFormat.CODABAR,
          BarcodeFormat.DATA_MATRIX,
          BarcodeFormat.CODE_93,
        ]
      );
      hints.set(DecodeHintType.TRY_HARDER, true);

      const reader = new MultiFormatReader();
      reader.setHints(hints);
      readerRef.current = reader;

      // Create offscreen canvas for frame capture
      canvasRef.current = document.createElement('canvas');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to initialize barcode detector';
      setDetectionState(prev => ({ ...prev, error: errorMessage }));
    }

    return () => {
      canvasRef.current = null;
    };
  }, []);

  // Main detection loop using requestAnimationFrame
  const detectBarcodes = useCallback(async () => {
    if (
      !enabled ||
      !videoRef.current ||
      !readerRef.current ||
      !canvasRef.current ||
      isDetectingRef.current
    ) {
      animationFrameRef.current = requestAnimationFrame(detectBarcodes);
      return;
    }

    // Skip frames for performance
    frameCounterRef.current++;
    if (frameCounterRef.current % FRAME_SKIP !== 0) {
      animationFrameRef.current = requestAnimationFrame(detectBarcodes);
      return;
    }

    // Throttle detection to avoid excessive processing
    const now = Date.now();
    if (now - lastDetectionTimeRef.current < MAX_FRAME_RATE_MS) {
      animationFrameRef.current = requestAnimationFrame(detectBarcodes);
      return;
    }
    lastDetectionTimeRef.current = now;

    try {
      // Ensure video is ready
      const video = videoRef.current;
      if (
        video.readyState !== HTMLMediaElement.HAVE_ENOUGH_DATA &&
        video.readyState !== HTMLMediaElement.HAVE_CURRENT_DATA
      ) {
        animationFrameRef.current = requestAnimationFrame(detectBarcodes);
        return;
      }

      isDetectingRef.current = true;
      const canvas = canvasRef.current;

      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw current video frame to canvas
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Failed to get canvas context');
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Track detected barcodes to avoid duplicates within the same frame
      const detectedBarcodes = new Map<string, boolean>();
      let detectedAny = false;

      try {
        // Try to detect barcodes using multi-region scanning
        // This approach works well for detecting multiple barcodes in the same frame

        // Strategy: scan full image and various regions
        const scanRegions = [
          {
            name: 'full',
            x: 0,
            y: 0,
            w: 1,
            h: 1,
          },
          {
            name: 'top-left',
            x: 0,
            y: 0,
            w: 0.6,
            h: 0.6,
          },
          {
            name: 'top-right',
            x: 0.4,
            y: 0,
            w: 0.6,
            h: 0.6,
          },
          {
            name: 'bottom-left',
            x: 0,
            y: 0.4,
            w: 0.6,
            h: 0.6,
          },
          {
            name: 'bottom-right',
            x: 0.4,
            y: 0.4,
            w: 0.6,
            h: 0.6,
          },
          {
            name: 'center',
            x: 0.2,
            y: 0.2,
            w: 0.6,
            h: 0.6,
          },
        ];

        for (const region of scanRegions) {
          if (!isDetectingRef.current || !mountedRef.current) break;

          try {
            const regionX = Math.floor(region.x * canvas.width);
            const regionY = Math.floor(region.y * canvas.height);
            const regionW = Math.max(1, Math.floor(region.w * canvas.width));
            const regionH = Math.max(1, Math.floor(region.h * canvas.height));

            // Get region image data
            const regionImageData = context.getImageData(regionX, regionY, regionW, regionH);

            // Try to decode barcode in this region
            const lumaSource = new RGBLuminanceSource(
              regionImageData.data,
              regionW,
              regionH
            );

            const binaryBitmap = new BinaryBitmap(new HybridBinarizer(lumaSource));

            const result = readerRef.current.decodeWithState(binaryBitmap);

            if (result && !isDetectingRef.current) {
              const value = result.getText();
              const format = result.getBarcodeFormat();
              const key = `${format}:${value}`;

              if (!detectedBarcodes.has(key)) {
                detectedBarcodes.set(key, true);
                detectedAny = true;
              }
            }
          } catch (e) {
            // This region doesn't have a barcode, continue to next region
          }
        }
      } catch (detectionError) {
        // Main detection error - continue scanning
      }

      if (!isDetectingRef.current && mountedRef.current) {
        if (detectedAny) {
          setDetectionState(prev => ({ ...prev, isScanning: true, error: null }));

          // Process all detected barcodes
          let hasNewResults = false;
          for (const barcodeKey of detectedBarcodes.keys()) {
            const lastColonIndex = barcodeKey.lastIndexOf(':');
            const format = barcodeKey.substring(0, lastColonIndex);
            const value = barcodeKey.substring(lastColonIndex + 1);

            const newResult = deduplicationManager.addOrUpdate(value, format, Date.now());

            if (newResult) {
              hasNewResults = true;
            }
          }

          // Update state with all results
          if (hasNewResults) {
            const results = deduplicationManager.getResults();
            setDetectionState(prev => ({ ...prev, results }));
          }
        } else {
          // No barcodes detected, but still scanning
          setDetectionState(prev => {
            if (prev.results.length > 0) {
              return prev; // Keep showing previous results
            }
            return { ...prev, isScanning: true };
          });
        }
      }

      isDetectingRef.current = false;
    } catch (error) {
      isDetectingRef.current = false;

      if (mountedRef.current) {
        // Continue scanning even on errors
        setDetectionState(prev => {
          if (prev.results.length > 0) {
            return prev;
          }
          return { ...prev, isScanning: true };
        });
      }
    }

    animationFrameRef.current = requestAnimationFrame(detectBarcodes);
  }, [enabled, videoRef]);

  // Start/stop detection based on enabled state
  useEffect(() => {
    mountedRef.current = true;

    if (!enabled || !videoRef.current) {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      setDetectionState(prev => ({ ...prev, isScanning: false }));
      return;
    }

    // Start detection loop
    setDetectionState(prev => ({ ...prev, isScanning: true }));
    animationFrameRef.current = requestAnimationFrame(detectBarcodes);

    return () => {
      mountedRef.current = false;
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [enabled, videoRef, detectBarcodes]);

  const clearResults = useCallback(() => {
    deduplicationManager.clear();
    setDetectionState(prev => ({ ...prev, results: [] }));
  }, []);

  return {
    ...detectionState,
    clearResults,
  };
};
