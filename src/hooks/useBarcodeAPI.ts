import { useCallback, useState } from 'react';
import type { BarcodeResult, DetectionState } from '../types/barcode.types';

const API_URL = import.meta.env.VITE_API_URL || 'http://192.168.1.63:8000';

/**
 * Hook to send image to backend API for barcode detection
 * Backend handles all barcode detection logic
 * Frontend is now extremely simple (upload + display)
 */
export const useBarcodeAPI = () => {
  const [detectionState, setDetectionState] = useState<DetectionState>({
    results: [],
    isScanning: false,
    error: null,
  });

  /**
   * Send image blob to backend API for scanning
   */
  const scanImage = useCallback(
    async (imageBlob: Blob): Promise<BarcodeResult[]> => {
      try {
        setDetectionState(prev => ({ ...prev, isScanning: true, error: null }));

        console.log('[Barcode API] Uploading image to backend:', imageBlob.size, 'bytes');

        // Create FormData with image
        const formData = new FormData();
        formData.append('image', imageBlob, 'photo.png');

        // Send to backend
        const response = await fetch(`${API_URL}/api/scan`, {
          method: 'POST',
          body: formData,
        });

        console.log('[Barcode API] Response status:', response.status);

        if (!response.ok) {
          const errorData = await response.json();
          const errorMsg = errorData.detail || errorData.error || 'Backend error';
          throw new Error(`Backend error: ${errorMsg}`);
        }

        // Parse response
        const data = await response.json();

        console.log('[Barcode API] Scan complete, found:', data.barcodes?.length || 0);

        // Transform backend response to frontend format
        const results: BarcodeResult[] = (data.barcodes || []).map(
          (barcode: any) => ({
            id: `${barcode.format}:${barcode.value}`,
            value: barcode.value,
            format: barcode.format,
            firstDetected: Date.now(),
            lastDetected: Date.now(),
            detectionCount: 1,
          })
        );

        // Update state
        setDetectionState(prev => ({
          ...prev,
          results,
          isScanning: false,
          error: results.length === 0 ? 'No barcodes found' : null,
        }));

        return results;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[Barcode API] Error:', errorMessage);

        // Update state with error
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
    setDetectionState(prev => ({ ...prev, results: [], error: null }));
  }, []);

  return {
    ...detectionState,
    scanImage,
    clearResults,
  };
};
