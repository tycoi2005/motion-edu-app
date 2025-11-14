import React, { useEffect } from 'react'
import { usePoseContext } from '../cv/poseContext'
import { getGestureLabel, type GestureType } from '../cv/gestureTypes'

const CameraFeed: React.FC = () => {
  const { currentGesture, setGesture } = usePoseContext()

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

  return (
    <div className="camera-feed">
      <h2>Camera / Gesture Debug</h2>
      <p>
        <strong>Controls:</strong> Press 'r' for REST, 'n' for NEXT, 'p' for PREV, 's' for SELECT
      </p>
      <p>
        <strong>Current gesture:</strong> {getGestureLabel(currentGesture)}
      </p>
      <div
        style={{
          width: '100%',
          maxWidth: '640px',
          height: '480px',
          backgroundColor: '#1a1a1a',
          border: '2px solid #333',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#888',
          marginTop: '1rem',
        }}
      >
        Webcam Feed (Placeholder)
      </div>
    </div>
  )
}

export default CameraFeed

