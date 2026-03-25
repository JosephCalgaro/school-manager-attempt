import pool from '../database/connection.js'
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

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET)
}

// POST /auth/login
// Verifica primeiro na tabela users (admin/teacher/secretary),
// depois na tabela students — tudo em uma única requisição.
export async function login(req, res) {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' })
  }

  try {
    // 1. Tenta usuário comum
    const [userRows] = await pool.query(
      'SELECT id, full_name, email, password_hash, role, is_active, school_id FROM users WHERE email = ?',
      [email]
    )

    if (userRows.length > 0) {
      const user = userRows[0]

      if (!user.is_active) {
        recordFailedLogin(getIp(req))
        return res.status(403).json({ error: 'Usuário inativo' })
      }

      const match = await bcrypt.compare(password, user.password_hash)
      if (!match) {
        recordFailedLogin(getIp(req))
        return res.status(401).json({ error: 'Credenciais inválidas' })
      }

      clearLoginAttempts(getIp(req))
      const token = signToken(user)
      delete user.password_hash
      return res.json({ user, token })
    }

    // 2. Tenta aluno
    const [studentRows] = await pool.query(
      'SELECT id, full_name, email, password_hash, school_id FROM students WHERE email = ?',
      [email]
    )

    if (studentRows.length > 0) {
      const student = studentRows[0]
      if (!student.password_hash) {
        recordFailedLogin(getIp(req))
        return res.status(403).json({ error: 'Acesso não configurado. Contate a secretaria.' })
      }
      const match = await bcrypt.compare(password, student.password_hash)
      if (!match) {
        recordFailedLogin(getIp(req))
        return res.status(401).json({ error: 'Credenciais inválidas' })
      }
      clearLoginAttempts(getIp(req))
      const token = signToken({ id: student.id, role: 'STUDENT' })
      delete student.password_hash
      return res.json({ user: { ...student, role: 'STUDENT' }, token })
    }

    // 3. Tenta responsável
    const [respRows] = await pool.query(
      'SELECT id, full_name, email, password_hash, school_id FROM responsibles WHERE email = ?',
      [email]
    )

    if (respRows.length > 0) {
      const resp = respRows[0]
      if (!resp.password_hash) {
        recordFailedLogin(getIp(req))
        return res.status(403).json({ error: 'Senha não configurada. Contate a secretaria para definir sua senha.' })
      }
      const match = await bcrypt.compare(password, resp.password_hash)
      if (!match) {
        recordFailedLogin(getIp(req))
        return res.status(401).json({ error: 'Credenciais inválidas' })
      }
      clearLoginAttempts(getIp(req))
      const token = signToken({ id: resp.id, role: 'RESPONSIBLE' })
      delete resp.password_hash
      return res.json({ user: { ...resp, role: 'RESPONSIBLE' }, token })
    }

    recordFailedLogin(getIp(req))
    return res.status(401).json({ error: 'Email não encontrado. Verifique suas credenciais.' })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao realizar login' })
  }
}

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