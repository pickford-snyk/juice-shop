/*
 * Copyright (c) 2014-2022 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

/* jslint node: true */

module.exports = (sequelize, { INTEGER, DECIMAL, DATE, STRING }) => {
  const ProductAnalytics = sequelize.define('ProductAnalytics', {
    productId: {
      type: INTEGER,
      allowNull: false,
      unique: true
    },
    totalReviews: {
      type: INTEGER,
      defaultValue: 0
    },
    averageRating: {
      type: DECIMAL(3, 2),
      defaultValue: 0.00
    },
    totalLikes: {
      type: INTEGER,
      defaultValue: 0
    },
    totalViews: {
      type: INTEGER,
      defaultValue: 0
    },
    reviewSentimentScore: {
      type: DECIMAL(5, 2),
      defaultValue: 0.00,
      comment: 'Positive values indicate positive sentiment, negative values indicate negative sentiment'
    },
    topKeywords: {
      type: STRING,
      defaultValue: '[]',
      comment: 'JSON array of top keywords from reviews'
    },
    lastAnalyzed: {
      type: DATE,
      defaultValue: DATE.NOW
    }
  }, { 
    paranoid: true,
    indexes: [
      {
        fields: ['productId']
      },
      {
        fields: ['averageRating']
      },
      {
        fields: ['totalReviews']
      }
    ]
  })

  ProductAnalytics.associate = ({ Product }) => {
    ProductAnalytics.belongsTo(Product, { foreignKey: 'productId' })
    Product.hasOne(ProductAnalytics, { foreignKey: 'productId' })
  }

  return ProductAnalytics
}

