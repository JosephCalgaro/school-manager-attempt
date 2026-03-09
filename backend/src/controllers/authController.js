import pool from '../database/connection.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'secret123'
const TOKEN_EXPIRES_IN = '10h'

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, {
    expiresIn: TOKEN_EXPIRES_IN
  })
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
      'SELECT id, full_name AS fullName, email, password_hash, role, is_active FROM users WHERE email = ?',
      [email]
    )

    if (userRows.length > 0) {
      const user = userRows[0]

      if (!user.is_active) {
        return res.status(403).json({ error: 'Usuário inativo' })
      }

      const match = await bcrypt.compare(password, user.password_hash)
      if (!match) {
        return res.status(401).json({ error: 'Credenciais inválidas' })
      }

      const token = signToken(user)
      delete user.password_hash
      return res.json({ user, token })
    }

    // 2. Tenta aluno
    const [studentRows] = await pool.query(
      'SELECT id, full_name AS fullName, email, password_hash FROM students WHERE email = ?',
      [email]
    )

    if (studentRows.length > 0) {
      const student = studentRows[0]
      if (!student.password_hash) {
        return res.status(403).json({ error: 'Acesso não configurado. Contate a secretaria.' })
      }
      const match = await bcrypt.compare(password, student.password_hash)
      if (!match) return res.status(401).json({ error: 'Credenciais inválidas' })
      const token = signToken({ id: student.id, role: 'STUDENT' })
      delete student.password_hash
      return res.json({ user: { ...student, role: 'STUDENT' }, token })
    }

    // 3. Tenta responsável
    const [respRows] = await pool.query(
      'SELECT id, full_name AS fullName, email, password_hash FROM responsibles WHERE email = ?',
      [email]
    )

    if (respRows.length > 0) {
      const resp = respRows[0]
      if (!resp.password_hash) {
        return res.status(403).json({ error: 'Senha não configurada. Contate a secretaria para definir sua senha.' })
      }
      const match = await bcrypt.compare(password, resp.password_hash)
      if (!match) return res.status(401).json({ error: 'Credenciais inválidas' })
      const token = signToken({ id: resp.id, role: 'RESPONSIBLE' })
      delete resp.password_hash
      return res.json({ user: { ...resp, role: 'RESPONSIBLE' }, token })
    }

    return res.status(401).json({ error: 'Email não encontrado. Verifique suas credenciais.' })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao realizar login' })
  }
}

// GET /auth/profile
export async function getProfile(req, res) {
  try {
    const [rows] = await pool.query(
      'SELECT id, full_name AS fullName, email, role FROM users WHERE id = ? AND is_active = 1',
      [req.userId]
    )
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' })
    }
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao buscar perfil' })
  }
}