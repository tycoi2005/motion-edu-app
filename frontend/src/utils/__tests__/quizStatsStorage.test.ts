import { describe, it, expect, beforeEach } from 'vitest'
import {
  updateQuizStat,
  getQuizStat,
  resetQuizStatsForCategory,
  resetAllQuizStats,
  updateQuizStatsForAnswer,
  computeCardPriority,
  chooseNextQuizCardIndex,
  getCardId,
  type QuizCardStats,
} from '../quizStatsStorage'
import type { Flashcard } from '../../data/flashcards'

describe('quizStatsStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('updateQuizStat', () => {
    it('should increment correct count for correct answer', () => {
      const cardKey = 'category1|test-word'
      
      updateQuizStat(cardKey, 'correct')
      const stat = getQuizStat(cardKey)
      
      expect(stat).not.toBeNull()
      expect(stat?.totalAttempts).toBe(1)
      expect(stat?.correctCount).toBe(1)
      expect(stat?.lastResult).toBe('correct')
    })

    it('should increment total attempts but not correct count for incorrect answer', () => {
      const cardKey = 'category1|test-word'
      
      updateQuizStat(cardKey, 'incorrect')
      const stat = getQuizStat(cardKey)
      
      expect(stat).not.toBeNull()
      expect(stat?.totalAttempts).toBe(1)
      expect(stat?.correctCount).toBe(0)
      expect(stat?.lastResult).toBe('incorrect')
    })

    it('should accumulate stats across multiple updates', () => {
      const cardKey = 'category1|test-word'
      
      updateQuizStat(cardKey, 'correct')
      updateQuizStat(cardKey, 'incorrect')
      updateQuizStat(cardKey, 'correct')
      const stat = getQuizStat(cardKey)
      
      expect(stat?.totalAttempts).toBe(3)
      expect(stat?.correctCount).toBe(2)
      expect(stat?.lastResult).toBe('correct')
    })
  })

  describe('updateQuizStatsForAnswer (spaced repetition)', () => {
    const mockCard: Flashcard = {
      category: 'test-category',
      german: 'test-word',
      english: 'test translation',
      image_url: '',
      image_local: '',
    }

    it('should create new stats for a new card with correct answer', () => {
      const stats = {}
      const updated = updateQuizStatsForAnswer(stats, mockCard, true)
      
      const cardId = getCardId(mockCard)
      const cardStats = updated[cardId]
      
      expect(cardStats).toBeDefined()
      expect(cardStats.correctStreak).toBe(1)
      expect(cardStats.incorrectCount).toBe(0)
      expect(cardStats.cardId).toBe(cardId)
    })

    it('should create new stats for a new card with incorrect answer', () => {
      const stats = {}
      const updated = updateQuizStatsForAnswer(stats, mockCard, false)
      
      const cardId = getCardId(mockCard)
      const cardStats = updated[cardId]
      
      expect(cardStats).toBeDefined()
      expect(cardStats.correctStreak).toBe(0)
      expect(cardStats.incorrectCount).toBe(1)
    })

    it('should increment correct streak for consecutive correct answers', () => {
      const stats = {}
      let updated = updateQuizStatsForAnswer(stats, mockCard, true)
      updated = updateQuizStatsForAnswer(updated, mockCard, true)
      updated = updateQuizStatsForAnswer(updated, mockCard, true)
      
      const cardId = getCardId(mockCard)
      const cardStats = updated[cardId]
      
      expect(cardStats.correctStreak).toBe(3)
      expect(cardStats.incorrectCount).toBe(0)
    })

    it('should reset correct streak and increment incorrect count on wrong answer', () => {
      const stats = {}
      let updated = updateQuizStatsForAnswer(stats, mockCard, true)
      updated = updateQuizStatsForAnswer(updated, mockCard, true)
      updated = updateQuizStatsForAnswer(updated, mockCard, false)
      
      const cardId = getCardId(mockCard)
      const cardStats = updated[cardId]
      
      expect(cardStats.correctStreak).toBe(0)
      expect(cardStats.incorrectCount).toBe(1)
    })
  })

  describe('computeCardPriority', () => {
    it('should return default priority for cards without stats', () => {
      const priority = computeCardPriority(undefined)
      expect(priority).toBe(2)
    })

    it('should increase priority with incorrect count', () => {
      const stats: QuizCardStats = {
        cardId: 'test',
        correctStreak: 0,
        incorrectCount: 3,
        lastSeen: new Date().toISOString(),
      }
      const priority = computeCardPriority(stats)
      expect(priority).toBeGreaterThan(2)
    })

    it('should decrease priority with correct streak', () => {
      const stats: QuizCardStats = {
        cardId: 'test',
        correctStreak: 5,
        incorrectCount: 0,
        lastSeen: new Date().toISOString(),
      }
      const priority = computeCardPriority(stats)
      expect(priority).toBeLessThan(2)
    })

    it('should ensure minimum priority of 0.5', () => {
      const stats: QuizCardStats = {
        cardId: 'test',
        correctStreak: 100,
        incorrectCount: 0,
        lastSeen: new Date().toISOString(),
      }
      const priority = computeCardPriority(stats)
      expect(priority).toBeGreaterThanOrEqual(0.5)
    })
  })

  describe('chooseNextQuizCardIndex', () => {
    const mockCards: Flashcard[] = [
      { category: 'test', german: 'word1', english: 'translation1', image_url: '', image_local: '' },
      { category: 'test', german: 'word2', english: 'translation2', image_url: '', image_local: '' },
      { category: 'test', german: 'word3', english: 'translation3', image_url: '', image_local: '' },
    ]

    it('should return 0 for empty cards array', () => {
      const index = chooseNextQuizCardIndex([], {})
      expect(index).toBe(0)
    })

    it('should select a valid index for cards with no stats', () => {
      const index = chooseNextQuizCardIndex(mockCards, {})
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(mockCards.length)
    })

    it('should prefer cards with higher priority (more incorrect attempts)', () => {
      const stats: Record<string, QuizCardStats> = {
        [getCardId(mockCards[0])]: {
          cardId: getCardId(mockCards[0]),
          correctStreak: 0,
          incorrectCount: 5,
          lastSeen: new Date().toISOString(),
        },
        [getCardId(mockCards[1])]: {
          cardId: getCardId(mockCards[1]),
          correctStreak: 10,
          incorrectCount: 0,
          lastSeen: new Date().toISOString(),
        },
      }

      // Run multiple times to check weighted selection
      const indices = []
      for (let i = 0; i < 20; i++) {
        indices.push(chooseNextQuizCardIndex(mockCards, stats))
      }

      // Card 0 (high priority) should be selected more often than card 1 (low priority)
      const card0Count = indices.filter(i => i === 0).length
      const card1Count = indices.filter(i => i === 1).length
      expect(card0Count).toBeGreaterThan(card1Count)
    })
  })

  describe('resetQuizStatsForCategory', () => {
    it('should reset quiz stats for a specific category (v2 format)', () => {
      const category1 = 'category1'
      const category2 = 'category2'
      
      const stats: Record<string, QuizCardStats> = {
        [`${category1}::word1`]: {
          cardId: `${category1}::word1`,
          correctStreak: 1,
          incorrectCount: 0,
          lastSeen: new Date().toISOString(),
        },
        [`${category2}::word1`]: {
          cardId: `${category2}::word1`,
          correctStreak: 2,
          incorrectCount: 0,
          lastSeen: new Date().toISOString(),
        },
      }

      // Save stats using internal mechanism
      localStorage.setItem('motionEduApp_quizStats_v1', JSON.stringify(stats))
      
      resetQuizStatsForCategory(category1)
      
      const remaining = JSON.parse(localStorage.getItem('motionEduApp_quizStats_v1') || '{}')
      expect(remaining[`${category1}::word1`]).toBeUndefined()
      expect(remaining[`${category2}::word1`]).toBeDefined()
    })

    it('should reset quiz stats for a specific category (legacy format)', () => {
      const category1 = 'category1'
      const category2 = 'category2'
      
      updateQuizStat(`${category1}|word1`, 'correct')
      updateQuizStat(`${category2}|word1`, 'correct')
      
      expect(getQuizStat(`${category1}|word1`)).not.toBeNull()
      expect(getQuizStat(`${category2}|word1`)).not.toBeNull()
      
      resetQuizStatsForCategory(category1)
      
      expect(getQuizStat(`${category1}|word1`)).toBeNull()
      expect(getQuizStat(`${category2}|word1`)).not.toBeNull()
    })
  })

  describe('resetAllQuizStats', () => {
    it('should clear all quiz statistics', () => {
      updateQuizStat('category1|word1', 'correct')
      updateQuizStat('category2|word2', 'incorrect')
      
      const mockCard: Flashcard = {
        category: 'category3',
        german: 'word3',
        english: 'translation',
        image_url: '',
        image_local: '',
      }
      updateQuizStatsForAnswer({}, mockCard, true)
      
      expect(getQuizStat('category1|word1')).not.toBeNull()
      expect(localStorage.getItem('motionEduApp_quizStats_v1')).not.toBeNull()
      
      resetAllQuizStats()
      
      expect(getQuizStat('category1|word1')).toBeNull()
      expect(localStorage.getItem('quizStats')).toBeNull()
      expect(localStorage.getItem('motionEduApp_quizStats_v1')).toBeNull()
    })
  })
})

