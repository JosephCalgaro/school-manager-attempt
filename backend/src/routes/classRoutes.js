import { Router } from 'express'
import {
  createClass,
  getClasses,
  getClassById,
  updateClass,
  deleteClass,
  removeStudentFromClass
} from '../controllers/classController.js'

const router = Router()

router.get('/', getClasses)
router.get('/:id', getClassById)
router.post('/', createClass)
router.put('/:id', updateClass)
router.delete('/:id', deleteClass)
router.delete('/:id/students/:studentId', removeStudentFromClass)

export default router