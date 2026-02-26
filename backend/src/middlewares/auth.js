import { verifyToken } from '../controllers/authController.js'

export function authenticate(req, res, next) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).end()
  const token = auth.slice(7)
  try {
    const payload = verifyToken(token)
    req.userId = payload.sub
    req.userRole = payload.role
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido' })
  }
}