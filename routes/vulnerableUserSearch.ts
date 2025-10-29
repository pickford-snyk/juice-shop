import { Request, Response } from 'express'
import { User } from '../models/user'
import { Op } from 'sequelize'

/**
 * VULNERABLE USER SEARCH ENDPOINT
 * 
 * This endpoint contains a high severity SQL injection vulnerability.
 * The user input is directly concatenated into the SQL query without
 * any sanitization or parameterization.
 * 
 * SECURITY ISSUE: SQL Injection (High Severity)
 * - User input is directly interpolated into SQL queries
 * - No input validation or sanitization
 * - Allows arbitrary SQL execution
 * - Can lead to data exfiltration, data manipulation, or system compromise
 */

export const searchUsers = async (req: Request, res: Response) => {
  try {
    const { searchTerm, email, role } = req.query

    // VULNERABLE CODE: Direct string concatenation in SQL query
    // This allows SQL injection attacks
    let query = 'SELECT * FROM Users WHERE 1=1'
    
    if (searchTerm) {
      // VULNERABLE: Direct string interpolation - SQL Injection possible
      query += ` AND (name LIKE '%${searchTerm}%' OR email LIKE '%${searchTerm}%')`
    }
    
    if (email) {
      // VULNERABLE: Direct string interpolation - SQL Injection possible
      query += ` AND email = '${email}'`
    }
    
    if (role) {
      // VULNERABLE: Direct string interpolation - SQL Injection possible
      query += ` AND role = '${role}'`
    }

    // VULNERABLE: Executing raw SQL with user input
    const users = await User.sequelize?.query(query, {
      type: 'SELECT'
    })

    // VULNERABLE: Additional dangerous query with user input
    const userCount = await User.sequelize?.query(
      `SELECT COUNT(*) as count FROM Users WHERE role = '${role || 'user'}'`,
      { type: 'SELECT' }
    )

    res.json({
      success: true,
      users: users?.[0] || [],
      totalCount: userCount?.[0]?.[0]?.count || 0,
      query: query // VULNERABLE: Exposing the query in response (information disclosure)
    })

  } catch (error) {
    // VULNERABLE: Exposing detailed error information
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined // VULNERABLE: Stack trace exposure
    })
  }
}

export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    // VULNERABLE: Direct string interpolation in SQL query
    const query = `SELECT * FROM Users WHERE id = ${id}`
    
    const user = await User.sequelize?.query(query, {
      type: 'SELECT'
    })

    if (!user?.[0]?.[0]) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }

    res.json({
      success: true,
      user: user[0][0]
    })

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    // VULNERABLE: Direct string interpolation in DELETE query
    // This allows for dangerous operations like: DELETE FROM Users WHERE id = 1 OR 1=1
    const query = `DELETE FROM Users WHERE id = ${id}`
    
    const result = await User.sequelize?.query(query, {
      type: 'DELETE'
    })

    res.json({
      success: true,
      message: 'User deleted successfully',
      affectedRows: result?.[1] || 0
    })

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export const updateUserRole = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { role } = req.body

    // VULNERABLE: Direct string interpolation in UPDATE query
    // This allows for dangerous operations like: UPDATE Users SET role = 'admin' WHERE id = 1 OR 1=1
    const query = `UPDATE Users SET role = '${role}' WHERE id = ${id}`
    
    const result = await User.sequelize?.query(query, {
      type: 'UPDATE'
    })

    res.json({
      success: true,
      message: 'User role updated successfully',
      affectedRows: result?.[1] || 0
    })

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
