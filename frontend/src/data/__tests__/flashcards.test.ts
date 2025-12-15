import { describe, it, expect } from 'vitest'
import { getFlashcardsForCategory, getCategories } from '../flashcards'

describe('flashcards', () => {
  describe('getCategories', () => {
    it('should return non-empty array of categories', () => {
      const categories = getCategories()
      expect(categories).toBeInstanceOf(Array)
      expect(categories.length).toBeGreaterThan(0)
    })

    it('should return categories with id and label', () => {
      const categories = getCategories()
      categories.forEach(category => {
        expect(category).toHaveProperty('id')
        expect(category).toHaveProperty('label')
        expect(typeof category.id).toBe('string')
        expect(typeof category.label).toBe('string')
      })
    })
  })

  describe('getFlashcardsForCategory', () => {
    it('should return non-empty array for valid category', () => {
      const categories = getCategories()
      if (categories.length > 0) {
        const categoryId = categories[0].id
        const flashcards = getFlashcardsForCategory(categoryId)
        
        expect(flashcards).toBeInstanceOf(Array)
        expect(flashcards.length).toBeGreaterThan(0)
        
        // Verify flashcards have required properties
        flashcards.forEach(card => {
          expect(card).toHaveProperty('category')
          expect(card).toHaveProperty('german')
          expect(card).toHaveProperty('english')
        })
      }
    })

    it('should return empty array for invalid category', () => {
      const flashcards = getFlashcardsForCategory('non-existent-category-xyz')
      expect(flashcards).toEqual([])
    })

    it('should return empty array for empty string', () => {
      const flashcards = getFlashcardsForCategory('')
      expect(flashcards).toEqual([])
    })

    it('should return flashcards that match the category', () => {
      const categories = getCategories()
      if (categories.length > 0) {
        const category = categories[0]
        const flashcards = getFlashcardsForCategory(category.id)
        
        // All flashcards should belong to this category
        flashcards.forEach(card => {
          expect(card.category).toBe(category.label)
        })
      }
    })

    it('should handle multiple valid categories', () => {
      const categories = getCategories()
      if (categories.length >= 2) {
        const category1 = categories[0]
        const category2 = categories[1]
        
        const flashcards1 = getFlashcardsForCategory(category1.id)
        const flashcards2 = getFlashcardsForCategory(category2.id)
        
        expect(flashcards1.length).toBeGreaterThan(0)
        expect(flashcards2.length).toBeGreaterThan(0)
        
        // Categories should have different flashcards (assuming non-overlapping categories)
        const cardIds1 = flashcards1.map(c => c.german).sort()
        const cardIds2 = flashcards2.map(c => c.german).sort()
        
        // At least one flashcard should be different
        expect(
          cardIds1.some(id => !cardIds2.includes(id)) ||
          cardIds2.some(id => !cardIds1.includes(id))
        ).toBe(true)
      }
    })
  })
})

