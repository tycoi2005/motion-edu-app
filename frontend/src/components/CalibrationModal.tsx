import React, { useState, useEffect, useRef } from 'react'
import type { PoseLandmark } from '../cv/gestureEngine'
import Button from './Button'

type CalibrationStep = 'rest' | 'right' | 'left' | 'both' | 'complete' | 'error'

interface CalibrationModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: (thresholds: CalibrationThresholds) => void
  onLandmarksRequest: (callback: (landmarks: PoseLandmark[] | null) => void) => void
}

export interface CalibrationThresholds {
  rightHandUpDelta: number // dy for right hand up (shoulder.y - wrist.y)
  leftHandUpDelta: number // dy for left hand up (shoulder.y - wrist.y)
  bothHandsUpDelta: number // min dy for both hands up
  calibrated: boolean
}

const STEPS: Array<{ key: CalibrationStep; label: string; instruction: string }> = [
  { key: 'rest', label: 'Step 1', instruction: 'Stand neutral (REST) position' },
  { key: 'right', label: 'Step 2', instruction: 'Raise RIGHT hand' },
  { key: 'left', label: 'Step 3', instruction: 'Raise LEFT hand' },
  { key: 'both', label: 'Step 4', instruction: 'Raise BOTH hands' },
]

const CALIBRATION_DURATION_MS = 2000
const COLLECTION_INTERVAL_MS = 50 // Collect every 50ms

const LANDMARK_INDICES = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
} as const

const MIN_VISIBILITY = 0.5

const CalibrationModal: React.FC<CalibrationModalProps> = ({ isOpen, onClose, onComplete, onLandmarksRequest }) => {
  const [currentStep, setCurrentStep] = useState<CalibrationStep>('rest')
  const [countdown, setCountdown] = useState(0)
  const [isCollecting, setIsCollecting] = useState(false)
  const collectedDeltasRef = useRef<Array<{ dyRight: number; dyLeft: number }>>([])
  const [error, setError] = useState<string | null>(null)
  const landmarksCallbackRef = useRef<((landmarks: PoseLandmark[] | null) => void) | null>(null)

  // Subscribe to landmarks
  useEffect(() => {
    if (isOpen) {
      onLandmarksRequest((landmarks) => {
        if (landmarksCallbackRef.current) {
          landmarksCallbackRef.current(landmarks)
        }
      })
    }
  }, [isOpen, onLandmarksRequest])

  // Handle step countdown and data collection
  useEffect(() => {
    if (!isOpen || currentStep === 'complete' || currentStep === 'error') return

    let countdownInterval: number
    let collectionInterval: number
    let collectionTimeout: number

    const startStep = () => {
      collectedDeltasRef.current = []
      setCountdown(3) // 3 second countdown before collection starts

      countdownInterval = window.setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval)
            // Start collecting
            setIsCollecting(true)
            setCountdown(CALIBRATION_DURATION_MS / 1000)

            // Set up landmarks callback
            landmarksCallbackRef.current = (landmarks: PoseLandmark[] | null) => {
              if (!landmarks || landmarks.length < 17) return

              const leftShoulder = landmarks[LANDMARK_INDICES.LEFT_SHOULDER]
              const rightShoulder = landmarks[LANDMARK_INDICES.RIGHT_SHOULDER]
              const leftWrist = landmarks[LANDMARK_INDICES.LEFT_WRIST]
              const rightWrist = landmarks[LANDMARK_INDICES.RIGHT_WRIST]

              // Check visibility
              if (
                !leftShoulder || !rightShoulder || !leftWrist || !rightWrist ||
                (leftShoulder.visibility !== undefined && leftShoulder.visibility < MIN_VISIBILITY) ||
                (rightShoulder.visibility !== undefined && rightShoulder.visibility < MIN_VISIBILITY) ||
                (leftWrist.visibility !== undefined && leftWrist.visibility < MIN_VISIBILITY) ||
                (rightWrist.visibility !== undefined && rightWrist.visibility < MIN_VISIBILITY)
              ) {
                return
              }

              // Calculate deltas: dy = shoulder.y - wrist.y (positive means wrist above shoulder)
              const dyRight = rightShoulder.y - rightWrist.y
              const dyLeft = leftShoulder.y - leftWrist.y

              collectedDeltasRef.current.push({ dyRight, dyLeft })
            }

            // Collect for CALIBRATION_DURATION_MS
            collectionTimeout = window.setTimeout(() => {
              setIsCollecting(false)
              landmarksCallbackRef.current = null

              const deltas = collectedDeltasRef.current
              if (deltas.length === 0) {
                setError('No pose detected. Please ensure you are visible in the camera.')
                setCurrentStep('error')
                return
              }

              // Calculate average deltas for this step
              const avgDyRight = deltas.reduce((sum, d) => sum + d.dyRight, 0) / deltas.length
              const avgDyLeft = deltas.reduce((sum, d) => sum + d.dyLeft, 0) / deltas.length

              // Store in accumulated step data
              allStepDataRef.current[currentStep] = { dyRight: avgDyRight, dyLeft: avgDyLeft }

              // Move to next step or complete
              const currentIndex = STEPS.findIndex((s) => s.key === currentStep)
              if (currentIndex < STEPS.length - 1) {
                // Move to next step
                setTimeout(() => {
                  setCurrentStep(STEPS[currentIndex + 1].key as CalibrationStep)
                }, 500)
              } else {
                // All steps complete, compute thresholds using all accumulated data
                computeThresholds({ ...allStepDataRef.current })
              }
            }, CALIBRATION_DURATION_MS)

            // Update countdown during collection
            const countdownUpdate = window.setInterval(() => {
              setCountdown((prev) => {
                const remaining = prev - 0.1
                return remaining <= 0 ? 0 : remaining
              })
            }, 100)

            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    startStep()

    return () => {
      if (countdownInterval) clearInterval(countdownInterval)
      if (collectionTimeout) clearTimeout(collectionTimeout)
      if (collectionInterval) clearInterval(collectionInterval)
      landmarksCallbackRef.current = null
    }
  }, [isOpen, currentStep])

  // Accumulate all step data
  const allStepDataRef = useRef<Record<string, { dyRight: number; dyLeft: number }>>({})

  const computeThresholds = (stepData: Record<string, { dyRight: number; dyLeft: number }>) => {
    try {
      // Check if we have all steps
      const hasAllSteps = STEPS.slice(0, 4).every((step) => step.key in stepData)

      if (!hasAllSteps) {
        // Wait for next step
        return
      }

      const rest = stepData.rest
      const right = stepData.right
      const left = stepData.left
      const both = stepData.both

      // Calculate wrist-up deltas relative to rest position
      // Right hand up delta = right step dy - rest dy
      const rightHandUpDelta = right.dyRight - rest.dyRight
      // Left hand up delta = left step dy - rest dy
      const leftHandUpDelta = left.dyLeft - rest.dyLeft
      // Both hands up delta = min of both hands raised
      const bothHandsUpDelta = Math.min(
        both.dyRight - rest.dyRight,
        both.dyLeft - rest.dyLeft
      )

      const thresholds: CalibrationThresholds = {
        rightHandUpDelta: Math.max(0, rightHandUpDelta),
        leftHandUpDelta: Math.max(0, leftHandUpDelta),
        bothHandsUpDelta: Math.max(0, bothHandsUpDelta),
        calibrated: true,
      }

      onComplete(thresholds)
      setCurrentStep('complete')
    } catch (error) {
      console.error('Error computing thresholds:', error)
      setError('Failed to compute calibration thresholds. Please try again.')
      setCurrentStep('error')
    }
  }

  const handleRetry = () => {
    setCurrentStep('rest')
    setCountdown(0)
    setIsCollecting(false)
    setError(null)
    collectedDeltasRef.current = []
    allStepDataRef.current = {}
  }

  const handleClose = () => {
    setCurrentStep('rest')
    setCountdown(0)
    setIsCollecting(false)
    setError(null)
    collectedDeltasRef.current = []
    allStepDataRef.current = {}
    landmarksCallbackRef.current = null
    onClose()
  }

  if (!isOpen) return null

  const currentStepInfo = STEPS.find((s) => s.key === currentStep)

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--color-bg-surface)',
          borderRadius: 'var(--radius-lg)',
          padding: '2rem',
          maxWidth: '600px',
          width: '100%',
          color: 'var(--color-text-primary)',
        }}
      >
        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>Gesture Calibration</h2>

        {currentStep === 'complete' ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Calibration Complete</p>
            <p style={{ marginBottom: '1.5rem', color: 'var(--color-text-secondary)' }}>
              Your gesture thresholds have been saved. You can now use gestures with improved accuracy.
            </p>
            <Button variant="primary" onClick={handleClose}>
              Close
            </Button>
          </div>
        ) : currentStep === 'error' ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ marginBottom: '1rem', color: 'var(--color-danger)', fontSize: '1.1rem' }}>
              Calibration Failed
            </p>
            <p style={{ marginBottom: '1.5rem', color: 'var(--color-text-secondary)' }}>{error}</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <Button variant="secondary" onClick={handleClose}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleRetry}>
                Retry
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                {STEPS.slice(0, 4).map((step, index) => (
                  <div
                    key={step.key}
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      padding: '0.5rem',
                      backgroundColor:
                        step.key === currentStep
                          ? 'var(--color-primary)'
                          : STEPS.findIndex((s) => s.key === currentStep) > index
                          ? 'var(--color-success)'
                          : 'var(--color-bg-secondary)',
                      color: step.key === currentStep || STEPS.findIndex((s) => s.key === currentStep) > index ? '#fff' : 'var(--color-text-secondary)',
                      borderRadius: 'var(--radius-base)',
                      marginRight: index < 3 ? '0.5rem' : 0,
                      fontSize: '0.9rem',
                      fontWeight: step.key === currentStep ? 'bold' : 'normal',
                    }}
                  >
                    {step.label}
                  </div>
                ))}
              </div>

              {currentStepInfo && (
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  <p style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                    {currentStepInfo.instruction}
                  </p>
                  <p style={{ fontSize: '3rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                    {countdown > 0 ? Math.ceil(countdown) : ''}
                  </p>
                  {isCollecting && (
                    <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
                      Collecting data... Please hold position
                    </p>
                  )}
                  {!isCollecting && countdown > 0 && (
                    <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
                      Get ready...
                    </p>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <Button variant="secondary" onClick={handleClose} disabled={isCollecting}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default CalibrationModal
