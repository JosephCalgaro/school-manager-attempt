import express from 'express'
import { login, getProfile, logout } from '../controllers/authController.js'
import { authenticate } from '../middlewares/auth.js'
import { loginRateLimiter } from '../middlewares/rateLimiter.js'

const router = express.Router()

router.post('/login', loginRateLimiter, login)
router.get('/profile', authenticate, getProfile)
router.post('/logout', authenticate, logout)

export default router