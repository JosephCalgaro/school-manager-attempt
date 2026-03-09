import pool from '../database/connection.js'

export function isResponsible(req, res, next) {
  if (req.userRole !== 'RESPONSIBLE') {
    return res.status(403).json({ message: 'Acesso permitido apenas para responsáveis.' })
  }
  next()
}

// GET /responsible/profile
export async function getMyProfile(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT id, full_name, email, phone, cpf, rg, birth_date, address
       FROM responsibles WHERE id = ?`,
      [req.userId]
    )
    if (rows.length === 0) return res.status(404).json({ message: 'Responsável não encontrado' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Erro ao buscar perfil' })
  }
}

// GET /responsible/profile-with-student
export async function getMyProfileWithStudent(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT r.id, r.full_name, r.email, r.phone, r.cpf, r.rg, r.birth_date, r.address,
              s.id AS student_id, s.full_name AS student_name, s.email AS student_email
       FROM responsibles r
       LEFT JOIN students s ON s.responsible_id = r.id
       WHERE r.id = ?`,
      [req.userId]
    )
    if (rows.length === 0) return res.status(404).json({ message: 'Responsável não encontrado' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Erro ao buscar perfil' })
  }
}

// GET /responsible/students
export async function getMyStudents(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT s.id, s.full_name, s.email, s.phone, s.cpf, s.rg,
              s.birth_date, s.address, s.due_day
       FROM students s
       WHERE s.responsible_id = ?`,
      [req.userId]
    )
    res.json(rows) // 200 com [] quando vazio — comportamento REST correto
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Erro ao buscar alunos' })
  }
}

// GET /responsible/classes
export async function getMyStudentClasses(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT c.id, c.name, c.schedule, u.full_name AS teacher_name
       FROM classes c
       INNER JOIN class_students cs ON c.id = cs.class_id
       LEFT JOIN users u ON c.teacher_id = u.id
       WHERE cs.student_id IN (SELECT id FROM students WHERE responsible_id = ?)
       ORDER BY c.name`,
      [req.userId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Erro ao buscar turmas dos alunos' })
  }
}

// GET /responsible/classes/:classId
export async function getMyStudentClassDetails(req, res) {
  try {
    const [enrolled] = await pool.query(
      `SELECT 1 FROM class_students cs
       INNER JOIN students s ON cs.student_id = s.id
       WHERE cs.class_id = ? AND s.responsible_id = ?`,
      [req.params.classId, req.userId]
    )
    if (enrolled.length === 0) return res.status(403).json({ message: 'Você não tem acesso a esta turma.' })

    const [rows] = await pool.query(
      `SELECT c.id, c.name, c.schedule, u.full_name AS teacher_name
       FROM classes c LEFT JOIN users u ON c.teacher_id = u.id
       WHERE c.id = ?`,
      [req.params.classId]
    )
    if (rows.length === 0) return res.status(404).json({ message: 'Turma não encontrada.' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Erro ao buscar detalhes da turma' })
  }
}

// GET /responsible/assignments
export async function getMyStudentAssignments(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT
         a.id,
         a.title,
         a.description,
         a.type,
         a.max_score,
         a.due_date,
         c.name       AS class_name,
         s.id         AS student_id,
         s.full_name  AS student_name,
         g.score
       FROM assignments a
       INNER JOIN classes c         ON c.id          = a.class_id
       INNER JOIN class_students cs ON cs.class_id   = a.class_id
       INNER JOIN students s        ON s.id           = cs.student_id
       LEFT  JOIN grades g          ON g.assignments_id = a.id
                                   AND g.student_id     = s.id
       WHERE s.responsible_id = ?
       ORDER BY a.due_date ASC, s.full_name ASC`,
      [req.userId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Erro ao buscar atividades dos alunos' })
  }
}
