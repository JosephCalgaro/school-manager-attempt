import { Router } from 'express'
import {
  createClass,
  getClasses,
  getClassById,
  updateClass,
  deleteClass
} from '../controllers/classController.js'

const router = Router()

router.get('/', getClasses)
router.get('/:id', getClassById)
router.post('/', createClass)
router.put('/:id', updateClass)
router.delete('/:id', deleteClass)

export default router
