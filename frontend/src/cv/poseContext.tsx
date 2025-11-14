import React, { createContext, useContext, useState, type ReactNode } from 'react'
import type { GestureType } from './gestureTypes'

interface PoseContextValue {
  currentGesture: GestureType
  setGesture: (g: GestureType) => void
}

const defaultContextValue: PoseContextValue = {
  currentGesture: 'REST',
  setGesture: () => {
    // No-op function for default context
  },
}

const PoseContext = createContext<PoseContextValue | undefined>(undefined)

interface PoseProviderProps {
  children: ReactNode
}

export function PoseProvider({ children }: PoseProviderProps) {
  const [currentGesture, setCurrentGesture] = useState<GestureType>('REST')

  const setGesture = (g: GestureType) => {
    setCurrentGesture(g)
  }

  const value: PoseContextValue = {
    currentGesture,
    setGesture,
  }

  return <PoseContext.Provider value={value}>{children}</PoseContext.Provider>
}

export function usePoseContext(): PoseContextValue {
  const ctx = useContext(PoseContext)

  if (!ctx) {
    throw new Error('usePoseContext must be used within a PoseProvider')
  }

  return ctx
}

