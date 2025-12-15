/**
 * Calibration storage utilities.
 * Stores user-specific gesture calibration thresholds (wrist-up deltas) in localStorage.
 */

import type { CalibrationThresholds } from '../components/CalibrationModal'

const STORAGE_KEY = 'gestureCalibration'

/**
 * Save calibration thresholds to localStorage.
 */
export function saveCalibrationThresholds(thresholds: CalibrationThresholds): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(thresholds))
    console.log('[Calibration] Saved calibration thresholds')
  } catch (error) {
    console.warn('[Calibration] Failed to save calibration thresholds:', error)
    throw error
  }
}

/**
 * Load calibration thresholds from localStorage.
 * Returns null if no calibration exists.
 */
export function loadCalibrationThresholds(): CalibrationThresholds | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return null
    }

    const parsed = JSON.parse(stored) as CalibrationThresholds

    // Validate structure
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.rightHandUpDelta === 'number' &&
      typeof parsed.leftHandUpDelta === 'number' &&
      typeof parsed.bothHandsUpDelta === 'number' &&
      typeof parsed.calibrated === 'boolean'
    ) {
      return parsed
    }

    // Invalid structure, remove corrupted data
    localStorage.removeItem(STORAGE_KEY)
    return null
  } catch (error) {
    console.warn('[Calibration] Failed to load calibration thresholds:', error)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Ignore removal errors
    }
    return null
  }
}

/**
 * Clear calibration thresholds from localStorage.
 */
export function clearCalibrationThresholds(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
    console.log('[Calibration] Cleared calibration thresholds')
  } catch (error) {
    console.warn('[Calibration] Failed to clear calibration thresholds:', error)
  }
}

