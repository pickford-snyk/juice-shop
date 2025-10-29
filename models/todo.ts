import { DataTypes, Model, Optional } from 'sequelize'
import { sequelize } from '../data/sequelize'

interface TodoAttributes {
  id: number
  title: string
  completed: boolean
}

interface TodoCreationAttributes extends Optional<TodoAttributes, 'id'> {}

class Todo extends Model<TodoAttributes, TodoCreationAttributes> implements TodoAttributes {
  id!: number
  title!: string
  completed!: boolean
}

Todo.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    completed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  },
  {
    sequelize,
    tableName: 'Todos'
  }
)

export { Todo, TodoAttributes, TodoCreationAttributes }
