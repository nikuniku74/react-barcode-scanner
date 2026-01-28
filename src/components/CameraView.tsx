import React from 'react';
import type { CameraState } from '../types/barcode.types';

interface CameraViewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  cameraState: CameraState;
  isScanning: boolean;
}

/**
 * CameraView Component
 * Displays the live camera feed and provides visual feedback
 */
export const CameraView: React.FC<CameraViewProps> = ({
  videoRef,
  cameraState,
  isScanning,
}) => {
  return (
    <div className="camera-container">
      <div className="camera-wrapper">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="camera-video"
        />

        {cameraState.isLoading && (
          <div className="camera-overlay overlay-loading">
            <div className="loading-spinner" />
            <p>Initializing camera...</p>
          </div>
        )}

        {cameraState.hasPermission === false && (
          <div className="camera-overlay overlay-error">
            <p className="error-title">Camera Permission Denied</p>
            <p className="error-message">{cameraState.error}</p>
            <p className="error-hint">Please enable camera access in your browser settings</p>
          </div>
        )}

        {isScanning && cameraState.hasPermission && (
          <div className="camera-scanning-indicator">
            <div className="scanning-dot" />
            <span>Scanning...</span>
          </div>
        )}
      </div>

      {cameraState.error && cameraState.hasPermission !== false && (
        <div className="camera-error-message">
          <span>⚠️</span>
          <p>{cameraState.error}</p>
        </div>
      )}
    </div>
  );
};
