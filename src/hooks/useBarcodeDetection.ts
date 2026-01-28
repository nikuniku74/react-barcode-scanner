import { useCallback, useState } from 'react';
import Quagga from 'quagga';
import type { DetectionState } from '../types/barcode.types';
import { deduplicationManager } from '../utils/deduplication';

/**
 * Hook to analyze a photo for barcodes
 * Detects MULTIPLE barcodes from a captured image
 */
export const useBarcodeDetection = () => {
  const [detectionState, setDetectionState] = useState<DetectionState>({
    results: [],
    isScanning: false,
    error: null,
  });

  /**
   * Detect barcodes from an image (DataUrl)
   */
  const detectFromImage = useCallback(
    async (imageDataUrl: string): Promise<any[]> => {
      try {
        setDetectionState(prev => ({ ...prev, isScanning: true, error: null }));

        // Clear previous results for new detection
        deduplicationManager.clear();

        // Create a promise-based wrapper for Quagga image processing
        const results = await new Promise<any[]>((resolve, reject) => {
          let hasResolved = false;

          const resolveOnce = (data: any[]) => {
            if (!hasResolved) {
              hasResolved = true;
              resolve(data);
            }
          };

          const rejectOnce = (error: Error) => {
            if (!hasResolved) {
              hasResolved = true;
              reject(error);
            }
          };

          try {
            // Load image with proper EXIF orientation handling for iOS
            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = () => {
              try {
                // Create canvas from image
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

                // Initialize Quagga with image stream
                let isInitialized = false;
                const detectedBarcodes: any[] = [];

                // Configure Quagga with optimal settings for image processing
                const quaggaConfig = {
                  inputStream: {
                    name: 'Image',
                    type: 'ImageStream',
                    target: document.createElement('div') as any,
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
                    },
                  },
                  locator: {
                    halfSample: true,
                    patchSize: 'medium',
                  },
                };

                Quagga.init(quaggaConfig, (err: any) => {
                  if (err) {
                    rejectOnce(err instanceof Error ? err : new Error(String(err)));
                    return;
                  }

                  isInitialized = true;

                  const handleDetection = (result: any) => {
                    if (result && result.codeResult && result.codeResult.code) {
                      const exists = detectedBarcodes.some(
                        d =>
                          d.codeResult.code === result.codeResult.code &&
                          d.codeResult.format === result.codeResult.format
                      );
                      if (!exists) {
                        detectedBarcodes.push(result);
                      }
                    }
                  };

                  Quagga.onDetected(handleDetection);

                  // Process frame immediately
                  const analyzeFrame = () => {
                    try {
                      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                      // Process through Quagga
                      (Quagga as any).processFrame({
                        data: imageData.data,
                        width: canvas.width,
                        height: canvas.height,
                      });

                      // Allow processing time - critical for reliability
                      // Use requestAnimationFrame for better Safari iOS compatibility
                      const stopAndResolve = () => {
                        try {
                          Quagga.stop();
                        } catch (e) {
                          // Ignore Quagga.stop errors
                        }
                        // Ensure state update completes on Safari iOS
                        resolveOnce(detectedBarcodes);
                      };

                      // Multi-frame analysis for better detection on iOS
                      let frameCount = 0;
                      const maxFrames = 3;

                      const processAdditionalFrames = () => {
                        frameCount++;
                        if (frameCount >= maxFrames) {
                          stopAndResolve();
                          return;
                        }

                        try {
                          (Quagga as any).processFrame({
                            data: imageData.data,
                            width: canvas.width,
                            height: canvas.height,
                          });

                          // Use setTimeout instead of requestAnimationFrame for iOS reliability
                          setTimeout(processAdditionalFrames, 150);
                        } catch (e) {
                          stopAndResolve();
                        }
                      };

                      // Start additional frame processing after initial processing
                      setTimeout(processAdditionalFrames, 150);
                    } catch (error) {
                      rejectOnce(error instanceof Error ? error : new Error(String(error)));
                    }
                  };

                  if (isInitialized) {
                    analyzeFrame();
                  }
                });
              } catch (error) {
                rejectOnce(error instanceof Error ? error : new Error(String(error)));
              }
            };

            img.onerror = () => {
              rejectOnce(new Error('Failed to load image'));
            };

            img.src = imageDataUrl;
          } catch (error) {
            rejectOnce(error instanceof Error ? error : new Error(String(error)));
          }
        });

        // Process detected results and update state with guarantee
        let finalResults: any[] = [];
        let errorMsg: string | null = null;

        if (results && results.length > 0) {
          for (const result of results) {
            if (result.codeResult && result.codeResult.code) {
              const value = result.codeResult.code;
              const format = result.codeResult.format || 'unknown';
              deduplicationManager.addOrUpdate(value, format, Date.now());
            }
          }
          finalResults = deduplicationManager.getResults();
        } else {
          errorMsg = 'No barcodes found in this image. Try again.';
        }

        setDetectionState(prev => ({
          ...prev,
          results: finalResults,
          isScanning: false,
          error: errorMsg,
        }));

        return finalResults;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Detection failed';
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
