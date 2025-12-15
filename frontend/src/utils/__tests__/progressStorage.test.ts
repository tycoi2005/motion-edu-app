import { describe, it, expect, beforeEach, vi } from 'vitest'
import { saveProgress, loadProgress, resetProgressForCategory, resetAllProgress, type LessonProgress } from '../progressStorage'

describe('progressStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('saveProgress and loadProgress', () => {
    it('should save and load progress for a category', async () => {
      const categoryId = 'test-category'
      const progress: LessonProgress = {
        index: 5,
        completed: false,
        showTranslation: true,
      }

      saveProgress(categoryId, progress)

      // Wait for debounce (200ms + small buffer)
      await new Promise(resolve => setTimeout(resolve, 250))

      const loaded = loadProgress(categoryId)
      expect(loaded).toEqual(progress)
    })

    it('should return null for non-existent category', () => {
      const loaded = loadProgress('non-existent')
      expect(loaded).toBeNull()
    })

    it('should handle invalid stored data gracefully', () => {
      localStorage.setItem('progress:invalid', 'invalid-json')
      const loaded = loadProgress('invalid')
      expect(loaded).toBeNull()
      // Should remove invalid data
      expect(localStorage.getItem('progress:invalid')).toBeNull()
    })

    it('should handle corrupted data structure', () => {
      localStorage.setItem('progress:corrupted', JSON.stringify({ wrong: 'structure' }))
      const loaded = loadProgress('corrupted')
      expect(loaded).toBeNull()
      expect(localStorage.getItem('progress:corrupted')).toBeNull()
    })
  })

  describe('resetProgressForCategory', () => {
    it('should reset progress for a specific category', async () => {
      const categoryId = 'test-category'
      const progress: LessonProgress = {
        index: 10,
        completed: true,
        showTranslation: false,
      }

      saveProgress(categoryId, progress)
      await new Promise(resolve => setTimeout(resolve, 250))

      expect(loadProgress(categoryId)).not.toBeNull()

      resetProgressForCategory(categoryId)

      expect(loadProgress(categoryId)).toBeNull()
    })

    it('should not affect other categories', async () => {
      const category1 = 'category-1'
      const category2 = 'category-2'
      const progress1: LessonProgress = { index: 1, completed: false, showTranslation: false }
      const progress2: LessonProgress = { index: 2, completed: false, showTranslation: false }

      saveProgress(category1, progress1)
      saveProgress(category2, progress2)
      await new Promise(resolve => setTimeout(resolve, 250))

      resetProgressForCategory(category1)

      expect(loadProgress(category1)).toBeNull()
      expect(loadProgress(category2)).toEqual(progress2)
    })
  })

  describe('resetAllProgress', () => {
    it('should reset all progress for all categories', async () => {
      const category1 = 'category-1'
      const category2 = 'category-2'
      const progress1: LessonProgress = { index: 1, completed: false, showTranslation: false }
      const progress2: LessonProgress = { index: 2, completed: false, showTranslation: false }

      saveProgress(category1, progress1)
      saveProgress(category2, progress2)
      // Wait for debounce to complete so data is actually in localStorage
      await new Promise(resolve => setTimeout(resolve, 300))

      expect(loadProgress(category1)).not.toBeNull()
      expect(loadProgress(category2)).not.toBeNull()

      resetAllProgress()

      // resetAllProgress should clear all progress: keys
      // Since it iterates localStorage, the data should be gone
      const remaining1 = loadProgress(category1)
      const remaining2 = loadProgress(category2)
      
      // If reset worked, both should be null
      // If timing issue, at least verify the function runs without error
      expect(remaining1).toBeNull()
      expect(remaining2).toBeNull()
    })

    it('should handle empty localStorage gracefully', () => {
      expect(() => resetAllProgress()).not.toThrow()
    })
  })
})

