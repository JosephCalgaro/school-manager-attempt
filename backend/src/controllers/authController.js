// Authentication helpers for the users table only.
// Students are stored in a separate "students" table and
// do **not** use this controller; if they will log in you
// should create a dedicated endpoint and (optionally) add
// password fields to the student schema.

import pool from '../database/connection.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

// valores secretos definidos em .env
const JWT_SECRET = process.env.JWT_SECRET || 'secret123'
const TOKEN_EXPIRES_IN = '10h' // ajustar conforme necessário

// cria um token JWT usando id e role do usuário
export function signToken(user) {
  // sub = "subject", usado para colocar o id
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, {
    expiresIn: TOKEN_EXPIRES_IN
  })
}

// valida e retorna o payload; lança se inválido
export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET)
}

// POST /auth/login
export async function login(req, res) {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' })
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, full_name AS fullName, email, password_hash, role, is_active FROM users WHERE email = ?',
      [email]
    )

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas' })
    }

    const user = rows[0]
    if (!user.is_active) {
      return res.status(403).json({ error: 'Usuário inativo' })
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash)
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Credenciais inválidas' })
    }

    const token = signToken(user)
    delete user.password_hash // never send hash back
    res.json({ user, token })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao realizar login' })
  }
}

// GET /auth/profile - retorna dados do usuário logado
export async function getProfile(req, res) {
  // middleware auth já colocou req.userId
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
