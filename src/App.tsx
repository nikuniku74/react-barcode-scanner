import { useCallback, useState } from 'react';
import { useCamera, useBarcodeDetection, usePhotoCapture } from './hooks';
import { CameraView, BarcodeResults } from './components';
import './App.css';

/**
 * Main App Component
 * Capture photo → Analyze for barcodes → Display results
 * Production-ready barcode scanner SPA
 */
function App() {
  const [isEnabled, setIsEnabled] = useState(true);

  // Initialize camera hook
  const { videoRef, isLoading, hasPermission, error: cameraError, stream } = useCamera(isEnabled);

  // Initialize barcode detection hook (on-demand, not continuous)
  const {
    results,
    isScanning,
    clearResults,
    detectFromImage,
  } = useBarcodeDetection();

  // Initialize photo capture hook
  const { captureAsDataUrl } = usePhotoCapture();

  // Handle photo capture and analysis
  const handleCapturePhoto = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      // Capture photo as data URL
      const photoDataUrl = captureAsDataUrl(videoRef);
      if (!photoDataUrl) {
        alert('Failed to capture photo');
        return;
      }

      // Analyze photo for barcodes
      await detectFromImage(photoDataUrl);
    } catch (error) {
      console.error('Error capturing photo:', error);
      alert('Failed to analyze photo');
    }
  }, [videoRef, captureAsDataUrl, detectFromImage]);

  // Handle camera disable/enable
  const handleToggleCamera = useCallback(() => {
    setIsEnabled(prev => !prev);
  }, []);

  const handlePermissionRetry = useCallback(() => {
    setIsEnabled(false);
    // Small delay before re-enabling to reset camera state
    setTimeout(() => setIsEnabled(true), 500);
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">📸 Barcode Scanner</h1>
        <p className="app-subtitle">Scatta una foto e analizza i barcode</p>
      </header>

      <main className="app-main">
        {/* Camera Section */}
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
          <span className={`status-indicator ${isScanning ? 'active' : 'inactive'}`} />
          <span className="status-text">
            {hasPermission === false
              ? 'Camera access denied'
              : isLoading
                ? 'Initializing camera...'
                : isScanning
                  ? `Analyzing... (${results.length} found)`
                  : results.length > 0
                    ? `${results.length} barcode(s) detected`
                    : 'Ready to scan'}
          </span>
        </div>

        <div className="footer-buttons">
          {stream && !isScanning && (
            <button className="btn-capture" onClick={handleCapturePhoto}>
              📷 Scatta Foto
            </button>
          )}
          <button className="btn-toggle" onClick={handleToggleCamera}>
            {isEnabled ? '❌ Spegni' : '✅ Accendi'}
          </button>
        </div>
      </footer>
    </div>
  );
}

export default App;
