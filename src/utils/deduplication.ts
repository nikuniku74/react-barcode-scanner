import type { BarcodeResult } from '../types/barcode.types';

const DUPLICATE_WINDOW_MS = 2000; // 2 second window for duplicates

interface BarcodeEntry {
  result: BarcodeResult;
  expiresAt: number;
}

/**
 * Smart deduplication manager for barcode results
 * Uses a sliding window approach to avoid showing duplicate detections
 * while allowing the same barcode to be detected again after a time window
 */
export class DeduplicationManager {
  private barcodeMap = new Map<string, BarcodeEntry>();

  /**
   * Check if a barcode should be added or updated
   * Returns the result if it should be added/updated, null if it's a duplicate
   */
  public addOrUpdate(
    value: string,
    format: string,
    timestamp: number
  ): BarcodeResult | null {
    const key = this.generateKey(value, format);
    const now = Date.now();

    const existing = this.barcodeMap.get(key);

    // If entry exists and hasn't expired, it's a duplicate
    if (existing && now < existing.expiresAt) {
      // Update last detected time
      existing.result.lastDetected = timestamp;
      existing.result.detectionCount++;
      return null;
    }

    // Create new or refresh expired entry
    const result: BarcodeResult = {
      id: key,
      value,
      format,
      firstDetected: timestamp,
      lastDetected: timestamp,
      detectionCount: 1,
    };

    this.barcodeMap.set(key, {
      result,
      expiresAt: now + DUPLICATE_WINDOW_MS,
    });

    return result;
  }

  /**
   * Get all active results (not expired)
   */
  public getResults(): BarcodeResult[] {
    const now = Date.now();
    const results: BarcodeResult[] = [];

    for (const [key, entry] of this.barcodeMap.entries()) {
      if (now < entry.expiresAt) {
        results.push(entry.result);
      } else {
        this.barcodeMap.delete(key);
      }
    }

    return results.sort((a, b) => b.firstDetected - a.firstDetected);
  }

  /**
   * Clear all results
   */
  public clear(): void {
    this.barcodeMap.clear();
  }

  /**
   * Generate unique key for a barcode
   */
  private generateKey(value: string, format: string): string {
    return `${format}:${value}`;
  }
}

// Export singleton instance
export const deduplicationManager = new DeduplicationManager();
