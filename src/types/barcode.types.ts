/**
 * Type definitions for barcode scanner application
 */

/**
 * Explicit state machine for barcode scanning workflow
 */
export type ScanState = 'idle' | 'processing' | 'completed' | 'no-result' | 'error';

/**
 * Represents a single detected barcode
 */
export interface DetectedBarcode {
  rawValue: string;
  format: string;
  timestamp: number;
  position?: {
    topLeft: [number, number];
    topRight: [number, number];
    bottomLeft: [number, number];
    bottomRight: [number, number];
  };
}

/**
 * State for a barcode result displayed to user
 */
export interface BarcodeResult {
  id: string; // Unique identifier (format:value)
  value: string;
  format: string;
  firstDetected: number;
  lastDetected: number;
  detectionCount: number;
}

/**
 * Camera stream state
 */
export interface CameraState {
  stream: MediaStream | null;
  error: string | null;
  isLoading: boolean;
  hasPermission: boolean | null;
}

/**
 * Barcode detection state
 */
export interface DetectionState {
  results: BarcodeResult[];
  isScanning: boolean;
  error: string | null;
}

/**
 * Camera constraints for optimal barcode detection
 */
export interface CameraConstraints {
  video: {
    facingMode: 'environment' | 'user';
    width?: {
      ideal: number;
    };
    height?: {
      ideal: number;
    };
  };
  audio: false;
}
