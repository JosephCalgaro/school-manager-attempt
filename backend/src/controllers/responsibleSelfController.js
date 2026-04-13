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

/**
 * isResponsible - middleware que garante role RESPONIBLE
 *
 * Locals:
 * - req.userRole: role do usuário para validação
 */
export function isResponsible(req, res, next) {
  if (req.userRole !== 'RESPONSIBLE') {
    return res.status(403).json({ message: 'Acesso permitido apenas para responsáveis.' })
  }
  next()
}

/**
 * getMyProfileWithStudent - retorna perfil do responsável e um aluno vinculado
 *
 * Locals:
 * - rows: query result rows
 */
export async function getMyProfileWithStudent(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT r.id, r.full_name, r.email, r.phone, r.cpf, r.rg, r.birth_date, r.address,
              s.id AS student_id, s.full_name AS student_name, s.email AS student_email
       FROM responsibles r
       LEFT JOIN students s ON s.responsible_id = r.id AND s.school_id = r.school_id
       WHERE r.id = ? AND r.school_id = ?`,
      [req.userId, req.schoolId]
    )
    if (!rows.length) return res.status(404).json({ message: 'Responsável não encontrado' })
    res.json(rows[0])
  } catch (err) { 
    console.error('Erro ao buscar perfil:', err)
    res.status(500).json({ message: 'Erro ao buscar perfil' }) 
  }
}

/**
 * getMyStudents - lista alunos vinculados ao responsável
 *
 * Locals:
 * - rows: query result rows
 */
export async function getMyStudents(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT s.id, s.full_name, s.email, s.phone, s.cpf, s.rg,
              s.birth_date, s.address, s.due_day
       FROM students s
       WHERE s.responsible_id = ? AND s.school_id = ?`,
      [req.userId, req.schoolId]
    )
    res.json(rows)
  } catch (err) { 
    console.error('Erro ao buscar alunos:', err)
    res.status(500).json({ message: 'Erro ao buscar alunos' }) 
  }
}

/**
 * getMyStudentClasses - lista turmas dos alunos do responsável
 *
 * Locals:
 * - rows: query result rows
 */
export async function getMyStudentClasses(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT c.id, c.name, c.schedule, u.full_name AS teacher_name
       FROM classes c
       INNER JOIN class_students cs ON c.id = cs.class_id
       INNER JOIN students s ON s.id = cs.student_id AND s.responsible_id = ? AND s.school_id = ?
       LEFT JOIN users u ON c.teacher_id = u.id
       WHERE c.school_id = ?
       ORDER BY c.name`,
      [req.userId, req.schoolId, req.schoolId]
    )
    res.json(rows)
  } catch (err) { 
    console.error('Erro ao buscar turmas dos alunos:', err)
    res.status(500).json({ message: 'Erro ao buscar turmas dos alunos' }) 
  }
}

/**
 * getMyStudentClassDetails - detalhes de uma turma, validando matrícula
 *
 * Locals:
 * - enrolled: check row for enrollment
 * - rows: class detail rows
 */
export async function getMyStudentClassDetails(req, res) {
  try {
    const [enrolled] = await pool.query(
      `SELECT 1 FROM class_students cs
       INNER JOIN students s ON cs.student_id = s.id
       WHERE cs.class_id = ? AND s.responsible_id = ? AND s.school_id = ?`,
      [req.params.classId, req.userId, req.schoolId]
    )
    if (!enrolled.length) return res.status(403).json({ message: 'Você não tem acesso a esta turma.' })
    const [rows] = await pool.query(
      `SELECT c.id, c.name, c.schedule, u.full_name AS teacher_name
       FROM classes c LEFT JOIN users u ON c.teacher_id = u.id
       WHERE c.id = ? AND c.school_id = ?`,
      [req.params.classId, req.schoolId]
    )
    if (!rows.length) return res.status(404).json({ message: 'Turma não encontrada.' })
    res.json(rows[0])
  } catch (err) { 
    console.error('Erro ao buscar detalhes da turma:', err)
    res.status(500).json({ message: 'Erro ao buscar detalhes da turma' }) 
  }
}

/**
 * getMyStudentAssignments - lista atividades dos alunos vinculados
 *
 * Locals:
 * - rows: query result rows
 */
export async function getMyStudentAssignments(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT a.id, a.title, a.description, a.type, a.max_score, a.due_date,
              c.name AS class_name, s.id AS student_id, s.full_name AS student_name, g.score
       FROM assignments a
       INNER JOIN classes c         ON c.id = a.class_id
       INNER JOIN class_students cs ON cs.class_id = a.class_id
       INNER JOIN students s        ON s.id = cs.student_id
       LEFT  JOIN grades g          ON g.assignments_id = a.id AND g.student_id = s.id
       WHERE s.responsible_id = ? AND s.school_id = ? AND c.school_id = ?
       ORDER BY a.due_date ASC, s.full_name ASC`,
      [req.userId, req.schoolId, req.schoolId]
    )
    res.json(rows)
  } catch (err) { 
    console.error('Erro ao buscar atividades dos alunos:', err)
    res.status(500).json({ message: 'Erro ao buscar atividades dos alunos' }) 
  }
}
