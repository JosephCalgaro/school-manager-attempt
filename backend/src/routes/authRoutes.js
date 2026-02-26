import express from 'express'
import { login, getProfile } from '../controllers/authController.js'
import { authenticate } from '../middlewares/auth.js'

const router = express.Router()

router.post('/login', login)
router.get('/profile', authenticate, getProfile)

export default router