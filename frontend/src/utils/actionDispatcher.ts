/**
 * Unified Action Dispatcher
 * 
 * Centralizes input handling for gesture and keyboard actions.
 * Enforces stability rules to prevent double-fires:
 * - Cooldown: Minimum time between any actions
 * - Flip lock: Ignore inputs during flashcard flip animation
 * - Repeat prevention: Ignore repeated identical actions within short window
 */

export type ActionType = 'NEXT' | 'PREV' | 'SELECT' | 'REST'

export interface ActionDispatchResult {
  dispatched: boolean
  reason?: 'cooldown' | 'flip_animation' | 'repeat_prevention'
}

export interface ActionLogEntry {
  action: ActionType
  timestamp: number
  source: 'gesture' | 'keyboard'
}

export interface ActionDispatcherConfig {
  cooldownMs: number
  repeatPreventionMs: number
  maxLogEntries: number
}

export interface ActionDispatcherState {
  lastActionTime: number
  lastActionType: ActionType | null
  actionLog: ActionLogEntry[]
}

/**
 * Creates a new action dispatcher instance.
 */
export function createActionDispatcher(config: ActionDispatcherConfig = {
  cooldownMs: 1000,
  repeatPreventionMs: 300,
  maxLogEntries: 5,
}): {
  state: ActionDispatcherState
  dispatch: (action: ActionType, source: 'gesture' | 'keyboard', isFlipping: boolean) => ActionDispatchResult
  getActionLog: () => ActionLogEntry[]
  reset: () => void
} {
  const state: ActionDispatcherState = {
    lastActionTime: 0,
    lastActionType: null,
    actionLog: [],
  }

  /**
   * Attempts to dispatch an action, enforcing all stability rules.
   */
  function dispatch(
    action: ActionType,
    source: 'gesture' | 'keyboard',
    isFlipping: boolean
  ): ActionDispatchResult {
    const now = Date.now()
    const timeSinceLastAction = now - state.lastActionTime

    // Rule 1: Ignore inputs during flip animation
    if (isFlipping) {
      return { dispatched: false, reason: 'flip_animation' }
    }

    // Rule 2: Enforce cooldown (minimum time between any actions)
    if (timeSinceLastAction < config.cooldownMs) {
      return { dispatched: false, reason: 'cooldown' }
    }

    // Rule 3: Prevent repeated identical actions within short window
    if (
      action === state.lastActionType &&
      action !== 'REST' && // REST doesn't need repeat prevention
      timeSinceLastAction < config.repeatPreventionMs
    ) {
      return { dispatched: false, reason: 'repeat_prevention' }
    }

    // Action passes all checks - dispatch it
    state.lastActionTime = now
    state.lastActionType = action

    // Log the action
    state.actionLog.push({
      action,
      timestamp: now,
      source,
    })

    // Keep only the last N entries
    if (state.actionLog.length > config.maxLogEntries) {
      state.actionLog.shift()
    }

    return { dispatched: true }
  }

  /**
   * Gets the action log (for debug overlay).
   */
  function getActionLog(): ActionLogEntry[] {
    return [...state.actionLog]
  }

  /**
   * Resets the dispatcher state (useful for lesson restart).
   */
  function reset(): void {
    state.lastActionTime = 0
    state.lastActionType = null
    state.actionLog = []
  }

  return {
    state,
    dispatch,
    getActionLog,
    reset,
  }
}

