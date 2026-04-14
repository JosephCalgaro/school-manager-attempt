import pool from '../database/connection.js'
/**
 * Common locals used across controllers:
 * - sid: school id for the current request (from `req.schoolId`)
 * - req.userId: id of the authenticated user
 * - req.userRole / req.isTemp: auth metadata
 * - t: short name for wildcard search values (`%term%`) when used
 * - countQ / query: SQL query strings (countQ typically holds COUNT(*) SQL)
 * - params: array of SQL parameter values
 * - conn: DB connection from `pool.getConnection()` when using transactions
 */
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { recordFailedLogin, clearLoginAttempts } from '../middlewares/rateLimiter.js'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) throw new Error('JWT_SECRET não definido no .env — servidor não pode iniciar com segurança.')
const TOKEN_EXPIRES_IN = process.env.TOKEN_EXPIRES_IN || '8h'

function getIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim()
    || req.socket?.remoteAddress
    || 'unknown'
}

export function signToken(user) {
  return jwt.sign(
    {
      sub:       user.id,
      role:      user.role,
      school_id: user.school_id ?? 1,
      is_temp:   user.is_temp   ?? false,
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRES_IN }
  )
}

/**
 * signToken - gera um JWT para o usuário
 *
 * @param {Object} user - objeto de usuário (deve conter `id`, `role`, `school_id`, `is_temp`)
 * @returns {string} token JWT assinado
 *
 * Locals:
 * - sub: usuário `id` (sub claim)
 * - role: função do usuário
 * - school_id: id da escola atribuída ao token
 * - is_temp: flag de token temporário (impersonation)
 */

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET)
}

/**
 * verifyToken - valida e decodifica um JWT
 *
 * @param {string} token - token JWT
 * @returns {Object} payload decodificado
 *
 * Locals:
 * - token: JWT recebido
 */

// POST /auth/login
// Busca email em users/students/responsibles com uma unica query (UNION ALL)
// para evitar timing side-channel e reduzir latencia.
export async function login(req, res) {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' })
  }

  try {
    // Busca unificada nas 3 tabelas — 1 round trip em vez de 3
    const [rows] = await pool.query(
      `SELECT id, full_name, email, password_hash, role, is_active, school_id, 'USER' AS source
       FROM users WHERE email = ?
       UNION ALL
       SELECT id, full_name, email, password_hash, 'STUDENT' AS role, is_active, school_id, 'STUDENT' AS source
       FROM students WHERE email = ?
       UNION ALL
       SELECT id, full_name, email, password_hash, 'RESPONSIBLE' AS role, is_active, school_id, 'RESPONSIBLE' AS source
       FROM responsibles WHERE email = ?`,
      [email, email, email]
    )

    if (rows.length === 0) {
      // Dummy compare para evitar timing side-channel
      // bcrypt sempre roda, mesmo para emails inexistentes
      await bcrypt.compare(password, '$2a$10$dummyhashforconstanttime')
      recordFailedLogin(getIp(req))
      return res.status(401).json({ error: 'Credenciais inválidas' })
    }

    const account = rows[0]

    if (!account.is_active) {
      recordFailedLogin(getIp(req))
      return res.status(403).json({ error: 'Credenciais inválidas' })
    }

    if (!account.password_hash) {
      recordFailedLogin(getIp(req))
      return res.status(403).json({ error: 'Credenciais inválidas' })
    }

    const match = await bcrypt.compare(password, account.password_hash)
    if (!match) {
      recordFailedLogin(getIp(req))
      return res.status(401).json({ error: 'Credenciais inválidas' })
    }

    clearLoginAttempts(getIp(req))

    const payload = {
      sub:       account.id,
      role:      account.role,
      school_id: account.school_id,
    }
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRES_IN })

    delete account.password_hash
    delete account.source

    return res.json({ user: account, token })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao realizar login' })
  }
}

/**
 * login - endpoint de autenticação. tenta nas tabelas `users`, `students` e `responsibles` em ordem.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 *
 * Locals:
 * - email, password: credenciais recebidas via `req.body`
 * - userRows, user: resultado da busca na tabela `users`
 * - match: resultado do `bcrypt.compare`
 * - token: JWT gerado por `signToken`
 * - studentRows, student: resultado da busca na tabela `students`
 * - respRows, resp: resultado da busca na tabela `responsibles`
 * - getIp(req): helper para obter IP do cliente
 */

// GET /auth/profile
// Retorna dados completos do usuário logado, independente da tabela de origem.
export async function getProfile(req, res) {
  const role = (req.userRole || '').toUpperCase()

  try {
    // ── Token temporário (SaaS impersonando escola) ───────────────────────────
    // Não existe row no banco para este token — retorna dados sintéticos
    if (req.isTemp) {
      const [[school]] = await pool.query(
        'SELECT id, name FROM schools WHERE id = ? LIMIT 1', [req.schoolId]
      )
      return res.json({
        id:          req.userId,
        full_name:   req.saasName ?? 'SaaS Owner',
        email:       '',
        role:        'ADMIN',
        school_id:   req.schoolId,
        school_name: school?.name ?? '',
        is_temp:     true,
      })
    }
    if (role === 'STUDENT') {
      const [rows] = await pool.query(
        `SELECT s.id, s.full_name, s.email, s.phone, s.cpf, s.rg,
                s.birth_date, s.address, s.due_day,
                'STUDENT' AS role,
                r.full_name AS responsible_name,
                r.email     AS responsible_email,
                r.phone     AS responsible_phone
         FROM students s
         LEFT JOIN responsibles r ON s.responsible_id = r.id
         WHERE s.id = ?`,
        [req.userId]
      )
      if (rows.length === 0) return res.status(404).json({ error: 'Aluno não encontrado' })
      return res.json(rows[0])
    }

    // Responsável
    if (role === 'RESPONSIBLE') {
      const [rows] = await pool.query(
        `SELECT r.id, r.full_name, r.email, r.phone, r.cpf, r.rg,
                r.birth_date, r.address,
                'RESPONSIBLE' AS role,
                s.id         AS student_id,
                s.full_name  AS student_name,
                s.email      AS student_email
         FROM responsibles r
         LEFT JOIN students s ON s.responsible_id = r.id
         WHERE r.id = ?`,
        [req.userId]
      )
      if (rows.length === 0) return res.status(404).json({ error: 'Responsável não encontrado' })
      return res.json(rows[0])
    }

    // Usuários do sistema (ADMIN / TEACHER / SECRETARY / SAAS_OWNER)
    const [rows] = await pool.query(
      `SELECT id, full_name, email, phone, cpf, rg,
              birth_date, role, school_id, created_at
       FROM users WHERE id = ? AND is_active = 1`,
      [req.userId]
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' })

    const user = rows[0]

    // Para professores: inclui lista de turmas
    if (role === 'TEACHER') {
      const [classes] = await pool.query(
        `SELECT c.id, c.name, c.schedule, c.classroom,
                COUNT(cs.student_id) AS totalStudents
         FROM classes c
         LEFT JOIN class_students cs ON cs.class_id = c.id
         WHERE c.teacher_id = ? AND c.is_active = 1
         GROUP BY c.id
         ORDER BY c.name`,
        [req.userId]
      )
      user.classes = classes
    }

    res.json(user)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao buscar perfil' })
  }
}

/**
 * getProfile - retorna o perfil completo do usuário logado, consultando a tabela apropriada
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 *
 * Locals:
 * - role: papel do usuário extraído de `req.userRole`
 * - school: (para tokens temporários) row da tabela `schools`
 * - rows/user: resultado(s) das queries dependendo do papel
 * - classes: lista de turmas para professores
 */