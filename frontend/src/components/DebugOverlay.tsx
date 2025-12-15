import React, { useEffect, useState } from 'react'
import { usePoseContext } from '../cv/poseContext'
import { getGestureLabel } from '../cv/gestureTypes'
import type { ActionLogEntry } from '../utils/actionDispatcher'

interface DebugOverlayProps {
  cooldownRemaining: number // milliseconds remaining
  lastTriggerTime: number | null // timestamp of last trigger
  sensitivity: number // current sensitivity value
  actionLog?: ActionLogEntry[] // last 5 dispatched actions
}

const DebugOverlay: React.FC<DebugOverlayProps> = ({
  cooldownRemaining,
  lastTriggerTime,
  sensitivity,
  actionLog = [],
}) => {
  const { currentGesture } = usePoseContext()
  const [ruleScore, setRuleScore] = useState<number>(0)

  // Compute simple rule score (0 or 1) based on whether current gesture is not REST
  useEffect(() => {
    // Simple rule score: 1 if gesture is detected (not REST), 0 otherwise
    setRuleScore(currentGesture !== 'REST' ? 1 : 0)
  }, [currentGesture])

  const formatTimestamp = (timestamp: number | null): string => {
    if (!timestamp) return 'Never'
    const date = new Date(timestamp)
    return date.toLocaleTimeString()
  }

  const formatCooldown = (ms: number): string => {
    if (ms <= 0) return 'Ready'
    return `${(ms / 1000).toFixed(1)}s`
  }

  return (
    <div
      className="debug-overlay"
      style={{
        position: 'fixed',
        bottom: '1rem',
        right: '1rem',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        color: '#fff',
        padding: '1rem',
        borderRadius: 'var(--radius-lg)',
        fontSize: '0.85rem',
        fontFamily: 'monospace',
        zIndex: 9999,
        minWidth: '250px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      <div
        style={{
          fontWeight: 'bold',
          marginBottom: '0.75rem',
          paddingBottom: '0.5rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
          fontSize: '0.9rem',
        }}
      >
        🐛 Debug Overlay
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ opacity: 0.8 }}>Gesture:</span>
          <span style={{ fontWeight: 'bold', color: currentGesture !== 'REST' ? '#4CAF50' : '#fff' }}>
            {getGestureLabel(currentGesture)}
          </span>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ opacity: 0.8 }}>Rule Score:</span>
          <span style={{ fontWeight: 'bold', color: ruleScore === 1 ? '#4CAF50' : '#fff' }}>
            {ruleScore}
          </span>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ opacity: 0.8 }}>Cooldown:</span>
          <span style={{ fontWeight: 'bold', color: cooldownRemaining > 0 ? '#FF9800' : '#4CAF50' }}>
            {formatCooldown(cooldownRemaining)}
          </span>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ opacity: 0.8 }}>Last Trigger:</span>
          <span style={{ fontSize: '0.8rem' }}>
            {formatTimestamp(lastTriggerTime)}
          </span>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ opacity: 0.8 }}>Sensitivity:</span>
          <span style={{ fontWeight: 'bold' }}>
            {sensitivity.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Action Log */}
      {actionLog.length > 0 && (
        <>
          <div
            style={{
              marginTop: '0.75rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.2)',
            }}
          >
            <div
              style={{
                fontSize: '0.75rem',
                opacity: 0.7,
                marginBottom: '0.5rem',
              }}
            >
              Recent Actions:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {actionLog.slice().reverse().map((entry, idx) => (
                <div
                  key={idx}
                  style={{
                    fontSize: '0.75rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    opacity: 0.9,
                  }}
                >
                  <span>
                    {getGestureLabel(entry.action)} ({entry.source === 'gesture' ? 'G' : 'K'})
                  </span>
                  <span style={{ opacity: 0.6 }}>
                    {((Date.now() - entry.timestamp) / 1000).toFixed(1)}s ago
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default DebugOverlay

