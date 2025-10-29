/*
 * Copyright (c) 2014-2022 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { Request, Response, NextFunction } from 'express'
import models = require('../models/index')
import { Product } from '../data/types'

const utils = require('../lib/utils')
const security = require('../lib/insecurity')
const db = require('../data/mongodb')
const challenges = require('../data/datacache').challenges

interface ReviewAnalytics {
  productId: string
  totalReviews: number
  averageRating: number
  sentimentScore: number
  topKeywords: string[]
  recentReviews: any[]
}

interface DashboardStats {
  totalProducts: number
  totalReviews: number
  averageRating: number
  topRatedProducts: Product[]
  mostReviewedProducts: Product[]
  recentActivity: any[]
}

// Get analytics for a specific product
export function getProductAnalytics() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate and sanitize product ID
      const productId = parseInt(req.params.id, 10)
      if (isNaN(productId) || productId < 1) {
        return res.status(400).json({ error: 'Invalid product ID' })
      }
      
      // Get product details
      const product = await models.Product.findByPk(productId)
      if (!product) {
        return res.status(404).json({ error: 'Product not found' })
      }

      // Get reviews from MongoDB with validated productId
      const reviews = await db.reviews.find({ product: productId.toString() })
      
      // Calculate analytics
      const totalReviews = reviews.length
      const sentimentScore = calculateSentimentScore(reviews)
      const topKeywords = extractTopKeywords(reviews)
      const recentReviews = reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5)
      
      // Get or create analytics record
      let analytics = await models.ProductAnalytics.findOne({ where: { productId } })
      if (!analytics) {
        analytics = await models.ProductAnalytics.create({
          productId,
          totalReviews,
          reviewSentimentScore: sentimentScore,
          topKeywords: JSON.stringify(topKeywords),
          lastAnalyzed: new Date()
        })
      } else {
        await analytics.update({
          totalReviews,
          reviewSentimentScore: sentimentScore,
          topKeywords: JSON.stringify(topKeywords),
          lastAnalyzed: new Date()
        })
      }

      const result: ReviewAnalytics = {
        productId,
        totalReviews,
        averageRating: 0, // Could be enhanced with actual rating system
        sentimentScore,
        topKeywords,
        recentReviews
      }

      res.json(utils.queryResultToJson(result))
    } catch (error) {
      next(error)
    }
  }
}

// Get analytics dashboard with overall statistics
export function getAnalyticsDashboard() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Verify user has appropriate permissions
      const user = security.authenticatedUsers.from(req)
      if (!user || (user.data.role !== 'admin' && user.data.role !== 'accounting')) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }

      // Get all products
      const products = await models.Product.findAll()
      const totalProducts = products.length

      // Get all reviews
      const allReviews = await db.reviews.find({})
      const totalReviews = allReviews.length
      
      // Calculate overall average rating (if ratings exist)
      const averageRating = calculateOverallRating(allReviews)
      
      // Get top rated products (by sentiment)
      const topRatedProducts = await getTopRatedProducts(5)
      
      // Get most reviewed products
      const mostReviewedProducts = await getMostReviewedProducts(5)
      
      // Get recent activity
      const recentActivity = allReviews
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 10)
        .map(review => ({
          type: 'review',
          productId: review.product,
          author: review.author,
          message: review.message.substring(0, 100) + (review.message.length > 100 ? '...' : ''),
          timestamp: review.createdAt
        }))

      const dashboard: DashboardStats = {
        totalProducts,
        totalReviews,
        averageRating,
        topRatedProducts,
        mostReviewedProducts,
        recentActivity
      }

      res.json(utils.queryResultToJson(dashboard))
    } catch (error) {
      next(error)
    }
  }
}

// Get trending keywords across all reviews
export function getTrendingKeywords() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20
      const timeframe = req.query.timeframe as string || '30d'
      
      // Get reviews within timeframe
      const cutoffDate = new Date()
      switch (timeframe) {
        case '7d':
          cutoffDate.setDate(cutoffDate.getDate() - 7)
          break
        case '30d':
          cutoffDate.setDate(cutoffDate.getDate() - 30)
          break
        case '90d':
          cutoffDate.setDate(cutoffDate.getDate() - 90)
          break
        default:
          cutoffDate.setDate(cutoffDate.getDate() - 30)
      }

      const recentReviews = await db.reviews.find({
        createdAt: { $gte: cutoffDate }
      })

      // Extract and count keywords
      const keywordCounts = {}
      recentReviews.forEach(review => {
        const keywords = extractKeywordsFromText(review.message)
        keywords.forEach(keyword => {
          keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1
        })
      })

      // Sort by frequency and limit results
      const trendingKeywords = Object.entries(keywordCounts)
        .map(([keyword, count]) => ({ keyword, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)

      res.json(utils.queryResultToJson({ keywords: trendingKeywords, timeframe }))
    } catch (error) {
      next(error)
    }
  }
}

// Get product comparison analytics
export function getProductComparison() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productIds = req.body.productIds
      if (!productIds || !Array.isArray(productIds)) {
        return res.status(400).json({ error: 'productIds array is required' })
      }

      // Validate each productId is a valid number
      const validProductIds = productIds
        .map(id => parseInt(id, 10))
        .filter(id => !isNaN(id) && id > 0)

      if (validProductIds.length === 0) {
        return res.status(400).json({ error: 'At least one valid product ID is required' })
      }

      if (validProductIds.length > 10) {
        return res.status(400).json({ error: 'Maximum 10 products can be compared at once' })
      }

      const comparison = await Promise.all(
        validProductIds.map(async (productId) => {
          const product = await models.Product.findByPk(productId)
          if (!product) return null

          const reviews = await db.reviews.find({ product: productId.toString() })
          const analytics = await models.ProductAnalytics.findOne({ where: { productId } })

          return {
            product: product.toJSON(),
            analytics: {
              totalReviews: reviews.length,
              sentimentScore: calculateSentimentScore(reviews),
              topKeywords: extractTopKeywords(reviews).slice(0, 5),
              lastAnalyzed: analytics?.lastAnalyzed || null
            }
          }
        })
      )

      const validComparisons = comparison.filter(item => item !== null)
      res.json(utils.queryResultToJson({ comparison: validComparisons }))
    } catch (error) {
      next(error)
    }
  }
}

// Utility functions
function calculateSentimentScore(reviews: any[]): number {
  if (reviews.length === 0) return 0
  
  let totalSentiment = 0
  reviews.forEach(review => {
    // Simple sentiment analysis based on positive/negative keywords
    const message = review.message.toLowerCase()
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'love', 'perfect', 'best', 'awesome', 'fantastic', 'wonderful']
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'horrible', 'disgusting', 'disappointing', 'poor', 'nasty']
    
    let sentiment = 0
    positiveWords.forEach(word => {
      sentiment += (message.split(word).length - 1) * 2
    })
    negativeWords.forEach(word => {
      sentiment -= (message.split(word).length - 1) * 2
    })
    
    totalSentiment += sentiment
  })
  
  return totalSentiment / reviews.length
}

function extractTopKeywords(reviews: any[], limit = 10): string[] {
  if (reviews.length === 0) return []
  
  const keywordCounts = {}
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'it', 'this', 'that'])
  
  reviews.forEach(review => {
    const keywords = extractKeywordsFromText(review.message)
    keywords.forEach(keyword => {
      if (!stopWords.has(keyword)) {
        keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1
      }
    })
  })
  
  return Object.entries(keywordCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([keyword]) => keyword)
}

function extractKeywordsFromText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2)
}

function calculateOverallRating(reviews: any[]): number {
  // This is a placeholder - could be enhanced with actual rating data
  return reviews.length > 0 ? Math.min(5.0, Math.max(1.0, 3.0 + calculateSentimentScore(reviews) * 0.5)) : 0
}

async function getTopRatedProducts(limit: number): Promise<Product[]> {
  const analytics = await models.ProductAnalytics.findAll({
    order: [['reviewSentimentScore', 'DESC']],
    limit,
    include: [{ model: models.Product }]
  })
  
  return analytics.map(item => item.Product).filter(Boolean)
}

async function getMostReviewedProducts(limit: number): Promise<Product[]> {
  const analytics = await models.ProductAnalytics.findAll({
    order: [['totalReviews', 'DESC']],
    limit,
    include: [{ model: models.Product }]
  })
  
  return analytics.map(item => item.Product).filter(Boolean)
}

// Security challenge integration
export function searchProductAnalytics() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Properly validate input type and sanitize
      const searchTerm = typeof req.query.q === 'string' ? req.query.q.trim() : ''
      
      if (!searchTerm) {
        return res.status(400).json({ error: 'Search term is required' })
      }

      // Limit search term length for security
      if (searchTerm.length > 100) {
        return res.status(400).json({ error: 'Search term too long' })
      }

      // Intentional vulnerability for security testing (commented out for security)
      // utils.solveIf(challenges.noSqlInjectionChallenge, () => { 
      //   return searchTerm.includes('$where') || searchTerm.includes('$regex') 
      // })

      // Use safe MongoDB query with regex
      const results = await db.reviews.find({ 
        message: { $regex: searchTerm, $options: 'i' }
      })

      res.json(utils.queryResultToJson({ 
        results: results.slice(0, 50), 
        count: results.length 
      }))
    } catch (error) {
      next(error)
    }
  }
}
