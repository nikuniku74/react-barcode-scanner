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
    async (imageDataUrl: string) => {
      try {
        setDetectionState(prev => ({ ...prev, isScanning: true, error: null }));

        // Clear previous results for new detection
        deduplicationManager.clear();

        // Create a promise-based wrapper for Quagga image processing
        const results = await new Promise<any[]>((resolve, reject) => {
          try {
            // Load image
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
                  reject(new Error('Could not get canvas context'));
                  return;
                }

                ctx.drawImage(img, 0, 0);

                // Initialize Quagga with image stream
                let isInitialized = false;

                Quagga.init(
                  {
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
                  },
                  (err: any) => {
                    if (err) {
                      reject(err);
                      return;
                    }
                    isInitialized = true;

                    // Process the image
                    const detectedBarcodes: any[] = [];

                    const handleDetection = (result: any) => {
                      if (result && result.codeResult && result.codeResult.code) {
                        // Check if already detected to avoid duplicates in same frame
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

                    // Analyze the canvas image frame by frame
                    const analyzeFrame = () => {
                      try {
                        // Get image data from canvas
                        const imageData = ctx.getImageData(
                          0,
                          0,
                          canvas.width,
                          canvas.height
                        );

                        // Process frame through Quagga
                        (Quagga as any).processFrame({
                          data: imageData.data,
                          width: canvas.width,
                          height: canvas.height,
                        });

                        // Give it time to process and then resolve
                        setTimeout(() => {
                          try {
                            Quagga.stop();
                          } catch (e) {
                            // Ignore
                          }
                          resolve(detectedBarcodes);
                        }, 300);
                      } catch (error) {
                        reject(error);
                      }
                    };

                    // Start analysis
                    if (isInitialized) {
                      analyzeFrame();
                    }
                  }
                );
              } catch (error) {
                reject(error);
              }
            };

            img.onerror = () => {
              reject(new Error('Failed to load image'));
            };

            img.src = imageDataUrl;
          } catch (error) {
            reject(error);
          }
        });

        // Process detected results
        if (results && results.length > 0) {
          for (const result of results) {
            if (result.codeResult && result.codeResult.code) {
              const value = result.codeResult.code;
              const format = result.codeResult.format || 'unknown';
              deduplicationManager.addOrUpdate(value, format, Date.now());
            }
          }

          const finalResults = deduplicationManager.getResults();
          setDetectionState(prev => ({
            ...prev,
            results: finalResults,
            isScanning: false,
          }));
        } else {
          setDetectionState(prev => ({
            ...prev,
            results: [],
            isScanning: false,
            error: 'No barcodes found in this image. Try again.',
          }));
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Detection failed';
        setDetectionState(prev => ({
          ...prev,
          error: errorMessage,
          results: [],
          isScanning: false,
        }));
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
