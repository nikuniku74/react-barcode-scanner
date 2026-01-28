import { useCallback, useState } from 'react';
import { useCamera, useBarcodeDetection, usePhotoCapture } from './hooks';
import { CameraView, BarcodeResults } from './components';
import type { ScanState } from './types/barcode.types';
import './App.css';

/**
 * Main App Component
 * Implements explicit state machine for barcode scanning:
 * idle → processing → (completed | no-result | error) → idle
 *
 * Production-ready barcode scanner SPA with proper state management
 */
function App() {
  // Explicit state machine for barcode scanning workflow
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(true);

  // Initialize camera hook - camera is paused when scanState !== 'idle'
  const { videoRef, isLoading, hasPermission, error: cameraError, stream } = useCamera(
    cameraEnabled && scanState === 'idle'
  );

  // Initialize barcode detection hook (on-demand, not continuous)
  const {
    results,
    isScanning,
    clearResults,
    detectFromImage,
  } = useBarcodeDetection();

  // Initialize photo capture hook
  const { captureAsDataUrl } = usePhotoCapture();

  /**
   * Capture photo and transition through processing → completed/no-result state
   * Camera is paused during this entire phase
   */
  const handleCapturePhoto = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      console.log('[App] State: idle → processing (capturing photo)');
      setScanState('processing');
      setErrorMessage(null);

      // Capture photo as data URL
      console.log('[App] Capturing photo from video...');
      const photoDataUrl = captureAsDataUrl(videoRef);
      if (!photoDataUrl) {
        console.error('[App] Photo capture failed');
        setScanState('error');
        setErrorMessage('Failed to capture photo');
        return;
      }

      console.log('[App] Photo captured, starting analysis...');
      // Analyze photo for barcodes - detectFromImage returns the results array
      const detectedResults = await detectFromImage(photoDataUrl);

      console.log('[App] Analysis complete, results:', detectedResults.length);
      // Transition to final state based on detection results
      if (detectedResults && detectedResults.length > 0) {
        console.log('[App] State: processing → completed');
        setScanState('completed');
      } else {
        console.log('[App] State: processing → no-result');
        setScanState('no-result');
      }
    } catch (error) {
      console.error('[App] Error capturing photo:', error);
      const message = error instanceof Error ? error.message : 'Detection failed';
      console.log('[App] State: processing → error');
      setScanState('error');
      setErrorMessage(message);
    }
  }, [videoRef, captureAsDataUrl, detectFromImage]);

  /**
   * Reset state and return to idle for another capture
   * This will reactivate the camera
   */
  const handleCaptureAnother = useCallback(() => {
    setScanState('idle');
    setErrorMessage(null);
    clearResults();
  }, [clearResults]);

  /**
   * Toggle camera on/off
   */
  const handleToggleCamera = useCallback(() => {
    setCameraEnabled(prev => {
      const newState = !prev;
      console.log('[App] Camera toggle:', newState ? 'ON' : 'OFF');
      return newState;
    });
  }, []);

  /**
   * Retry camera access after permission denial
   */
  const handlePermissionRetry = useCallback(() => {
    setCameraEnabled(false);
    setTimeout(() => setCameraEnabled(true), 500);
  }, []);

  /**
   * Determine status text based on current scan state
   */
  const getStatusText = (): string => {
    if (hasPermission === false) {
      return 'Camera access denied';
    }
    if (isLoading) {
      return 'Initializing camera...';
    }

    switch (scanState) {
      case 'idle':
        return results.length > 0 ? `${results.length} barcode(s) detected` : 'Ready to scan';
      case 'processing':
        return `Analyzing... (${results.length} found)`;
      case 'completed':
        return `Found ${results.length} barcode(s)`;
      case 'no-result':
        return 'No barcodes found';
      case 'error':
        return errorMessage || 'Error during detection';
      default:
        return 'Ready to scan';
    }
  };

  /**
   * Determine if status indicator should be active
   */
  const isStatusActive = (): boolean => {
    return scanState === 'processing' || (scanState === 'idle' && isScanning);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">📸 Barcode Scanner</h1>
        <p className="app-subtitle">Scatta una foto e analizza i barcode</p>
      </header>

      <main className="app-main">
        {/* Camera Section - Hidden when not in idle state */}
        {scanState === 'idle' && (
          <CameraView
            videoRef={videoRef}
            cameraState={{
              stream,
              error: cameraError,
              isLoading,
              hasPermission,
            }}
            isScanning={isScanning}
          />
        )}

        {/* Camera disabled message during processing */}
        {scanState !== 'idle' && (
          <div className="camera-disabled-container">
            <div className="camera-disabled-message">
              <p className="disabled-status">
                {scanState === 'processing' && '⏳ Analizzando la foto...'}
                {scanState === 'completed' && '✅ Analisi completata'}
                {scanState === 'no-result' && '❌ Nessun barcode trovato'}
                {scanState === 'error' && '⚠️ Errore durante l\'analisi'}
              </p>
              {errorMessage && scanState === 'error' && (
                <p className="error-details">{errorMessage}</p>
              )}
            </div>
          </div>
        )}

        {/* Error handling for permission denied */}
        {hasPermission === false && (
          <div className="permission-denied-container">
            <button className="btn-retry" onClick={handlePermissionRetry}>
              🔄 Retry Camera Access
            </button>
          </div>
        )}

        {/* Results Section */}
        <BarcodeResults results={results} onClear={clearResults} />
      </main>

      {/* Control Footer */}
      <footer className="app-footer">
        <div className="footer-status">
          <span className={`status-indicator ${isStatusActive() ? 'active' : 'inactive'}`} />
          <span className="status-text">{getStatusText()}</span>
        </div>

        <div className="footer-buttons">
          {/* Show "Scatta Foto" only in idle state */}
          {scanState === 'idle' && stream && !isScanning && (
            <button className="btn-capture" onClick={handleCapturePhoto}>
              📷 Scatta Foto
            </button>
          )}

          {/* Show "Scatta un'altra foto" in completed, no-result, or error states */}
          {(scanState === 'completed' || scanState === 'no-result' || scanState === 'error') && (
            <button className="btn-capture" onClick={handleCaptureAnother}>
              📷 Scatta un'altra foto
            </button>
          )}

          {/* Camera toggle button always available */}
          <button className="btn-toggle" onClick={handleToggleCamera}>
            {cameraEnabled ? '❌ Spegni' : '✅ Accendi'}
          </button>
        </div>
      </footer>
    </div>
  );
}

export default App;
