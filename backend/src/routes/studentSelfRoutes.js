import express from 'express'
import { authenticate } from '../middlewares/auth.js'
import {
  isStudent,
  getMyProfile,
  getMyClasses,
  getMyClassDetails,
  getMyAssignments
} from '../controllers/studentSelfController.js'

const router = express.Router()

// Todas as rotas exigem login + role STUDENT
router.use(authenticate, isStudent)

router.get('/profile',              getMyProfile)
router.get('/classes',              getMyClasses)
router.get('/classes/:classId',     getMyClassDetails)
router.get('/assignments',          getMyAssignments)

export default router
