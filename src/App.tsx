import { useCallback, useState } from 'react';
import { useCamera, useBarcodeDetection } from './hooks';
import { CameraView, BarcodeResults } from './components';
import './App.css';

/**
 * Main App Component
 * Orchestrates camera stream and barcode detection
 * Production-ready barcode scanner SPA
 */
function App() {
  const [isEnabled, setIsEnabled] = useState(true);

  // Initialize camera hook
  const { videoRef, isLoading, hasPermission, error: cameraError, stream } = useCamera(isEnabled);

  // Initialize barcode detection hook
  const {
    results,
    isScanning,
    clearResults,
  } = useBarcodeDetection(videoRef, isEnabled && !!stream);

  // Handle app disable/enable
  const handleToggleScanning = useCallback(() => {
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
                  ? `Scanning... (${results.length} detected)`
                  : 'Ready'}
          </span>
        </div>

        <button className="btn-toggle" onClick={handleToggleScanning}>
          {isEnabled ? '⏸️ Pause' : '▶️ Resume'}
        </button>
      </footer>
    </div>
  );
}

export default App;
