// Importa o pool de conexões com o MySQL (permite fazer queries no banco)
import pool from '../database/connection.js'
import bcrypt from 'bcryptjs'
import { validateUserPayload, validateUserUpdatePayload } from '../utils/validator.js'

// controladores de usuário (CRUD)

export const createUser = async (req, res) => {
const data = req.body
const errors = validateUserPayload(data)
if (errors.length > 0) {
    return res.status(400).json({ errors })
}

const conn = await pool.getConnection()
try {
    await conn.beginTransaction()

    const { fullName, email, password, role } = data
    const passwordHash = await bcrypt.hash(password, 10)

    const [result] = await conn.query(
    'INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    [fullName, email, passwordHash, role]
    )

    await conn.commit()
    res.status(201).json({ message: 'Usuário criado com sucesso', userId: result.insertId })
} catch (err) {
    await conn.rollback()
    console.error(err)
    if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'Email já cadastrado' })
    }
    res.status(500).json({ error: 'Erro ao cadastrar usuário' })
} finally {
    conn.release()
}
}

export async function getAllUsers(req, res) {
const conn = await pool.getConnection()
try {
    const [rows] = await conn.query(
    'SELECT id, full_name AS name, email, role, is_active, created_at FROM users WHERE is_active = 1 ORDER BY full_name ASC'
    )
    res.json(rows)
} catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao buscar usuários' })
} finally {
    conn.release()
}
}

export async function getUserById(req, res) {
try {
    const [rows] = await pool.query(
    'SELECT id, full_name AS name, email, role, is_active FROM users WHERE id = ? AND is_active = 1',
    [req.params.id]
    )
    if (rows.length === 0) {
    return res.status(404).json({ error: 'Usuário não encontrado' })
    }
    res.json(rows[0])
} catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao buscar usuário' })
}
}


export async function updateUser(req, res) {
const data = req.body
const errors = validateUserUpdatePayload(data)
if (errors.length > 0) {
    return res.status(400).json({ errors })
}

const conn = await pool.getConnection()
try {
    await conn.beginTransaction()
    const { fullName, email, password, role, is_active } = data
    const passwordHash = password ? await bcrypt.hash(password, 10) : undefined

    const fields = []
    const values = []
    if (fullName) { fields.push('full_name = ?'); values.push(fullName) }
    if (email) { fields.push('email = ?'); values.push(email) }
    if (passwordHash) { fields.push('password_hash = ?'); values.push(passwordHash) }
    if (role) { fields.push('role = ?'); values.push(role) }
    if (typeof is_active !== 'undefined') { fields.push('is_active = ?'); values.push(is_active) }

    if (fields.length === 0) {
    return res.status(400).json({ error: 'Nenhum campo para atualizar' })
    }

    const [result] = await conn.query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
    [...values, req.params.id]
    )

    if (result.affectedRows === 0) {
    return res.status(404).json({ error: 'Usuário não encontrado' })
    }

    await conn.commit()
    res.json({ message: 'Usuário atualizado com sucesso' })
} catch (err) {
    await conn.rollback()
    console.error(err)
    res.status(500).json({ error: 'Erro ao atualizar usuário' })
} finally {
    conn.release()
}
}

export async function deleteUser(req, res) {
try {
    const [result] = await pool.query(
        'UPDATE users SET is_active = 0 WHERE id = ? AND is_active = 1',
        [req.params.id]
    )
    if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Usuário não encontrado' })
    }
    res.json({ message: 'Usuário desativado com sucesso' })
} catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao deletar usuário' })
}
}