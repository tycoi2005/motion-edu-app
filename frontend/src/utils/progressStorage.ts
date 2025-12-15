/**
 * Progress storage utilities for flashcard lessons.
 * Uses localStorage to persist lesson progress across page refreshes.
 */

export interface LessonProgress {
  index: number;          // current flashcard index
  completed: boolean;     // whether the user has completed this category
  showTranslation: boolean;  // whether translation is currently shown
}

const STORAGE_PREFIX = 'progress:';
const DEBOUNCE_MS = 200; // Debounce localStorage writes by 200ms

// Debounce timers and pending writes per category
const debounceTimers: Map<string, NodeJS.Timeout> = new Map();
const pendingWrites: Map<string, LessonProgress> = new Map();

/**
 * Load progress for a specific category from localStorage.
 * @param categoryId - The category identifier (slug)
 * @returns LessonProgress if found and valid, null otherwise
 */
export function loadProgress(categoryId: string): LessonProgress | null {
  if (!categoryId) {
    return null;
  }

  const storageKey = `${STORAGE_PREFIX}${categoryId}`;

  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as LessonProgress;

    // Validate the parsed data has the required fields with correct types
    if (
      typeof parsed.index === 'number' &&
      typeof parsed.completed === 'boolean' &&
      typeof parsed.showTranslation === 'boolean'
    ) {
      return {
        index: parsed.index,
        completed: parsed.completed,
        showTranslation: parsed.showTranslation,
      };
    }

    // Invalid structure, remove corrupted data
    localStorage.removeItem(storageKey);
    return null;
  } catch (error) {
    // JSON parse error or other localStorage issues
    // Silently fail and return null
    console.warn(`Failed to load progress for category "${categoryId}":`, error);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Ignore removal errors
    }
    return null;
  }
}

/**
 * Debounced write function for localStorage progress.
 * Batches multiple writes within 200ms window per category.
 */
function debouncedWriteProgress(categoryId: string): void {
  const data = pendingWrites.get(categoryId);
  if (!data) return;
  
  const storageKey = `${STORAGE_PREFIX}${categoryId}`;
  
  try {
    const serialized = JSON.stringify(data);
    localStorage.setItem(storageKey, serialized);
    console.log('[Performance] Batched localStorage write: Progress', categoryId);
  } catch (error) {
    console.warn(`Failed to save progress for category "${categoryId}":`, error);
  }
  
  pendingWrites.delete(categoryId);
  debounceTimers.delete(categoryId);
}

/**
 * Save progress for a specific category to localStorage.
 * Uses debouncing to batch writes and prevent performance drops.
 * @param categoryId - The category identifier (slug)
 * @param data - The lesson progress data to save
 */
export function saveProgress(categoryId: string, data: LessonProgress): void {
  if (!categoryId) {
    return;
  }

  // Store as pending write
  pendingWrites.set(categoryId, data);
  
  // Cancel existing timer for this category
  const existingTimer = debounceTimers.get(categoryId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }
  
  // Schedule write after debounce period
  const timer = setTimeout(() => {
    debouncedWriteProgress(categoryId);
  }, DEBOUNCE_MS);
  
  debounceTimers.set(categoryId, timer);
  console.log('[Performance] Progress throttled: Added to batch queue', categoryId);
}

/**
 * Reset progress for a specific category.
 * Clears the localStorage entry for the given category.
 * @param categoryId - The category identifier (slug)
 */
export function resetProgressForCategory(categoryId: string): void {
  if (!categoryId) {
    return;
  }

  try {
    // Cancel any pending debounced write for this category
    const existingTimer = debounceTimers.get(categoryId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      debounceTimers.delete(categoryId);
    }
    
    // Remove pending write
    pendingWrites.delete(categoryId);

    // Remove from localStorage
    const storageKey = `${STORAGE_PREFIX}${categoryId}`;
    localStorage.removeItem(storageKey);
    
    console.log(`[ProgressStorage] Reset progress for category: ${categoryId}`);
  } catch (error) {
    console.warn(`Failed to reset progress for category "${categoryId}":`, error);
    throw error;
  }
}

/**
 * Reset all progress for all categories.
 * Clears all localStorage entries with the progress prefix.
 */
export function resetAllProgress(): void {
  try {
    // Cancel all pending debounced writes
    debounceTimers.forEach((timer) => clearTimeout(timer));
    debounceTimers.clear();
    pendingWrites.clear();

    // Remove all keys starting with the progress prefix
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach((key) => localStorage.removeItem(key));
    
    console.log(`[ProgressStorage] Reset progress for ${keysToRemove.length} categories`);
  } catch (error) {
    console.warn('Failed to reset all progress:', error);
    throw error;
  }
}

