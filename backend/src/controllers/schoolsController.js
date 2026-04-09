import pool   from '../database/connection.js'
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
import { logEvent } from '../middlewares/logger.js'

// ─── Listar escola própria (admin da escola) ──────────────────────────────────
/**
 * getMySchool - retorna dados da escola do admin autenticado
 *
 * Locals:
 * - rows: query result rows
 */
export async function getMySchool(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, cnpj, email, phone, address, plan, is_active, created_at
       FROM schools WHERE id = ?`,
      [req.schoolId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Escola não encontrada' })
    res.json(rows[0])
  } catch (err) { res.status(500).json({ error: 'Erro ao buscar escola' }) }
}

// ─── Atualizar escola própria ─────────────────────────────────────────────────
/**
 * updateMySchool - atualiza os campos da escola do admin autenticado
 *
 * Locals:
 * - fields, values: arrays usadas para montar a query de update
 */
export async function updateMySchool(req, res) {
  const { name, cnpj, email, phone, address } = req.body || {}
  try {
    const fields = []; const values = []
    if (name    !== undefined) { fields.push('name = ?');    values.push(name) }
    if (cnpj    !== undefined) { fields.push('cnpj = ?');    values.push(cnpj || null) }
    if (email   !== undefined) { fields.push('email = ?');   values.push(email || null) }
    if (phone   !== undefined) { fields.push('phone = ?');   values.push(phone || null) }
    if (address !== undefined) { fields.push('address = ?'); values.push(address || null) }
    if (!fields.length) return res.status(400).json({ error: 'Nenhum campo para atualizar' })
    await pool.query(`UPDATE schools SET ${fields.join(', ')} WHERE id = ?`, [...values, req.schoolId])
    res.json({ message: 'Escola atualizada com sucesso' })
  } catch (err) { res.status(500).json({ error: 'Erro ao atualizar escola' }) }
}

// ─── SAAS OWNER: listar todas as escolas ─────────────────────────────────────
/**
 * listAllSchools - lista todas as escolas (SaaS owner)
 *
 * Locals:
 * - rows: query result rows
 */
export async function listAllSchools(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT
        s.id, s.name, s.cnpj, s.email, s.phone, s.plan, s.is_active, s.created_at,
        (SELECT COUNT(*) FROM students st WHERE st.school_id = s.id AND st.is_active = 1) AS active_students,
        (SELECT COUNT(*) FROM users u WHERE u.school_id = s.id AND u.is_active = 1)       AS active_users,
        (SELECT COUNT(*) FROM classes c WHERE c.school_id = s.id AND c.is_active = 1)     AS active_classes
      FROM schools s
      ORDER BY s.created_at DESC
    `)
    res.json(rows)
  } catch (err) { res.status(500).json({ error: 'Erro ao listar escolas' }) }
}

// ─── SAAS OWNER: criar escola + admin (onboarding completo) ──────────────────
/**
 * createSchoolWithAdmin - cria escola + usuário admin (onboarding)
 *
 * Locals:
 * - schoolResult, schoolId, password_hash, userResult: intermediate results
 */
export async function createSchoolWithAdmin(req, res) {
  const {
    school_name, school_cnpj, school_email, school_phone, school_address, plan,
    admin_name, admin_email, admin_password, admin_phone,
    monthly_fee,
  } = req.body || {}

  if (!school_name?.trim())   return res.status(400).json({ error: 'Nome da escola é obrigatório' })
  if (!admin_name?.trim())    return res.status(400).json({ error: 'Nome do admin é obrigatório' })
  if (!admin_email?.trim())   return res.status(400).json({ error: 'Email do admin é obrigatório' })
  if (!admin_password)        return res.status(400).json({ error: 'Senha do admin é obrigatória' })

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // 1. Criar escola
    const [schoolResult] = await conn.query(
      `INSERT INTO schools (name, cnpj, email, phone, address, plan, is_active, monthly_fee)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      [school_name.trim(), school_cnpj || null, school_email || null, school_phone || null,
       school_address || null, plan || 'BASIC',
       monthly_fee ?? 0.00]
    )
    const schoolId = schoolResult.insertId

    // 2. Criar usuário ADMIN da escola
    const password_hash = await bcrypt.hash(admin_password, 10)
    const [userResult] = await conn.query(
      `INSERT INTO users (full_name, email, phone, role, password_hash, is_active, school_id)
       VALUES (?, ?, ?, 'ADMIN', ?, 1, ?)`,
      [admin_name.trim(), admin_email.trim(), admin_phone || null, password_hash, schoolId]
    )

    await conn.commit()
    logEvent('INFO', 'SCHOOL_CREATED', { schoolId, adminUserId: userResult.insertId, name: school_name })

    res.status(201).json({
      message: 'Escola criada com sucesso',
      school_id: schoolId,
      admin_user_id: userResult.insertId,
    })
  } catch (err) {
    await conn.rollback()
    if (err?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email já cadastrado' })
    console.error(err)
    res.status(500).json({ error: 'Erro ao criar escola' })
  } finally { conn.release() }
}

// ─── SAAS OWNER: atualizar escola ─────────────────────────────────────────────
/**
 * updateSchool - atualiza dados de uma escola (SaaS owner)
 *
 * Locals:
 * - id: escola id (from params)
 * - fields, values: arrays usadas para montar update
 * - result: query result
 */
export async function updateSchool(req, res) {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID inválido' })
  const { name, cnpj, email, phone, address, plan, is_active, monthly_fee } = req.body || {}
  try {
    const fields = []; const values = []
    if (name        !== undefined) { fields.push('name = ?');        values.push(name) }
    if (cnpj        !== undefined) { fields.push('cnpj = ?');        values.push(cnpj || null) }
    if (email       !== undefined) { fields.push('email = ?');       values.push(email || null) }
    if (phone       !== undefined) { fields.push('phone = ?');       values.push(phone || null) }
    if (address     !== undefined) { fields.push('address = ?');     values.push(address || null) }
    if (plan        !== undefined) { fields.push('plan = ?');        values.push(plan) }
    if (is_active   !== undefined) { fields.push('is_active = ?');   values.push(is_active ? 1 : 0) }
    if (monthly_fee !== undefined) { fields.push('monthly_fee = ?'); values.push(monthly_fee ?? 0) }
    if (!fields.length) return res.status(400).json({ error: 'Nenhum campo para atualizar' })
    const [result] = await pool.query(`UPDATE schools SET ${fields.join(', ')} WHERE id = ?`, [...values, id])
    if (!result.affectedRows) return res.status(404).json({ error: 'Escola não encontrada' })
    res.json({ message: 'Escola atualizada' })
  } catch (err) { res.status(500).json({ error: 'Erro ao atualizar escola' }) }
}

// ─── SAAS OWNER: ativar/desativar escola ──────────────────────────────────────
/**
 * toggleSchool - ativa/desativa uma escola
 *
 * Locals:
 * - id: escola id (from params)
 * - s: current status row
 * - newStatus: novo status calculado
 */
export async function toggleSchool(req, res) {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID inválido' })
  try {
    const [[s]] = await pool.query('SELECT is_active FROM schools WHERE id = ?', [id])
    if (!s) return res.status(404).json({ error: 'Escola não encontrada' })
    const newStatus = s.is_active ? 0 : 1
    await pool.query('UPDATE schools SET is_active = ? WHERE id = ?', [newStatus, id])
    logEvent('INFO', newStatus ? 'SCHOOL_ACTIVATED' : 'SCHOOL_DEACTIVATED', { schoolId: id })
    res.json({ is_active: newStatus })
  } catch (err) { res.status(500).json({ error: 'Erro ao alterar escola' }) }
}

// ─── SAAS OWNER: deletar escola ───────────────────────────────────────────────
/**
 * deleteSchool - deleta uma escola (com proteção para id=1)
 *
 * Locals:
 * - id: escola id (from params)
 * - result: delete query result
 */
export async function deleteSchool(req, res) {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID inválido' })
  // Proteção: não permite deletar a escola padrão (id=1)
  if (id === 1) return res.status(400).json({ error: 'Não é possível deletar a escola padrão' })
  try {
    const [result] = await pool.query('DELETE FROM schools WHERE id = ?', [id])
    if (!result.affectedRows) return res.status(404).json({ error: 'Escola não encontrada' })
    logEvent('INFO', 'SCHOOL_DELETED', { schoolId: id })
    res.json({ message: 'Escola removida' })
  } catch (err) {
    console.error(err)
    // FK violation = escola tem dados vinculados
    if (err?.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ error: 'Escola possui dados vinculados. Desative-a em vez de deletar.' })
    }
    res.status(500).json({ error: 'Erro ao deletar escola' })
  }
}
