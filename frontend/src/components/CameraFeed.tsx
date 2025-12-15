import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { Pose } from '@mediapipe/pose'
import { Camera } from '@mediapipe/camera_utils'
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils'
import { POSE_CONNECTIONS } from '@mediapipe/pose'
import { usePoseContext } from '../cv/poseContext'
import { getGestureLabel, type GestureType } from '../cv/gestureTypes'
import { inferGestureFromLandmarks, type PoseLandmark } from '../cv/gestureEngine'
import { useSettings } from '../contexts/SettingsContext'
import Button from './Button'

type CameraState = 'initializing' | 'permission denied' | 'no camera found' | 'running'

/**
 * Maps getUserMedia errors to readable error messages and camera states
 */
function getCameraErrorState(error: unknown): { state: CameraState; message: string } {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return { state: 'permission denied', message: 'Camera permission denied' }
    }
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return { state: 'no camera found', message: 'No camera found' }
    }
    if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      return { state: 'no camera found', message: 'Camera is being used by another application' }
    }
    if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
      return { state: 'no camera found', message: 'Camera does not support required constraints' }
    }
  }
  // Default fallback
  return { state: 'no camera found', message: 'Camera not available' }
}

// Temporal smoothing configuration
const MAX_HISTORY_LENGTH = 7
const MIN_HISTORY_LENGTH = 4

// Performance: RAF throttling for pose results (module-level to persist across renders)
let globalRafId: number | null = null
let globalPendingResults: any = null
let globalLastFrameTime = 0
const TARGET_FPS = 30 // Target FPS for pose updates
const FRAME_INTERVAL = 1000 / TARGET_FPS

/**
 * Process pose results: detect gestures and draw on canvas.
 * Extracted for RAF throttling.
 */
function processPoseResults(
  results: any,
  canvas: HTMLCanvasElement,
  gestureSensitivityFactor: number,
  gestureHistoryRef: React.MutableRefObject<GestureType[]>,
  currentGestureRef: React.MutableRefObject<GestureType>,
  setGesture: (g: GestureType) => void
) {
  // Detect gesture from pose landmarks (primary detection method)
  if (results.poseLandmarks) {
    // Convert MediaPipe landmarks to PoseLandmark[] format
    const poseLandmarks = convertMediaPipeLandmarks(results.poseLandmarks)

    // Infer gesture from landmarks using gesture engine with sensitivity factor
    const inferredGesture = inferGestureFromLandmarks(poseLandmarks, gestureSensitivityFactor)

    // Add to history for temporal smoothing
    gestureHistoryRef.current.push(inferredGesture)

    // Limit history length to MAX_HISTORY_LENGTH
    if (gestureHistoryRef.current.length > MAX_HISTORY_LENGTH) {
      gestureHistoryRef.current.shift()
    }

    // Compute majority gesture from history
    if (gestureHistoryRef.current.length >= MIN_HISTORY_LENGTH) {
      const majorityGesture = computeMajorityGesture(gestureHistoryRef.current)

      // Only update gesture if:
      // a) majorityGesture is different from currentGesture
      // b) and history has at least MIN_HISTORY_LENGTH entries
      if (majorityGesture && majorityGesture !== currentGestureRef.current) {
        setGesture(majorityGesture)
      }
    }
  }

  // Draw on canvas
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Clear canvas
  ctx.save()
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Draw pose connections and landmarks
  if (results.poseLandmarks) {
    drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {
      color: '#00FF00',
      lineWidth: 2,
    })
    drawLandmarks(ctx, results.poseLandmarks, {
      color: '#FF0000',
      lineWidth: 1,
      radius: 3,
    })
  }

  ctx.restore()
}

/**
 * Computes the majority gesture from a history array.
 * Returns the gesture that appears most frequently.
 * Memoized to avoid recomputation for unchanged history.
 */
const computeMajorityGesture = (() => {
  let lastHistory: GestureType[] = []
  let lastResult: GestureType | null = null
  
  return (history: GestureType[]): GestureType | null => {
    // Quick check: if history hasn't changed, return cached result
    if (history.length === lastHistory.length && 
        history.every((g, i) => g === lastHistory[i])) {
      return lastResult
    }
    
    if (history.length === 0) {
      lastHistory = []
      lastResult = null
      return null
    }

    const counts: Record<GestureType, number> = {
      REST: 0,
      NEXT: 0,
      PREV: 0,
      SELECT: 0,
    }

    // Count occurrences of each gesture
    for (const gesture of history) {
      counts[gesture]++
    }

    // Find the gesture with the highest count
    let majorityGesture: GestureType = 'REST'
    let maxCount = 0

    for (const [gesture, count] of Object.entries(counts) as [GestureType, number][]) {
      if (count > maxCount) {
        maxCount = count
        majorityGesture = gesture
      }
    }

    lastHistory = [...history] // Store copy
    lastResult = majorityGesture
    return majorityGesture
  }
})()

/**
 * Converts MediaPipe Pose landmarks to PoseLandmark[] format.
 * Memoized to avoid unnecessary array operations.
 */
const convertMediaPipeLandmarks = (() => {
  let lastInput: any[] | null = null
  let lastOutput: PoseLandmark[] | null = null
  
  return (mpLandmarks: any[]): PoseLandmark[] => {
    // Quick check: if same reference, return cached
    if (mpLandmarks === lastInput && lastOutput !== null) {
      return lastOutput
    }
    
    const result = mpLandmarks.map((landmark) => ({
      x: landmark.x,
      y: landmark.y,
      z: landmark.z,
      visibility: landmark.visibility,
    }))
    
    lastInput = mpLandmarks
    lastOutput = result
    return result
  }
})()

interface CameraFeedProps {
  onLandmarksRequest?: (callback: (landmarks: PoseLandmark[] | null) => void) => void
}

const CameraFeedComponent: React.FC<CameraFeedProps> = ({ onLandmarksRequest }) => {
  const { currentGesture, setGesture } = usePoseContext()
  const { settings } = useSettings()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const gestureHistoryRef = useRef<GestureType[]>([])
  const currentGestureRef = useRef<GestureType>(currentGesture)
  const [cameraState, setCameraState] = useState<CameraState>('initializing')
  const cameraStateRef = useRef<CameraState>('initializing') // Ref to track state in callbacks
  const [isPoseReady, setIsPoseReady] = useState(false)
  const [setupTrigger, setSetupTrigger] = useState(0) // Used to trigger re-initialization on retry
  const landmarksCallbackRef = useRef<((landmarks: PoseLandmark[] | null) => void) | null>(null)
  
  // Get numeric sensitivity from localStorage (SettingsPanel stores 0-1 range)
  // This takes precedence over SettingsContext's Low/Medium/High for gestureEngine
  const [numericSensitivity, setNumericSensitivity] = useState(() => {
    try {
      const stored = localStorage.getItem('gestureSensitivity')
      if (stored !== null) {
        const parsed = parseFloat(stored)
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          return parsed
        }
      }
    } catch (error) {
      console.warn('Failed to load gestureSensitivity from localStorage:', error)
    }
    return 0.12 // Default value matching gestureEngine
  })
  
  // Set up landmarks callback if provided (prop) or via global event
  useEffect(() => {
    const handleCalibrationRequest = (e: CustomEvent) => {
      const callback = e.detail as (landmarks: PoseLandmark[] | null) => void
      landmarksCallbackRef.current = callback
    }

    if (onLandmarksRequest) {
      onLandmarksRequest((callback) => {
        landmarksCallbackRef.current = callback
      })
    }

    // Also listen for calibration modal requests
    window.addEventListener('calibrationLandmarksRequest', handleCalibrationRequest as EventListener)

    return () => {
      landmarksCallbackRef.current = null
      window.removeEventListener('calibrationLandmarksRequest', handleCalibrationRequest as EventListener)
      ;(window as any).__calibrationLandmarksCallback = null
    }
  }, [onLandmarksRequest])

  // Listen for localStorage changes to update sensitivity in real-time
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'gestureSensitivity' && e.newValue !== null) {
        const newValue = parseFloat(e.newValue)
        if (!isNaN(newValue) && newValue >= 0 && newValue <= 1) {
          setNumericSensitivity(newValue)
        }
      }
    }
    
    // Also check localStorage directly (for same-window changes)
    const checkSensitivity = () => {
      try {
        const stored = localStorage.getItem('gestureSensitivity')
        if (stored !== null) {
          const parsed = parseFloat(stored)
          if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
            setNumericSensitivity(parsed)
          }
        }
      } catch (error) {
        // Ignore errors
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    const interval = setInterval(checkSensitivity, 500) // Check every 500ms
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [])
  
  // Memoize settings to avoid unnecessary re-renders
  const mirrorCamera = useMemo(() => settings.mirrorCamera, [settings.mirrorCamera])

  // Keep refs in sync with state for use in callbacks
  useEffect(() => {
    currentGestureRef.current = currentGesture
  }, [currentGesture])

  useEffect(() => {
    cameraStateRef.current = cameraState
  }, [cameraState])

  // Set up MediaPipe Pose and webcam
  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    let stream: MediaStream | null = null
    let pose: Pose | null = null
    let camera: Camera | null = null

    const setupPose = async () => {
      try {
        setCameraState('initializing')
        setIsPoseReady(false)
        
        // Initialize Pose solution
        pose = new Pose({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
          },
        })

        pose.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          smoothSegmentation: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        })

        // Set up pose results callback with RAF throttling
        // Only process if camera state is 'running'
        pose.onResults((results) => {
          // Convert landmarks if callback is registered
          if (landmarksCallbackRef.current && results.poseLandmarks) {
            const poseLandmarks = convertMediaPipeLandmarks(results.poseLandmarks)
            landmarksCallbackRef.current(poseLandmarks)
          }

          // Only process pose results when camera is running
          if (cameraStateRef.current !== 'running') {
            return
          }

          // Mark pose as ready when we receive first valid landmarks
          if (results.poseLandmarks && results.poseLandmarks.length > 0) {
            setIsPoseReady(true)
          }
          
          // Store pending results
          globalPendingResults = results
          
          // Throttle updates using requestAnimationFrame
          const now = performance.now()
          const timeSinceLastFrame = now - globalLastFrameTime
          
          if (timeSinceLastFrame >= FRAME_INTERVAL) {
            // Process immediately if enough time has passed
            processPoseResults(results, canvas, numericSensitivity, gestureHistoryRef, currentGestureRef, setGesture)
            globalLastFrameTime = now
            globalPendingResults = null
          } else {
            // Schedule for next frame if pending RAF doesn't exist
            if (globalRafId === null) {
              globalRafId = requestAnimationFrame(() => {
                if (globalPendingResults && cameraStateRef.current === 'running') {
                  processPoseResults(globalPendingResults, canvas, numericSensitivity, gestureHistoryRef, currentGestureRef, setGesture)
                  globalLastFrameTime = performance.now()
                  globalPendingResults = null
                }
                globalRafId = null
              })
            }
          }
        })

        // Request webcam access
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true })
        } catch (mediaError) {
          const errorState = getCameraErrorState(mediaError)
          setCameraState(errorState.state)
          console.error('Error requesting camera access:', mediaError)
          return
        }

        // Attach stream to video element
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }

        // Wait for video metadata to load
        await new Promise((resolve) => {
          if (video.readyState >= 2) {
            resolve(void 0)
          } else {
            video.onloadedmetadata = () => resolve(void 0)
          }
        })

        // Set canvas size to match video
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight

        // Update state to running before starting camera loop
        setCameraState('running')

        // Initialize camera helper to process frames
        // Only start camera loop when state is 'running'
        camera = new Camera(video, {
          onFrame: async () => {
            // Only process frames when camera state is 'running'
            if (pose && cameraStateRef.current === 'running') {
              await pose.send({ image: video })
            }
          },
          width: video.videoWidth,
          height: video.videoHeight,
        })

        camera.start()

        console.log('MediaPipe Pose initialized successfully')
      } catch (error) {
        console.error('Error setting up MediaPipe Pose:', error)
        const errorState = getCameraErrorState(error)
        setCameraState(errorState.state)
      }
    }

    setupPose()

    // Cleanup: stop all tracks and close MediaPipe resources when component unmounts
    return () => {
      // Cancel pending RAF
      if (globalRafId !== null) {
        cancelAnimationFrame(globalRafId)
        globalRafId = null
      }
      globalPendingResults = null
      
      // Stop camera
      if (camera) {
        camera.stop()
      }

      // Close pose
      if (pose) {
        pose.close()
      }

      // Stop all tracks from the current video element
      if (videoRef.current && videoRef.current.srcObject) {
        const mediaStream = videoRef.current.srcObject as MediaStream
        mediaStream.getTracks().forEach((track) => {
          track.stop()
        })
        videoRef.current.srcObject = null
      }

      // Also stop the stream variable if it was set
      if (stream) {
        stream.getTracks().forEach((track) => {
          track.stop()
        })
      }
    }
  }, [setGesture, numericSensitivity, setupTrigger])

  // Retry camera initialization
  const handleRetry = useCallback(() => {
    setCameraState('initializing')
    setIsPoseReady(false)
    setSetupTrigger(prev => prev + 1) // Trigger effect re-run
  }, [])

  // Keyboard gesture simulation (fallback when pose detection is not available)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Map keyboard keys to gesture types
      const keyToGesture: Record<string, GestureType> = {
        r: 'REST',
        n: 'NEXT',
        p: 'PREV',
        s: 'SELECT',
      }

      const gesture = keyToGesture[event.key.toLowerCase()]

      if (gesture) {
        event.preventDefault()
        // Clear gesture history when keyboard override is used
        gestureHistoryRef.current = []
        // Override with keyboard input (useful for testing/fallback)
        setGesture(gesture)
      }
    }

    // Attach event listener
    window.addEventListener('keydown', handleKeyDown)

    // Cleanup: remove event listener on unmount
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [setGesture])

  const isRunning = cameraState === 'running'
  const isError = cameraState === 'permission denied' || cameraState === 'no camera found'

  return (
    <div className="camera-panel">
      <h2>Gesture Camera</h2>
      <p style={{ fontSize: '0.9em', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
        Your gestures (NEXT/PREV/SELECT) are detected here.
      </p>
      <div className="camera-container">
        {/* Camera Active Label - only show when running and pose is ready */}
        {isRunning && isPoseReady && (
          <div className="camera-active-label">
            <span className="camera-active-dot"></span>
            Camera Active
          </div>
        )}

        {/* Loading placeholder - show when initializing */}
        {cameraState === 'initializing' && (
          <div className="camera-loading-placeholder">
            <div className="camera-loading-spinner"></div>
            <p className="camera-loading-text">Initializing camera...</p>
          </div>
        )}

        {/* Error fallback card - show for permission denied or no camera found */}
        {isError && (
          <div className="camera-error-placeholder">
            <div style={{ maxWidth: '400px', padding: 'var(--spacing-lg)' }}>
              <h3 style={{ 
                fontSize: 'var(--font-size-lg)', 
                color: 'var(--color-text-primary)', 
                marginBottom: 'var(--spacing-base)',
                fontWeight: 'var(--font-weight-semibold)'
              }}>
                Camera not available
              </h3>
              <ul style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
                marginBottom: 'var(--spacing-lg)',
                paddingLeft: 'var(--spacing-lg)',
                textAlign: 'left'
              }}>
                <li style={{ marginBottom: 'var(--spacing-xs)' }}>
                  Allow camera permission in your browser settings
                </li>
                <li style={{ marginBottom: 'var(--spacing-xs)' }}>
                  Check that your camera is connected and not being used by another application
                </li>
              </ul>
              <Button 
                variant="primary" 
                onClick={handleRetry}
                style={{ width: '100%' }}
              >
                Retry
              </Button>
            </div>
          </div>
        )}

        <div className="camera-video-wrapper">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="camera-video"
            style={{
              transform: mirrorCamera ? 'scaleX(-1)' : 'none',
              opacity: isRunning && isPoseReady ? 1 : 0,
              transition: 'opacity 300ms ease-out',
            }}
          />
          <canvas
            ref={canvasRef}
            className="camera-canvas"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              opacity: isRunning && isPoseReady ? 1 : 0,
              transition: 'opacity 300ms ease-out',
            }}
          />
        </div>
      </div>
      {isRunning && (
        <p style={{ marginTop: '1rem' }}>
          <strong>Current gesture:</strong>{' '}
          <span className="gesture-badge">{getGestureLabel(currentGesture)}</span>
        </p>
      )}
      <p style={{ fontSize: '0.85em', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
        Keyboard controls still work: n/p/s/r
      </p>
    </div>
  )
}

// Memoize CameraFeed to prevent unnecessary re-renders
// Since CameraFeed uses context, React.memo will help with internal optimization
const CameraFeed = React.memo(CameraFeedComponent)

export default CameraFeed

