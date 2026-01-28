import { useCallback, useState } from 'react';
import jsQR from 'jsqr';
import { BarcodeDetector } from 'barcode-detector';
import type { DetectionState } from '../types/barcode.types';
import { deduplicationManager } from '../utils/deduplication';

/**
 * Maximum time allowed for barcode detection (5 seconds)
 * jsQR is fast and in-memory, no HTTP requests
 */
const DETECTION_TIMEOUT = 5000;

/**
 * Hook to analyze a photo for barcodes
 * Uses jsQR for pure JavaScript, in-memory barcode detection
 * ZERO HTTP requests - eliminates undefinedimage-001.jpg bug completely
 */
export const useBarcodeDetection = () => {
  const [detectionState, setDetectionState] = useState<DetectionState>({
    results: [],
    isScanning: false,
    error: null,
  });

  /**
   * Detect barcodes from an image (DataUrl)
   * Uses jsQR: Pure JavaScript, zero network, guaranteed to complete
   * CRITICAL: Always returns within DETECTION_TIMEOUT, never hangs
   */
  const detectFromImage = useCallback(
    async (imageDataUrl: string): Promise<any[]> => {
      try {
        setDetectionState(prev => ({ ...prev, isScanning: true, error: null }));
        deduplicationManager.clear();

        console.log('[Barcode Detection] Starting barcode analysis (jsQR)');

        // Wrap detection in timeout - guarantees completion even on failures
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const detectedBarcodes = await Promise.race([
          // Primary: jsQR analysis (pure JavaScript, ZERO HTTP)
          new Promise<any[]>((resolve, reject) => {
            let hasResolved = false;

            const resolveOnce = (data: any[]) => {
              if (!hasResolved) {
                hasResolved = true;
                // Clear timeout when promise resolves
                if (timeoutId) clearTimeout(timeoutId);
                resolve(data);
              }
            };

            const rejectOnce = (error: Error) => {
              if (!hasResolved) {
                hasResolved = true;
                // Clear timeout when promise rejects
                if (timeoutId) clearTimeout(timeoutId);
                reject(error);
              }
            };

            try {
              // Load image from data URL
              const img = new Image();
              img.crossOrigin = 'anonymous';

              img.onload = () => {
                try {
                  console.log('[Barcode Detection] Image loaded, analyzing...');

                  // Create canvas and extract image data
                  const canvas = document.createElement('canvas');
                  canvas.width = img.width;
                  canvas.height = img.height;
                  const ctx = canvas.getContext('2d');

                  if (!ctx) {
                    rejectOnce(new Error('Could not get canvas context'));
                    return;
                  }

                  // Draw image on canvas
                  ctx.drawImage(img, 0, 0);

                  // Get raw pixel data from canvas
                  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                  console.log(
                    '[Barcode Detection] Analyzing image:',
                    canvas.width,
                    'x',
                    canvas.height,
                    'pixels'
                  );

                  // ✅ Use jsQR: Pure JavaScript, NO HTTP requests
                  // jsQR analyzes pixel data in-memory
                  const qrResult = jsQR(imageData.data, imageData.width, imageData.height);

                  const results: any[] = [];

                  // If QR code found
                  if (qrResult) {
                    console.log('[Barcode Detection] QR Code detected:', qrResult.data);
                    results.push({
                      code: qrResult.data,
                      format: 'QR_CODE',
                      location: qrResult.location,
                    });
                  }

                  // Detect 1D barcodes (Code 128, EAN-13, EAN-8, Code 39, UPC, etc.)
                  try {
                    const detector = new BarcodeDetector();
                    const imageDataUrl = canvas.toDataURL('image/png');
                    const img1D = new Image();

                    img1D.onload = async () => {
                      try {
                        const detectedBarcodes = await detector.detect(img1D as any);

                        if (detectedBarcodes && detectedBarcodes.length > 0) {
                          console.log('[Barcode Detection] 1D Barcodes detected:', detectedBarcodes.length);
                          for (const barcode of detectedBarcodes) {
                            results.push({
                              code: barcode.rawValue,
                              format: barcode.format || '1D_BARCODE',
                              location: barcode.boundingBox,
                            });
                          }
                        }
                      } catch (error) {
                        console.warn('[Barcode Detection] 1D barcode detection error:', error);
                        // Continue with QR results even if 1D detection fails
                      }

                      console.log('[Barcode Detection] Analysis complete, found:', results.length);
                      resolveOnce(results);
                    };

                    img1D.onerror = () => {
                      console.warn('[Barcode Detection] Failed to load image for 1D detection');
                      // Continue with QR results if 1D detection image fails
                      console.log('[Barcode Detection] Analysis complete, found:', results.length);
                      resolveOnce(results);
                    };

                    img1D.crossOrigin = 'anonymous';
                    img1D.src = imageDataUrl;
                  } catch (error) {
                    console.warn('[Barcode Detection] 1D barcode detection not available:', error);
                    // Continue with QR results even if 1D detection is not available
                    console.log('[Barcode Detection] Analysis complete, found:', results.length);
                    resolveOnce(results);
                  }
                } catch (error) {
                  console.error('[Barcode Detection] Analysis error:', error);
                  rejectOnce(error instanceof Error ? error : new Error(String(error)));
                }
              };

              img.onerror = () => {
                console.error('[Barcode Detection] Image load error');
                rejectOnce(new Error('Failed to load image'));
              };

              // Load image from data URL (no external fetch)
              img.src = imageDataUrl;
            } catch (error) {
              console.error('[Barcode Detection] Init error:', error);
              rejectOnce(error instanceof Error ? error : new Error(String(error)));
            }
          }),

          // Fallback: Timeout guarantee (5 seconds for jsQR is plenty)
          new Promise<any[]>((_, reject) => {
            timeoutId = setTimeout(() => {
              console.error('[Barcode Detection] Timeout after', DETECTION_TIMEOUT, 'ms');
              reject(new Error(`Detection timeout (${DETECTION_TIMEOUT}ms)`));
            }, DETECTION_TIMEOUT);
          }),
        ]);

        // Process detected results
        let finalResults: any[] = [];
        let errorMsg: string | null = null;

        if (detectedBarcodes && detectedBarcodes.length > 0) {
          for (const result of detectedBarcodes) {
            const value = result.code || result;
            const format = result.format || 'unknown';
            deduplicationManager.addOrUpdate(value, format, Date.now());
          }
          finalResults = deduplicationManager.getResults();
          console.log('[Barcode Detection] Final results after deduplication:', finalResults.length);
        } else {
          errorMsg = 'No barcodes found in this image. Try again.';
          console.log('[Barcode Detection] No barcodes detected');
        }

        // Update state
        setDetectionState(prev => ({
          ...prev,
          results: finalResults,
          isScanning: false,
          error: errorMsg,
        }));

        return finalResults;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Detection failed';
        console.error('[Barcode Detection] Error:', errorMessage);

        // Guarantee state exits processing
        setDetectionState(prev => ({
          ...prev,
          error: errorMessage,
          results: [],
          isScanning: false,
        }));

        return [];
      }
    },
    []
  );

  const clearResults = useCallback(() => {
    deduplicationManager.clear();
    setDetectionState(prev => ({ ...prev, results: [], error: null }));
  }, []);

  return {
    ...detectionState,
    detectFromImage,
    clearResults,
  };
};
