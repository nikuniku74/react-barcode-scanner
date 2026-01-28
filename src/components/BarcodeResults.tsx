import React from 'react';
import type { BarcodeResult } from '../types/barcode.types';

interface BarcodeResultsProps {
  results: BarcodeResult[];
  onClear: () => void;
}

/**
 * BarcodeResults Component
 * Displays all detected barcodes with their details
 */
export const BarcodeResults: React.FC<BarcodeResultsProps> = ({ results, onClear }) => {
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatDuration = (start: number, end: number): string => {
    const seconds = Math.floor((end - start) / 1000);
    if (seconds < 1) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  };

  return (
    <div className="results-container">
      <div className="results-header">
        <h2 className="results-title">
          Detected Barcodes
          {results.length > 0 && <span className="badge">{results.length}</span>}
        </h2>
        {results.length > 0 && (
          <button className="btn-clear" onClick={onClear} title="Clear all results">
            Clear
          </button>
        )}
      </div>

      {results.length === 0 ? (
        <div className="results-empty">
          <p>No barcodes detected yet</p>
          <p className="empty-hint">Point your camera at a barcode</p>
        </div>
      ) : (
        <div className="results-list">
          {results.map(result => (
            <div key={result.id} className="barcode-item">
              <div className="barcode-info">
                <div className="barcode-value">
                  <code className="code-display">{result.value}</code>
                </div>
                <div className="barcode-meta">
                  <span className="format-badge">{result.format}</span>
                  <span className="detection-count">
                    {result.detectionCount > 1 ? `Detected ${result.detectionCount}x` : ''}
                  </span>
                </div>
              </div>

              <div className="barcode-timestamp">
                <div className="timestamp-item">
                  <span className="timestamp-label">First:</span>
                  <span className="timestamp-value">{formatDate(result.firstDetected)}</span>
                </div>
                {result.detectionCount > 1 && (
                  <div className="timestamp-item">
                    <span className="timestamp-label">Last:</span>
                    <span className="timestamp-value">
                      {formatDuration(result.lastDetected, Date.now())}
                    </span>
                  </div>
                )}
              </div>

              <button
                className="btn-copy"
                onClick={() => {
                  navigator.clipboard.writeText(result.value);
                }}
                title="Copy barcode value"
              >
                📋
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
