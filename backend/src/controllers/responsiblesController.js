import pool from '../database/connection.js'
import bcrypt from 'bcryptjs'
import { validateResponsiblePayload, validateResponsibleUpdatePayload } from '../utils/validator.js'

// GET /responsibles  (paginado)
export async function getAllResponsibles(req, res) {
  try {
    const { search, limit = 10, offset = 0 } = req.query
    let query = 'SELECT id, full_name, cpf, rg, birth_date, address, email, phone, created_at FROM responsibles'
    let count = 'SELECT COUNT(*) AS total FROM responsibles'
    const params = []

    if (search) {
      const term = `%${search}%`
      const where = ' WHERE full_name LIKE ? OR email LIKE ? OR cpf LIKE ?'
      query += where; count += where
      params.push(term, term, term)
    }

    query += ' ORDER BY full_name LIMIT ? OFFSET ?'
    const [rows]   = await pool.query(query,  [...params, Number(limit), Number(offset)])
    const [totals] = await pool.query(count,  params)
    res.json({ data: rows, total: totals[0].total })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao listar responsáveis' })
  }
}

// GET /responsibles/:id
export async function getResponsibleById(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT id, full_name, cpf, rg, birth_date, address, email, phone, created_at
       FROM responsibles WHERE id = ?`,
      [req.params.id]
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Responsável não encontrado' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao buscar responsável' })
  }
}

// POST /responsibles
export async function createResponsible(req, res) {
  const { full_name, cpf, rg, birth_date, address, email, phone, password } = req.body || {}

  if (!full_name || !email || !cpf) {
    return res.status(400).json({ error: 'Nome, email e CPF são obrigatórios' })
  }
  if (!password) {
    return res.status(400).json({ error: 'Senha é obrigatória' })
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const password_hash = await bcrypt.hash(password, 10)
    const [result] = await conn.query(
      `INSERT INTO responsibles (full_name, cpf, rg, birth_date, address, email, phone, password_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        full_name,
        cpf ? String(cpf).replace(/\D/g, '') : null,
        rg || null,
        birth_date || null,
        address || null,
        email,
        phone || null,
        password_hash,
      ]
    )
    await conn.commit()
    res.status(201).json({ message: 'Responsável criado com sucesso', id: result.insertId })
  } catch (err) {
    await conn.rollback()
    console.error(err)
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'CPF ou email já cadastrado' })
    }
    res.status(500).json({ error: 'Erro ao criar responsável' })
  } finally {
    conn.release()
  }
}

// PUT /responsibles/:id
export async function updateResponsible(req, res) {
  const { full_name, cpf, rg, birth_date, address, email, phone, password } = req.body || {}
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const fields = []; const values = []

    if (full_name  !== undefined) { fields.push('full_name = ?');  values.push(full_name) }
    if (email      !== undefined) { fields.push('email = ?');      values.push(email) }
    if (cpf        !== undefined) { fields.push('cpf = ?');        values.push(cpf ? String(cpf).replace(/\D/g, '') : null) }
    if (rg         !== undefined) { fields.push('rg = ?');         values.push(rg || null) }
    if (birth_date !== undefined) { fields.push('birth_date = ?'); values.push(birth_date || null) }
    if (address    !== undefined) { fields.push('address = ?');    values.push(address || null) }
    if (phone      !== undefined) { fields.push('phone = ?');      values.push(phone || null) }
    if (password)                 { fields.push('password_hash = ?'); values.push(await bcrypt.hash(password, 10)) }

    if (fields.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar' })

    const [result] = await conn.query(
      `UPDATE responsibles SET ${fields.join(', ')} WHERE id = ?`,
      [...values, req.params.id]
    )
    if (result.affectedRows === 0) {
      await conn.rollback()
      return res.status(404).json({ error: 'Responsável não encontrado' })
    }
    await conn.commit()
    res.json({ message: 'Responsável atualizado com sucesso' })
  } catch (err) {
    await conn.rollback()
    console.error(err)
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'CPF ou email já cadastrado' })
    }
    res.status(500).json({ error: 'Erro ao atualizar responsável' })
  } finally {
    conn.release()
  }
}

// DELETE /responsibles/:id
export async function deleteResponsible(req, res) {
  try {
    const [result] = await pool.query('DELETE FROM responsibles WHERE id = ?', [req.params.id])
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Responsável não encontrado' })
    res.json({ message: 'Responsável removido com sucesso' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao remover responsável' })
  }
}

// GET /responsibles/:id/students
export async function getStudentsByResponsibleId(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT id, full_name, cpf, rg, email, phone, birth_date, address
       FROM students WHERE responsible_id = ?`,
      [req.params.id]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao buscar alunos do responsável' })
  }
}
