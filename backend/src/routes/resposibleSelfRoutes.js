import express from 'express'
import { authenticate } from '../middlewares/auth.js'
import {
  isResponsible,
  getMyProfile,
  getMyStudents,
  getMyStudentClasses,
  getMyStudentClassDetails,
  getMyStudentAssignments,
  getMyProfileWithStudent
} from '../controllers/responsibleSelfController.js'

const router = express.Router()

// Todas as rotas exigem login + role RESPONSIBLE
router.use(authenticate, isResponsible)

router.get('/profile',              getMyProfile)
router.get('/profile-with-student', getMyProfileWithStudent)
router.get('/students',             getMyStudents)
router.get('/classes',              getMyStudentClasses)
router.get('/classes/:classId',     getMyStudentClassDetails)
router.get('/assignments',          getMyStudentAssignments)

export default router