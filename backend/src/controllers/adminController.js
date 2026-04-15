import bcrypt from 'bcrypt';
import pool from '../database/connection.js';

// ============ CONTADORES ============

/**
 * getStats - retorna estatísticas da escola (total de alunos, usuários, turmas e usuários por função)
 *
 * @param {import('express').Request} req - objeto de requisição (deve conter `schoolId`)
 * @param {import('express').Response} res - objeto de resposta
 * @returns {Promise<void>}
 */
export const getStats = async (req, res) => {
  const sid = req.schoolId
  try {
    const [[stats]] = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM students WHERE school_id = ?) AS totalStudents,
        (SELECT COUNT(*) FROM users WHERE school_id = ? AND role != 'SAAS_OWNER') AS totalUsers,
        (SELECT COUNT(*) FROM classes WHERE school_id = ?) AS totalClasses`,
      [sid, sid, sid]
    )
    const [usersByRole] = await pool.query(
      "SELECT role, COUNT(*) as count FROM users WHERE school_id = ? AND role != 'SAAS_OWNER' GROUP BY role",
      [sid]
    )
    res.json({ ...stats, usersByRole })
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error)
    res.status(500).json({ message: 'Erro ao buscar estatísticas' })
  }
}

// ============ ALUNOS ============
/**
 * getAllStudents - lista alunos com filtros e paginação
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 *
 * Locals (const/let):
 * - sid: school id for the current request
 * - search: search string from `req.query.search`
 * - status: filter from `req.query.status` ('active'|'inactive')
 * - limit: requested page size from `req.query.limit`
 * - offset: requested offset from `req.query.offset`
 * - maxLimit: upper bound for `limit` to prevent large queries
 * - safeLimit: sanitized `limit` used in SQL
 * - safeOffset: sanitized `offset` used in SQL
 * - conditions: array of SQL WHERE condition fragments
 * - params: array of parameter values for the SQL query
 * - t: wildcard search value used for LIKE queries (e.g. `%term%`)
 * - where: assembled WHERE clause string (prefixed with ' WHERE ')
 * - query: SQL string used to select student rows
 * - countQ: SQL string used to count matching rows
 * - students: result rows returned by the select query
 * - countResult: result row returned by the count query
 */
export const getAllStudents = async (req, res) => {
  const sid = req.schoolId
  try {
    const { search, status, limit = 10, offset = 0 } = req.query
    const maxLimit = 500
    const safeLimit = Math.min(maxLimit, Math.max(1, parseInt(limit) || 10))
    const safeOffset = Math.max(0, parseInt(offset) || 0)
    const conditions = ['school_id = ?']
    const params     = [sid]

    if (search) {
      conditions.push('(full_name LIKE ? OR email LIKE ? OR cpf LIKE ?)')
      const t = `%${search}%`; params.push(t, t, t)
    }
    if (status === 'active')   conditions.push('is_active = 1')
    if (status === 'inactive') conditions.push('is_active = 0')

    const where    = ' WHERE ' + conditions.join(' AND ')
    const query    = `SELECT id, full_name, cpf, email, phone, birth_date, is_active, city, deactivation_reason, created_at FROM students${where} ORDER BY is_active DESC, full_name LIMIT ? OFFSET ?`
    const countQ   = `SELECT COUNT(*) as total FROM students${where}`
    const [students]    = await pool.query(query,  [...params, safeLimit, safeOffset])
    const [countResult] = await pool.query(countQ, params)
    res.json({ data: students, total: countResult[0].total, limit: safeLimit, offset: safeOffset })
  } catch (error) {
    console.error('Erro ao listar alunos:', error)
    res.status(500).json({ message: 'Erro ao listar alunos' })
  }
}

/**
 * toggleStudentActive - alterna o status ativo/inativo de um aluno
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 *
 * Locals (const/let):
 * - id, deactivation_reason, sid
 * - s, newStatus, deactivatedAt
 */
export const toggleStudentActive = async (req, res) => {
  const { id } = req.params
  const { deactivation_reason } = req.body || {}
  const sid = req.schoolId
  try {
    const [[s]] = await pool.query('SELECT is_active FROM students WHERE id = ? AND school_id = ?', [id, sid])
    if (!s) return res.status(404).json({ message: 'Aluno não encontrado' })
    const newStatus = s.is_active ? 0 : 1
    // parameterized CASE expression — no string interpolation
    await pool.query(
      `UPDATE students
       SET is_active = ?,
           deactivated_at = CASE WHEN ? = 0 THEN NOW() ELSE NULL END,
           deactivation_reason = ?
       WHERE id = ? AND school_id = ?`,
      [newStatus, newStatus, newStatus === 0 ? (deactivation_reason || null) : null, id, sid]
    )
    res.json({ is_active: newStatus, message: newStatus ? 'Aluno reativado' : 'Aluno desativado' })
  } catch (error) {
    console.error('Erro ao alterar status do aluno:', error)
    res.status(500).json({ message: 'Erro ao alterar status do aluno' })
  }
}

/**
 * getStudentDetails - busca detalhes de um aluno e seu responsável (se houver)
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 *
 * Locals (const/let):
 * - sid (school id), students, student
 * - responsible, resp
 */
export const getStudentDetails = async (req, res) => {
  const sid = req.schoolId
  try {
    const [[student]] = await pool.query(
      `SELECT s.*,
              r.full_name  AS resp_full_name,
              r.email      AS resp_email,
              r.phone      AS resp_phone,
              r.cpf        AS resp_cpf,
              r.rg         AS resp_rg,
              r.birth_date AS resp_birth_date,
              r.address    AS resp_address
       FROM students s
       LEFT JOIN responsibles r ON r.id = s.responsible_id
       WHERE s.id = ? AND s.school_id = ?`,
      [req.params.id, sid]
    )
    if (!student) return res.status(404).json({ message: 'Aluno não encontrado' })
    delete student.password_hash

    // Monta objeto responsible apenas se existir
    let responsible = null
    if (student.responsible_id) {
      responsible = {
        full_name:  student.resp_full_name,
        email:      student.resp_email,
        phone:      student.resp_phone,
        cpf:        student.resp_cpf,
        rg:         student.resp_rg,
        birth_date: student.resp_birth_date,
        address:    student.resp_address,
      }
    }
    // Remove campos resp_* do objeto raiz
    Object.keys(student).filter(k => k.startsWith('resp_')).forEach(k => delete student[k])

    res.json({ ...student, responsible })
  } catch (error) {
    console.error('Erro ao buscar detalhes do aluno:', error)
    res.status(500).json({ message: 'Erro ao buscar detalhes do aluno' })
  }
}

/**
 * updateStudentDetails - atualiza campos do aluno e (opcionalmente) do responsável
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 *
 * Locals (const/let):
 * - id: `req.params.id` (student id to update)
 * - sid: school id for the current request
 * - full_name, cpf, rg, birth_date, address, city, email, phone,
 *   due_day, password, responsible, deactivation_reason: updatable fields from `req.body`
 * - conn: DB connection used for the transaction
 * - students: rows returned from the initial SELECT to verify existence
 * - current: the current student row object
 * - sf: array of student field SQL fragments to update (e.g. 'full_name = ?')
 * - sv: array of student field values corresponding to `sf`
 * - rf: array of responsible field SQL fragments to update
 * - rv: array of responsible field values corresponding to `rf`
 */
export const updateStudentDetails = async (req, res) => {
  const { id } = req.params
  const sid     = req.schoolId
  const { full_name, cpf, rg, birth_date, address, city, email, phone,
          due_day, password, responsible, deactivation_reason } = req.body || {}

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [students] = await conn.query('SELECT * FROM students WHERE id = ? AND school_id = ?', [id, sid])
    if (!students.length) { await conn.rollback(); return res.status(404).json({ message: 'Aluno não encontrado' }) }
    const current = students[0]

    const sf = []; const sv = []
    if (full_name             !== undefined) { sf.push('full_name = ?');             sv.push(full_name) }
    if (cpf                   !== undefined) { sf.push('cpf = ?');                   sv.push(String(cpf).replace(/\D/g,'')) }
    if (rg                    !== undefined) { sf.push('rg = ?');                    sv.push(rg) }
    if (birth_date            !== undefined) { sf.push('birth_date = ?');            sv.push(birth_date) }
    if (address               !== undefined) { sf.push('address = ?');               sv.push(address) }
    if (city                  !== undefined) { sf.push('city = ?');                  sv.push(city || null) }
    if (email                 !== undefined) { sf.push('email = ?');                 sv.push(email) }
    if (phone                 !== undefined) { sf.push('phone = ?');                 sv.push(phone || null) }
    if (due_day               !== undefined) { sf.push('due_day = ?');               sv.push(due_day) }
    if (deactivation_reason   !== undefined) { sf.push('deactivation_reason = ?');   sv.push(deactivation_reason || null) }
    if (password) { sf.push('password_hash = ?'); sv.push(await bcrypt.hash(password, 10)) }
    if (sf.length) await conn.query(`UPDATE students SET ${sf.join(', ')} WHERE id = ? AND school_id = ?`, [...sv, id, sid])

    if (responsible && current.responsible_id) {
      const rf = []; const rv = []
      if (responsible.full_name  !== undefined) { rf.push('full_name = ?');  rv.push(responsible.full_name) }
      if (responsible.cpf        !== undefined) { rf.push('cpf = ?');        rv.push(String(responsible.cpf).replace(/\D/g,'')) }
      if (responsible.rg         !== undefined) { rf.push('rg = ?');         rv.push(responsible.rg) }
      if (responsible.birth_date !== undefined) { rf.push('birth_date = ?'); rv.push(responsible.birth_date) }
      if (responsible.address    !== undefined) { rf.push('address = ?');    rv.push(responsible.address) }
      if (responsible.email      !== undefined) { rf.push('email = ?');      rv.push(responsible.email) }
      if (responsible.phone      !== undefined) { rf.push('phone = ?');      rv.push(responsible.phone || null) }
      if (rf.length) await conn.query(`UPDATE responsibles SET ${rf.join(', ')} WHERE id = ?`, [...rv, current.responsible_id])
    }

    await conn.commit()
    res.json({ message: 'Aluno atualizado com sucesso' })
  } catch (error) {
    await conn.rollback()
    if (error?.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'CPF ou email já cadastrado' })
    console.error('Erro ao atualizar aluno:', error)
    res.status(500).json({ message: 'Erro ao atualizar aluno' })
  } finally { if (conn) conn.release() }
}

/**
 * getStudentClasses - retorna as turmas em que o aluno está matriculado
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 *
 * Locals (const/let):
 * - sid (school id), classes
 */
export const getStudentClasses = async (req, res) => {
  const sid = req.schoolId
  try {
    const [classes] = await pool.query(
      `SELECT c.id, c.name, c.schedule, u.full_name as teacher_name
       FROM classes c
       INNER JOIN class_students cs ON c.id = cs.class_id
       LEFT JOIN users u ON c.teacher_id = u.id
       WHERE cs.student_id = ? AND c.school_id = ?`,
      [req.params.id, sid]
    )
    res.json(classes)
  } catch (error) { 
    console.error('Erro ao buscar turmas do aluno:', error)
    res.status(500).json({ message: 'Erro ao buscar turmas do aluno' })
  }
}

/**
 * getStudentAttendance - retorna presença do aluno (opcionalmente filtrada por turma)
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 *
 * Locals (const/let):
 * - sid: school id for the current request
 * - id: `req.params.id` (student id)
 * - classId: optional `req.query.classId` to filter attendance
 * - query: SQL string built to fetch attendance rows
 * - params: array of parameter values for the attendance query
 * - attendance: result rows for attendance records
 * - total: total number of attendance records returned
 * - present: number of records where `present` is truthy
 * - percentage: computed presence percentage (string with '%')
 */
export const getStudentAttendance = async (req, res) => {
  const sid = req.schoolId
  try {
    const { id } = req.params; const { classId } = req.query
    let query  = `SELECT a.id, a.date, a.present, c.name as class_name
                  FROM attendance a
                  INNER JOIN classes c ON a.class_id = c.id
                  WHERE a.student_id = ? AND c.school_id = ?`
    let params = [id, sid]
    if (classId) { query += ' AND a.class_id = ?'; params.push(classId) }
    query += ' ORDER BY a.date DESC'
    const [attendance] = await pool.query(query, params)
    const total = attendance.length; const present = attendance.filter(a => a.present).length
    const percentage = total > 0 ? ((present / total) * 100).toFixed(2) : 0
    res.json({ attendance, statistics: { total, present, absent: total - present, percentage: `${percentage}%` } })
  } catch (error) { 
    console.error('Erro ao buscar frequência do aluno:', error)
    res.status(500).json({ message: 'Erro ao buscar frequência do aluno' })
  }
}

/**
 * getStudentAssignments - obtém atividades e notas do aluno
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 *
 * Locals (const/let):
 * - sid (school id), id, assignments
 */
export const getStudentAssignments = async (req, res) => {
  const sid = req.schoolId
  try {
    const { id } = req.params
    const [assignments] = await pool.query(
      `SELECT a.id, a.title, a.type, a.max_score, a.due_date, a.description,
              c.name as class_name, g.score
       FROM assignments a
       INNER JOIN classes c ON a.class_id = c.id AND c.school_id = ?
       INNER JOIN class_students cs ON c.id = cs.class_id
       LEFT JOIN grades g ON a.id = g.assignments_id AND g.student_id = ?
       WHERE cs.student_id = ?
       ORDER BY a.due_date DESC`,
      [sid, id, id]
    )
    res.json(assignments)
  } catch (error) { 
    console.error('Erro ao buscar atividades do aluno:', error)
    res.status(500).json({ message: 'Erro ao buscar atividades do aluno' })
  }
}

/**
 * createStudent - cria um novo aluno e (opcionalmente) um responsável associado
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 *
 * Locals (const/let):
 * - full_name, cpf, rg, birth_date, address, city, email, phone: student fields from `req.body`
 * - due_day: billing day from `req.body`
 * - password: raw password from `req.body` (will be hashed)
 * - responsible: optional responsible object from `req.body`
 * - sid: school id for the current request
 * - conn: database connection obtained via `pool.getConnection()`
 * - password_hash: bcrypt hash of the provided password
 * - responsible_id: inserted responsible id (if a responsible was created)
 * - resp_hash: bcrypt hash for responsible's password (if provided)
 * - respResult: result object from inserting a responsible
 * - result: result object from inserting the student
 */
export const createStudent = async (req, res) => {
  const { full_name, cpf, rg, birth_date, address, city, email, phone, due_day, password, responsible } = req.body || {}
  const sid = req.schoolId
  if (!full_name || !cpf || !email || !password)
    return res.status(400).json({ message: 'Nome, CPF, email e senha são obrigatórios' })

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const password_hash = await bcrypt.hash(password, 10)
    let responsible_id = null
    if (responsible?.full_name && responsible?.email) {
      const resp_hash = responsible.password ? await bcrypt.hash(responsible.password, 10) : null
      const [respResult] = await conn.query(
        `INSERT INTO responsibles (full_name, cpf, rg, birth_date, address, email, phone, password_hash, school_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [responsible.full_name, responsible.cpf ? String(responsible.cpf).replace(/\D/g,'') : null,
         responsible.rg || null, responsible.birth_date || null, responsible.address || null,
         responsible.email, responsible.phone || null, resp_hash, sid]
      )
      responsible_id = respResult.insertId
    }
    const [result] = await conn.query(
      `INSERT INTO students (full_name, cpf, rg, birth_date, address, city, email, phone,
                             due_day, password_hash, responsible_id, created_by, is_active, school_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [full_name, String(cpf).replace(/\D/g,''), rg || null, birth_date || null,
       address || null, city || null, email, phone || null, due_day || null,
       password_hash, responsible_id, req.userId || null, sid]
    )
    await conn.commit()
    res.status(201).json({ id: result.insertId, message: 'Aluno cadastrado com sucesso' })
  } catch (error) {
    await conn.rollback()
    if (error?.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'CPF ou email já cadastrado' })
    console.error('Erro ao criar aluno:', error)
    res.status(500).json({ message: 'Erro ao criar aluno' })
  } finally { conn.release() }
}

// ============ USUÁRIOS ============
/**
 * getAllUsers - lista usuários da escola com filtros e paginação
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 *
 * Locals (const/let):
 * - sid (school id), search, role, status, limit, offset
 * - maxLimit, safeLimit, safeOffset
 * - conditions, params, query, users, countResult
 */
export const getAllUsers = async (req, res) => {
  const sid = req.schoolId
  try {
    const { search, role, status, limit = 10, offset = 0 } = req.query
    const maxLimit = 500
    const safeLimit = Math.min(maxLimit, Math.max(1, parseInt(limit) || 10))
    const safeOffset = Math.max(0, parseInt(offset) || 0)
    // SAAS_OWNER nunca aparece na listagem de usuários da escola
    const conditions = ['school_id = ?', "role != 'SAAS_OWNER'", 'is_temp = 0']
    const params = [sid]
    if (search) { conditions.push('(full_name LIKE ? OR email LIKE ?)'); params.push(`%${search}%`, `%${search}%`) }
    if (role && role !== 'SAAS_OWNER') { conditions.push('role = ?'); params.push(role) }
    if (status === 'active')   conditions.push('is_active = 1')
    if (status === 'inactive') conditions.push('is_active = 0')
    const where = ' WHERE ' + conditions.join(' AND ')
    const query = `SELECT id, full_name, email, phone, role, is_active, created_at FROM users${where} ORDER BY is_active DESC, full_name LIMIT ? OFFSET ?`
    const [users]        = await pool.query(query, [...params, safeLimit, safeOffset])
    const [countResult]  = await pool.query(`SELECT COUNT(*) as total FROM users${where}`, params)
    res.json({ data: users, total: countResult[0].total, limit: safeLimit, offset: safeOffset })
  } catch (error) {
    console.error('Erro ao listar usuários:', error)
    res.status(500).json({ message: 'Erro ao listar usuários' })
  }
}

/**
 * toggleUserActive - alterna status ativo/inativo de um usuário
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 *
 * Locals (const/let):
 * - sid (school id), u, newStatus
 */
export const toggleUserActive = async (req, res) => {
  const sid = req.schoolId
  try {
    const [[u]] = await pool.query(
      'SELECT is_active, role FROM users WHERE id = ? AND school_id = ?',
      [req.params.id, sid]
    )
    if (!u) return res.status(404).json({ message: 'Usuário não encontrado' })

    // Protege: SAAS_OWNER nunca pode ser alterado por esta rota
    if (u.role === 'SAAS_OWNER') {
      return res.status(403).json({ message: 'Não é permitido alterar o status do SaaS Owner.' })
    }
    // Protege: admin temporário não pode desativar a si mesmo
    // (req.userId = saas_owner_id, e o user sendo alterado pode ter o mesmo id)
    if (req.isTemp && Number(req.params.id) === req.userId) {
      return res.status(403).json({ message: 'Não é permitido alterar o próprio acesso temporário.' })
    }

    const newStatus = u.is_active ? 0 : 1
    await pool.query('UPDATE users SET is_active = ? WHERE id = ? AND school_id = ?', [newStatus, req.params.id, sid])
    res.json({ is_active: newStatus, message: newStatus ? 'Usuário reativado' : 'Usuário desativado' })
  } catch (error) {
    console.error('Erro ao alterar status do usuário:', error)
    res.status(500).json({ message: 'Erro ao alterar status do usuário' })
  }
}

/**
 * getUserDetails - obtém informações detalhadas de um usuário (exclui SAAS_OWNER)
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 *
 * Locals (const/let):
 * - sid (school id), users, user, classes
 * - tc
 */
export const getUserDetails = async (req, res) => {
  const sid = req.schoolId
  try {
    const [users] = await pool.query(
      `SELECT id, full_name, email, phone, cpf, rg, birth_date, role, is_active, created_at
       FROM users WHERE id = ? AND school_id = ? AND role != 'SAAS_OWNER' AND is_temp = 0`,
      [req.params.id, sid]
    )
    if (!users.length) return res.status(404).json({ message: 'Usuário não encontrado' })
    const user = users[0]
    let classes = []
    if (user.role === 'TEACHER') {
      const [tc] = await pool.query('SELECT id, name, schedule FROM classes WHERE teacher_id = ? AND school_id = ?', [req.params.id, sid])
      classes = tc
    }
    res.json({ ...user, classes })
  } catch (error) {
    console.error('Erro ao buscar detalhes do usuário:', error)
    res.status(500).json({ message: 'Erro ao buscar detalhes do usuário' })
  }
}

/**
 * createUser - cria um usuário com função válida e senha
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 *
 * Locals (const/let):
 * - full_name, email, phone, cpf, rg, birth_date, role, password, sid
 * - VALID_ROLES, password_hash, result
 */
export const createUser = async (req, res) => {
  const { full_name, email, phone, cpf, rg, birth_date, role, password } = req.body || {}
  const sid = req.schoolId
  const VALID_ROLES = ['ADMIN', 'TEACHER', 'SECRETARY']
  if (!full_name || !email || !role || !password)
    return res.status(400).json({ message: 'Nome, email, função e senha são obrigatórios' })
  if (!VALID_ROLES.includes(role))
    return res.status(400).json({ message: 'Função inválida. Valores aceitos: ADMIN, TEACHER, SECRETARY' })
  try {
    const password_hash = await bcrypt.hash(password, 10)
    const [result] = await pool.query(
      `INSERT INTO users (full_name, email, phone, cpf, rg, birth_date, role, password_hash, is_active, school_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [full_name, email, phone || null, cpf || null, rg || null, birth_date || null, role, password_hash, sid]
    )
    res.status(201).json({ id: result.insertId, message: 'Usuário criado com sucesso' })
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Email ou CPF já cadastrado' })
    console.error('Erro ao criar usuário:', error)
    res.status(500).json({ message: 'Erro ao criar usuário' })
  }
}

/**
 * updateUser - atualiza campos de um usuário existente, protegendo SAAS_OWNER
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 *
 * Locals (const/let):
 * - id, sid, full_name, email, phone, cpf, rg, birth_date, role, password, is_active
 * - VALID_ROLES, target, fields, values
 */
export const updateUser = async (req, res) => {
  const { id } = req.params; const sid = req.schoolId
  const { full_name, email, phone, cpf, rg, birth_date, role, password, is_active } = req.body || {}
  const VALID_ROLES = ['ADMIN', 'TEACHER', 'SECRETARY']
  if (role && !VALID_ROLES.includes(role)) return res.status(400).json({ message: 'Função inválida' })
  try {
    // Verifica se o alvo é SAAS_OWNER antes de qualquer alteração
    const [[target]] = await pool.query(
      'SELECT role FROM users WHERE id = ? AND school_id = ?', [id, sid]
    )
    if (!target) return res.status(404).json({ message: 'Usuário não encontrado' })
    if (target.role === 'SAAS_OWNER') {
      return res.status(403).json({ message: 'Não é permitido editar o SaaS Owner.' })
    }

    const fields = []; const values = []
    if (full_name  !== undefined) { fields.push('full_name = ?');  values.push(full_name) }
    if (email      !== undefined) { fields.push('email = ?');      values.push(email) }
    if (phone      !== undefined) { fields.push('phone = ?');      values.push(phone || null) }
    if (cpf        !== undefined) { fields.push('cpf = ?');        values.push(cpf || null) }
    if (rg         !== undefined) { fields.push('rg = ?');         values.push(rg || null) }
    if (birth_date !== undefined) { fields.push('birth_date = ?'); values.push(birth_date || null) }
    if (role       !== undefined) { fields.push('role = ?');       values.push(role) }
    if (is_active  !== undefined) { fields.push('is_active = ?');  values.push(is_active ? 1 : 0) }
    if (password) { fields.push('password_hash = ?'); values.push(await bcrypt.hash(password, 10)) }
    if (!fields.length) return res.status(400).json({ message: 'Nenhum campo para atualizar' })
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ? AND school_id = ?`, [...values, id, sid])
    res.json({ message: 'Usuário atualizado com sucesso' })
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Email ou CPF já cadastrado' })
    console.error('Erro ao atualizar usuário:', error)
    res.status(500).json({ message: 'Erro ao atualizar usuário' })
  }
}

// ============ TURMAS ============
/**
 * getSecretaryStats - estatísticas resumidas para secretarias
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 *
 * Locals (const/let):
 * - sid (school id), totalStudents, newThisMonth, months
 */
export const getSecretaryStats = async (req, res) => {
  const sid = req.schoolId
  try {
    const [[{ totalStudents }]] = await pool.query('SELECT COUNT(*) as totalStudents FROM students WHERE school_id = ?', [sid])
    const [[{ newThisMonth }]]  = await pool.query(
      `SELECT COUNT(*) as newThisMonth FROM students
       WHERE school_id = ? AND MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE())`,
      [sid]
    )
    const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
    res.json({ totalStudents, newThisMonth, currentMonth: months[new Date().getMonth()] })
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error)
    res.status(500).json({ message: 'Erro ao buscar estatísticas' })
  }
}

/**
 * getAllClasses - lista turmas com filtros
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 *
 * Locals (const/let):
 * - sid (school id), search, status, conditions, params, where, query, classes
 */
export const getAllClasses = async (req, res) => {
  const sid = req.schoolId
  try {
    const { search, status } = req.query
    const conditions = ['c.school_id = ?']; const params = [sid]
    if (search)              { conditions.push('c.name LIKE ?');   params.push(`%${search}%`) }
    if (status === 'active')   conditions.push('c.is_active = 1')
    if (status === 'inactive') conditions.push('c.is_active = 0')
    const where = ' WHERE ' + conditions.join(' AND ')
    const query = `SELECT c.id, c.name, c.schedule, c.classroom, c.is_active,
                          u.full_name AS teacher_name, COUNT(cs.student_id) AS total_students
                   FROM classes c
                   LEFT JOIN users u ON u.id = c.teacher_id
                   LEFT JOIN class_students cs ON cs.class_id = c.id
                   ${where} GROUP BY c.id ORDER BY c.is_active DESC, c.name`
    const [classes] = await pool.query(query, params)
    res.json(classes)
  } catch (error) {
    console.error('Erro ao listar turmas:', error)
    res.status(500).json({ message: 'Erro ao listar turmas' })
  }
}

/**
 * createClass - cria uma turma e associa alunos opcionais
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 *
 * Locals (const/let):
 * - name, schedule, teacher_id, classroom, students, sid
 * - conn, result, classId, rows
 */
export const createClass = async (req, res) => {
  const { name, schedule, teacher_id, classroom, students } = req.body || {}
  const sid = req.schoolId
  if (!name) return res.status(400).json({ message: 'Nome da turma é obrigatório' })
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [result] = await conn.query(
      'INSERT INTO classes (name, schedule, teacher_id, classroom, is_active, school_id) VALUES (?, ?, ?, ?, 1, ?)',
      [name, schedule || null, teacher_id || null, classroom || null, sid]
    )
    const classId = result.insertId
    if (Array.isArray(students) && students.length > 0) {
      const rows = students.map(sid => [classId, sid])
      await conn.query('INSERT IGNORE INTO class_students (class_id, student_id) VALUES ?', [rows])
    }
    await conn.commit()
    res.status(201).json({ id: classId, message: 'Turma criada com sucesso' })
  } catch (error) {
    await conn.rollback()
    console.error('Erro ao criar turma:', error)
    res.status(500).json({ message: 'Erro ao criar turma' })
  } finally { conn.release() }
}

/**
 * updateClass - atualiza dados da turma e substitui lista de alunos quando fornecida
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 *
 * Locals (const/let):
 * - id, sid, name, schedule, teacher_id, classroom, is_active, students
 * - conn, fields, values, cls, rows
 */
export const updateClass = async (req, res) => {
  const { id } = req.params; const sid = req.schoolId
  const { name, schedule, teacher_id, classroom, is_active, students } = req.body || {}
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const fields = []; const values = []
    if (name       !== undefined) { fields.push('name = ?');       values.push(name) }
    if (schedule   !== undefined) { fields.push('schedule = ?');   values.push(schedule || null) }
    if (teacher_id !== undefined) { fields.push('teacher_id = ?'); values.push(teacher_id || null) }
    if (classroom  !== undefined) { fields.push('classroom = ?');  values.push(classroom || null) }
    if (is_active  !== undefined) { fields.push('is_active = ?');  values.push(is_active ? 1 : 0) }
    if (fields.length > 0) await conn.query(`UPDATE classes SET ${fields.join(', ')} WHERE id = ? AND school_id = ?`, [...values, id, sid])
    if (Array.isArray(students)) {
      // Verifica que a turma pertence à escola antes de manipular alunos
      const [[cls]] = await conn.query('SELECT id FROM classes WHERE id = ? AND school_id = ?', [id, sid])
      if (!cls) { await conn.rollback(); return res.status(404).json({ message: 'Turma não encontrada' }) }
      await conn.query('DELETE FROM class_students WHERE class_id = ?', [id])
      if (students.length > 0) {
        const rows = students.map(sId => [id, sId])
        await conn.query('INSERT IGNORE INTO class_students (class_id, student_id) VALUES ?', [rows])
      }
    }
    await conn.commit()
    res.json({ message: 'Turma atualizada com sucesso' })
  } catch (error) {
    await conn.rollback()
    console.error('Erro ao atualizar turma:', error)
    res.status(500).json({ message: 'Erro ao atualizar turma' })
  } finally { conn.release() }
}

/**
 * toggleClassActive - alterna status ativo/inativo de uma turma
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 *
 * Locals (const/let):
 * - sid (school id), cls, newStatus
 */
export const toggleClassActive = async (req, res) => {
  const sid = req.schoolId
  try {
    const [[cls]] = await pool.query('SELECT is_active FROM classes WHERE id = ? AND school_id = ?', [req.params.id, sid])
    if (!cls) return res.status(404).json({ message: 'Turma não encontrada' })
    const newStatus = cls.is_active ? 0 : 1
    await pool.query('UPDATE classes SET is_active = ? WHERE id = ? AND school_id = ?', [newStatus, req.params.id, sid])
    res.json({ is_active: newStatus, message: newStatus ? 'Turma reativada' : 'Turma desativada' })
  } catch (error) {
    console.error('Erro ao alterar status da turma:', error)
    res.status(500).json({ message: 'Erro ao alterar status da turma' })
  }
}

/**
 * getClassStudentsList - lista alunos de uma turma (verifica pertença à escola)
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 *
 * Locals (const/let):
 * - sid (school id), cls, students
 */
export const getClassStudentsList = async (req, res) => {
  const sid = req.schoolId
  try {
    // Garante que a turma pertence à escola antes de listar os alunos
    const [[cls]] = await pool.query('SELECT id FROM classes WHERE id = ? AND school_id = ?', [req.params.id, sid])
    if (!cls) return res.status(404).json({ message: 'Turma não encontrada' })
    const [students] = await pool.query(
      `SELECT s.id, s.full_name, s.email, s.cpf FROM students s
       JOIN class_students cs ON cs.student_id = s.id
       WHERE cs.class_id = ? AND s.school_id = ? ORDER BY s.full_name`,
      [req.params.id, sid]
    )
    res.json(students)
  } catch (error) { 
    console.error('Erro ao listar alunos da turma:', error)
    res.status(500).json({ message: 'Erro ao listar alunos da turma' }) }
}

/**
 * addStudentToClass - adiciona um aluno a uma turma validando pertença à escola
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 *
 * Locals (const/let):
 * - student_id, sid, cls, stu
 */
export const addStudentToClass = async (req, res) => {
  const { student_id } = req.body || {}
  const sid = req.schoolId
  if (!student_id) return res.status(400).json({ message: 'student_id é obrigatório' })
  try {
    // Verifica que a turma e o aluno pertencem à mesma escola
    const [[cls]] = await pool.query('SELECT id FROM classes WHERE id = ? AND school_id = ?', [req.params.id, sid])
    if (!cls) return res.status(404).json({ message: 'Turma não encontrada' })
    const [[stu]] = await pool.query('SELECT id FROM students WHERE id = ? AND school_id = ?', [student_id, sid])
    if (!stu) return res.status(404).json({ message: 'Aluno não encontrado' })
    await pool.query('INSERT IGNORE INTO class_students (class_id, student_id) VALUES (?, ?)', [req.params.id, student_id])
    res.json({ message: 'Aluno adicionado à turma' })
  } catch (error) { 
    console.error('Erro ao adicionar aluno:', error)
    res.status(500).json({ message: 'Erro ao adicionar aluno' }) 
  }
}

/**
 * removeStudentFromClass - remove um aluno de uma turma (verifica pertença à escola)
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 *
 * Locals (const/let):
 * - sid (school id), cls
 */
export const removeStudentFromClass = async (req, res) => {
  const sid = req.schoolId
  try {
    // Garante que a turma pertence à escola antes de remover
    const [[cls]] = await pool.query('SELECT id FROM classes WHERE id = ? AND school_id = ?', [req.params.id, sid])
    if (!cls) return res.status(404).json({ message: 'Turma não encontrada' })
    await pool.query('DELETE FROM class_students WHERE class_id = ? AND student_id = ?', [req.params.id, req.params.studentId])
    res.json({ message: 'Aluno removido da turma' })
  } catch (error) { res.status(500).json({ message: 'Erro ao remover aluno' }) }
}
