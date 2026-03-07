import pool from '../database/connection.js'

// Middleware auxiliar – garante que só alunos acessam
export function isStudent(req, res, next) {
  if (req.userRole !== 'STUDENT') {
    return res.status(403).json({ message: 'Acesso permitido apenas para alunos.' })
  }
  next()
}

// GET /student/profile
// Retorna os dados do próprio aluno (sem hash de senha)
export async function getMyProfile(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT s.id, s.full_name, s.email, s.phone, s.cpf, s.rg,
              s.birth_date, s.address, s.due_day,
              r.full_name AS responsible_name, r.email AS responsible_email,
              r.phone AS responsible_phone
       FROM students s
       LEFT JOIN responsibles r ON s.responsible_id = r.id
       WHERE s.id = ?`,
      [req.userId]
    )
    if (rows.length === 0) return res.status(404).json({ message: 'Aluno não encontrado' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Erro ao buscar perfil' })
  }
}

// GET /student/classes
// Retorna as turmas em que o aluno está matriculado
export async function getMyClasses(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT c.id, c.name, c.schedule,
              u.full_name AS teacher_name
       FROM classes c
       INNER JOIN class_students cs ON c.id = cs.class_id
       LEFT JOIN users u ON c.teacher_id = u.id
       WHERE cs.student_id = ?
       ORDER BY c.name`,
      [req.userId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Erro ao buscar turmas' })
  }
}

// GET /student/classes/:classId
// Retorna detalhes de uma turma específica do aluno
export async function getMyClassDetails(req, res) {
  try {
    // Verifica se o aluno está matriculado nessa turma
    const [enrolled] = await pool.query(
      `SELECT 1 FROM class_students WHERE class_id = ? AND student_id = ?`,
      [req.params.classId, req.userId]
    )
    if (enrolled.length === 0) {
      return res.status(403).json({ message: 'Você não está matriculado nesta turma.' })
    }

    const [classRows] = await pool.query(
      `SELECT c.id, c.name, c.schedule,
              u.full_name AS teacher_name, u.email AS teacher_email
       FROM classes c
       LEFT JOIN users u ON c.teacher_id = u.id
       WHERE c.id = ?`,
      [req.params.classId]
    )
    if (classRows.length === 0) return res.status(404).json({ message: 'Turma não encontrada' })

    // Atividades da turma com nota do aluno (se houver)
    const [assignments] = await pool.query(
      `SELECT a.id, a.title, a.type, a.max_score, a.due_date, a.description,
              g.score
       FROM assignments a
       LEFT JOIN grades g ON a.id = g.assignments_id AND g.student_id = ?
       WHERE a.class_id = ?
       ORDER BY a.due_date ASC`,
      [req.userId, req.params.classId]
    )

    res.json({ ...classRows[0], assignments })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Erro ao buscar detalhes da turma' })
  }
}

// GET /student/assignments
// Retorna todas as atividades pendentes (sem nota e prazo futuro ou hoje)
export async function getMyAssignments(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT a.id, a.title, a.type, a.max_score, a.due_date, a.description,
              c.name AS class_name,
              g.score
       FROM assignments a
       INNER JOIN classes c ON a.class_id = c.id
       INNER JOIN class_students cs ON c.id = cs.class_id
       LEFT JOIN grades g ON a.id = g.assignments_id AND g.student_id = ?
       WHERE cs.student_id = ?
       ORDER BY a.due_date ASC`,
      [req.userId, req.userId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Erro ao buscar atividades' })
  }
}
