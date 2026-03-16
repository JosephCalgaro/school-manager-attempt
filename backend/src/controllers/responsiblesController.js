import pool from '../database/connection.js'
import bcrypt from 'bcryptjs'

export async function getAllResponsibles(req, res) {
  const sid = req.schoolId
  try {
    const { search, status, limit = 10, offset = 0 } = req.query
    const conditions = ['school_id = ?']; const params = [sid]
    if (search) {
      const term = `%${search}%`
      conditions.push('(full_name LIKE ? OR email LIKE ? OR cpf LIKE ?)')
      params.push(term, term, term)
    }
    if (status === 'active')   conditions.push('is_active = 1')
    if (status === 'inactive') conditions.push('is_active = 0')
    const where = ' WHERE ' + conditions.join(' AND ')
    const query = `SELECT id, full_name, cpf, rg, birth_date, address, email, phone, is_active, created_at FROM responsibles${where} ORDER BY is_active DESC, full_name LIMIT ? OFFSET ?`
    const count = `SELECT COUNT(*) AS total FROM responsibles${where}`
    const [rows]   = await pool.query(query, [...params, Number(limit), Number(offset)])
    const [totals] = await pool.query(count, params)
    res.json({ data: rows, total: totals[0].total })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao listar responsáveis' }) }
}

export async function toggleResponsibleActive(req, res) {
  const sid = req.schoolId
  try {
    const [[r]] = await pool.query('SELECT is_active FROM responsibles WHERE id = ? AND school_id = ?', [req.params.id, sid])
    if (!r) return res.status(404).json({ error: 'Responsável não encontrado' })
    const newStatus = r.is_active ? 0 : 1
    await pool.query('UPDATE responsibles SET is_active = ? WHERE id = ? AND school_id = ?', [newStatus, req.params.id, sid])
    res.json({ is_active: newStatus, message: newStatus ? 'Responsável reativado' : 'Responsável desativado' })
  } catch (err) { res.status(500).json({ error: 'Erro ao alterar status' }) }
}

export async function getResponsibleById(req, res) {
  const sid = req.schoolId
  try {
    const [rows] = await pool.query(
      `SELECT id, full_name, cpf, rg, birth_date, address, email, phone, created_at
       FROM responsibles WHERE id = ? AND school_id = ?`,
      [req.params.id, sid]
    )
    if (!rows.length) return res.status(404).json({ error: 'Responsável não encontrado' })
    res.json(rows[0])
  } catch (err) { res.status(500).json({ error: 'Erro ao buscar responsável' }) }
}

export async function createResponsible(req, res) {
  const { full_name, cpf, rg, birth_date, address, email, phone, password } = req.body || {}
  const sid = req.schoolId
  if (!full_name || !email || !cpf) return res.status(400).json({ error: 'Nome, email e CPF são obrigatórios' })
  if (!password) return res.status(400).json({ error: 'Senha é obrigatória' })
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const password_hash = await bcrypt.hash(password, 10)
    const [result] = await conn.query(
      `INSERT INTO responsibles (full_name, cpf, rg, birth_date, address, email, phone, password_hash, school_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [full_name, cpf ? String(cpf).replace(/\D/g,'') : null, rg || null,
       birth_date || null, address || null, email, phone || null, password_hash, sid]
    )
    await conn.commit()
    res.status(201).json({ message: 'Responsável criado com sucesso', id: result.insertId })
  } catch (err) {
    await conn.rollback()
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'CPF ou email já cadastrado' })
    res.status(500).json({ error: 'Erro ao criar responsável' })
  } finally { conn.release() }
}

export async function updateResponsible(req, res) {
  const { full_name, cpf, rg, birth_date, address, email, phone, password } = req.body || {}
  const sid = req.schoolId
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const fields = []; const values = []
    if (full_name  !== undefined) { fields.push('full_name = ?');  values.push(full_name) }
    if (email      !== undefined) { fields.push('email = ?');      values.push(email) }
    if (cpf        !== undefined) { fields.push('cpf = ?');        values.push(cpf ? String(cpf).replace(/\D/g,'') : null) }
    if (rg         !== undefined) { fields.push('rg = ?');         values.push(rg || null) }
    if (birth_date !== undefined) { fields.push('birth_date = ?'); values.push(birth_date || null) }
    if (address    !== undefined) { fields.push('address = ?');    values.push(address || null) }
    if (phone      !== undefined) { fields.push('phone = ?');      values.push(phone || null) }
    if (password)                 { fields.push('password_hash = ?'); values.push(await bcrypt.hash(password, 10)) }
    if (!fields.length) return res.status(400).json({ error: 'Nenhum campo para atualizar' })
    const [result] = await conn.query(
      `UPDATE responsibles SET ${fields.join(', ')} WHERE id = ? AND school_id = ?`,
      [...values, req.params.id, sid]
    )
    if (result.affectedRows === 0) { await conn.rollback(); return res.status(404).json({ error: 'Responsável não encontrado' }) }
    await conn.commit()
    res.json({ message: 'Responsável atualizado com sucesso' })
  } catch (err) {
    await conn.rollback()
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'CPF ou email já cadastrado' })
    res.status(500).json({ error: 'Erro ao atualizar responsável' })
  } finally { conn.release() }
}

export async function deleteResponsible(req, res) {
  const sid = req.schoolId
  try {
    const [result] = await pool.query('DELETE FROM responsibles WHERE id = ? AND school_id = ?', [req.params.id, sid])
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Responsável não encontrado' })
    res.json({ message: 'Responsável removido com sucesso' })
  } catch (err) { res.status(500).json({ error: 'Erro ao remover responsável' }) }
}

export async function getStudentsByResponsibleId(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT id, full_name, cpf, rg, email, phone, birth_date, address
       FROM students WHERE responsible_id = ?`,
      [req.params.id]
    )
    res.json(rows)
  } catch (err) { res.status(500).json({ error: 'Erro ao buscar alunos do responsável' }) }
}
