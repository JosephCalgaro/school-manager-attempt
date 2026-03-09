import { Router } from 'express'
import {
  createClassAssignment,
  deleteClassAssignment,
  getTeacherClassById,
  getTeacherClasses,
  getTeacherClassStudents,
  getTeacherStats,
  getTeacherStudents,
  isTeacher,
  registerClassAttendance,
  upsertAssignmentCompletions,
  updateClassAssignment,
  upsertClassGrade,
  upsertStudentNotes,
  getMyTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getLessonPlans,
  createLessonPlan,
  updateLessonPlan,
  deleteLessonPlan,
} from '../controllers/teacherController.js'

const router = Router()
router.use(isTeacher)

router.get('/stats',     getTeacherStats)
router.get('/students',  getTeacherStudents)
router.get('/classes',   getTeacherClasses)
router.get('/classes/:id',          getTeacherClassById)
router.get('/classes/:id/students', getTeacherClassStudents)
router.post('/classes/:id/attendance',                            registerClassAttendance)
router.post('/classes/:id/grades',                                upsertClassGrade)
router.post('/classes/:id/notes',                                 upsertStudentNotes)
router.post('/classes/:id/assignments',                           createClassAssignment)
router.put('/classes/:id/assignments/:assignmentId',              updateClassAssignment)
router.post('/classes/:id/assignments/:assignmentId/completions', upsertAssignmentCompletions)
router.delete('/classes/:id/assignments/:assignmentId',           deleteClassAssignment)

// Biblioteca de templates
router.get('/lesson-plans',               getMyTemplates)
router.post('/lesson-plans',              createTemplate)
router.put('/lesson-plans/:templateId',   updateTemplate)
router.delete('/lesson-plans/:templateId',deleteTemplate)

// Vínculos por turma
router.get('/classes/:id/lesson-plans',            getLessonPlans)
router.post('/classes/:id/lesson-plans',           createLessonPlan)
router.put('/classes/:id/lesson-plans/:planId',    updateLessonPlan)
router.delete('/classes/:id/lesson-plans/:planId', deleteLessonPlan)

export default router
