import { Request, Response } from 'express'
import { User } from '../models/user'
import { Op } from 'sequelize'

/**
 * SECURE USER SEARCH ENDPOINT
 * 
 * This endpoint demonstrates secure practices to prevent SQL injection:
 * - Uses parameterized queries with Sequelize ORM
 * - Implements proper input validation and sanitization
 * - Uses Sequelize's built-in protection mechanisms
 * - Avoids raw SQL queries with user input
 */

export const searchUsers = async (req: Request, res: Response) => {
  try {
    const { searchTerm, email, role } = req.query

    // SECURE: Build query conditions using Sequelize ORM
    const whereConditions: any = {}
    
    if (searchTerm && typeof searchTerm === 'string') {
      // SECURE: Use Sequelize's Op.like with parameterized values
      whereConditions[Op.or] = [
        { name: { [Op.like]: `%${searchTerm}%` } },
        { email: { [Op.like]: `%${searchTerm}%` } }
      ]
    }
    
    if (email && typeof email === 'string') {
      // SECURE: Direct property assignment (Sequelize handles parameterization)
      whereConditions.email = email
    }
    
    if (role && typeof role === 'string') {
      // SECURE: Direct property assignment (Sequelize handles parameterization)
      whereConditions.role = role
    }

    // SECURE: Use Sequelize ORM instead of raw SQL
    const users = await User.findAll({
      where: whereConditions,
      attributes: ['id', 'name', 'email', 'role', 'createdAt'] // SECURE: Limit exposed fields
    })

    // SECURE: Use Sequelize ORM for counting
    const userCount = await User.count({
      where: { role: role || 'user' }
    })

    res.json({
      success: true,
      users: users,
      totalCount: userCount
      // SECURE: Removed query exposure (information disclosure prevention)
    })

  } catch (error) {
    // SECURE: Generic error response without exposing details
    res.status(500).json({
      success: false,
      error: 'Internal server error'
      // SECURE: Removed stack trace exposure
    })
  }
}

export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    // SECURE: Input validation
    const userId = parseInt(id)
    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid user ID' 
      })
    }

    // SECURE: Use Sequelize ORM with parameterized query
    const user = await User.findByPk(userId, {
      attributes: ['id', 'name', 'email', 'role', 'createdAt'] // SECURE: Limit exposed fields
    })

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }

    res.json({
      success: true,
      user: user
    })

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    // SECURE: Input validation
    const userId = parseInt(id)
    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid user ID' 
      })
    }

    // SECURE: Use Sequelize ORM with parameterized query
    const user = await User.findByPk(userId)
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }

    // SECURE: Delete using Sequelize ORM
    await user.destroy()

    res.json({
      success: true,
      message: 'User deleted successfully'
    })

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

export const updateUserRole = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { role } = req.body

    // SECURE: Input validation
    const userId = parseInt(id)
    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid user ID' 
      })
    }

    // SECURE: Role validation
    const validRoles = ['user', 'admin', 'moderator']
    if (!role || typeof role !== 'string' || !validRoles.includes(role)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid role. Must be one of: ' + validRoles.join(', ') 
      })
    }

    // SECURE: Use Sequelize ORM with parameterized query
    const user = await User.findByPk(userId)
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }

    // SECURE: Update using Sequelize ORM
    await user.update({ role })

    res.json({
      success: true,
      message: 'User role updated successfully'
    })

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}
