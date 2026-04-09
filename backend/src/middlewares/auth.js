import { verifyToken } from '../controllers/authController.js'
import pool from '../database/connection.js'

// Cache de usuários desativados: userId → expiresAt (timestamp ms)
// TTL de 5 min — reduz queries ao DB sem deixar tokens válidos por 8h
const deactivatedCache = new Map()
const CACHE_TTL_MS = 5 * 60 * 1000

export function markDeactivated(userId) {
  deactivatedCache.set(userId, Date.now() + CACHE_TTL_MS)
}

async function isUserActive(userId, role) {
  // Checa cache primeiro
  const expires = deactivatedCache.get(userId)
  if (expires) {
    if (Date.now() < expires) return false   // ainda no TTL → inativo
    deactivatedCache.delete(userId)          // TTL expirado → re-checa DB
  }

  try {
    let row
    if (role === 'STUDENT') {
      const [[r]] = await pool.query('SELECT is_active FROM students WHERE id = ? LIMIT 1', [userId])
      row = r
    } else if (role === 'RESPONSIBLE') {
      const [[r]] = await pool.query('SELECT is_active FROM responsibles WHERE id = ? LIMIT 1', [userId])
      row = r
    } else {
      const [[r]] = await pool.query('SELECT is_active FROM users WHERE id = ? LIMIT 1', [userId])
      row = r
    }
    if (!row || !row.is_active) {
      deactivatedCache.set(userId, Date.now() + CACHE_TTL_MS)
      return false
    }
    return true
  } catch (err) {
    console.error('Erro ao verificar status do usuário:', err)
    return true  // em caso de falha no DB, deixa passar (fail-open)
  }
}

export async function authenticate(req, res, next) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).end()
  const token = auth.slice(7)
  try {
    const payload = verifyToken(token)
    req.userId   = payload.sub
    req.userRole = payload.role
    req.schoolId = payload.school_id
    if (!req.schoolId && req.userRole !== 'SAAS_OWNER') {
      return res.status(401).json({ error: 'Token inválido: school_id ausente' })
    }
    req.isTemp   = payload.is_temp   ?? false
    req.saasName = payload.saas_name ?? null

    // Tokens temporários (SaaS impersonando escola) não checam is_active no DB
    if (!req.isTemp) {
      const active = await isUserActive(req.userId, req.userRole)
      if (!active) return res.status(403).json({ error: 'Usuário inativo' })
    }

    next()
  } catch (err) {
    console.error('Erro na autenticação:', err)
    return res.status(401).json({ error: 'Token inválido' })
  }
}