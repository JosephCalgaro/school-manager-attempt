import {Router} from 'express'
import {
  createAssignment,
  getAssignments,
  getAssignmentById,
  updateAssignment,
  deleteAssignment
} from '../controllers/assignmentController.js'

const router = Router()

router.get('/', getAssignments)
router.get('/:id', getAssignmentById)
router.post('/', createAssignment)
router.put('/:id', updateAssignment)
router.delete('/:id', deleteAssignment)

export default router