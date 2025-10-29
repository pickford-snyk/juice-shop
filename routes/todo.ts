import { Request, Response } from 'express'
import { Todo } from '../models/todo'

export const getTodos = async (req: Request, res: Response): Promise<void> => {
  try {
    const todos = await Todo.findAll()
    res.status(200).json({ status: 'success', data: todos })
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message })
  }
}

export const createTodo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title } = req.body
    if (!title) {
      res.status(400).json({ status: 'error', message: 'Title is required' })
      return
    }
    const todo = await Todo.create({ title })
    res.status(201).json({ status: 'success', data: todo })
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message })
  }
}

export const updateTodo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { title, completed } = req.body
    const todo = await Todo.findByPk(id)
    if (!todo) {
      res.status(404).json({ status: 'error', message: 'Todo not found' })
      return
    }
    todo.title = title ?? todo.title
    todo.completed = completed ?? todo.completed
    await todo.save()
    res.status(200).json({ status: 'success', data: todo })
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message })
  }
}

export const deleteTodo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const todo = await Todo.findByPk(id)
    if (!todo) {
      res.status(404).json({ status: 'error', message: 'Todo not found' })
      return
    }
    await todo.destroy()
    res.status(200).json({ status: 'success', message: 'Todo deleted successfully' })
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message })
  }
}
