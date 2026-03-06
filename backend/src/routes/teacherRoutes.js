import { Router } from 'express'
import {
  createClassAssignment,
  deleteClassAssignment,
  getTeacherClassById,
  getTeacherClasses,
  getTeacherClassStudents,
  getTeacherStats,
  isTeacher,
  registerClassAttendance,
  upsertAssignmentCompletions,
  updateClassAssignment,
  upsertClassGrade,
  upsertStudentNotes
} from '../controllers/teacherController.js'

const router = Router()

router.use(isTeacher)

router.get('/stats', getTeacherStats)
router.get('/classes', getTeacherClasses)
router.get('/classes/:id', getTeacherClassById)
router.get('/classes/:id/students', getTeacherClassStudents)
router.post('/classes/:id/attendance', registerClassAttendance)
router.post('/classes/:id/grades', upsertClassGrade)
router.post('/classes/:id/notes', upsertStudentNotes)
router.post('/classes/:id/assignments', createClassAssignment)
router.put('/classes/:id/assignments/:assignmentId', updateClassAssignment)
router.post('/classes/:id/assignments/:assignmentId/completions', upsertAssignmentCompletions)
router.delete('/classes/:id/assignments/:assignmentId', deleteClassAssignment)

export default router
