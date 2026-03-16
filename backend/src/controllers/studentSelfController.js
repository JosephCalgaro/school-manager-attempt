import pool from '../database/connection.js'

export function isStudent(req, res, next) {
  if (req.userRole !== 'STUDENT') {
    return res.status(403).json({ message: 'Acesso permitido apenas para alunos.' })
  }
  next()
}

export async function getMyProfile(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT s.id, s.full_name, s.email, s.phone, s.cpf, s.rg,
              s.birth_date, s.address, s.due_day,
              r.full_name AS responsible_name, r.email AS responsible_email,
              r.phone AS responsible_phone
       FROM students s
       LEFT JOIN responsibles r ON s.responsible_id = r.id
       WHERE s.id = ? AND s.school_id = ?`,
      [req.userId, req.schoolId]
    )
    if (!rows.length) return res.status(404).json({ message: 'Aluno não encontrado' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Erro ao buscar perfil' })
  }
}

export async function getMyClasses(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT c.id, c.name, c.schedule, c.classroom,
              u.full_name AS teacher_name
       FROM classes c
       INNER JOIN class_students cs ON c.id = cs.class_id
       LEFT JOIN users u ON c.teacher_id = u.id
       WHERE cs.student_id = ? AND c.school_id = ?
       ORDER BY c.name`,
      [req.userId, req.schoolId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Erro ao buscar turmas' })
  }
}

export async function getMyClassDetails(req, res) {
  try {
    const [enrolled] = await pool.query(
      `SELECT 1 FROM class_students WHERE class_id = ? AND student_id = ?`,
      [req.params.classId, req.userId]
    )
    if (!enrolled.length) return res.status(403).json({ message: 'Você não está matriculado nesta turma.' })

    const [classRows] = await pool.query(
      `SELECT c.id, c.name, c.schedule, c.classroom, c.teacher_id,
              u.full_name AS teacher_name, u.email AS teacher_email
       FROM classes c
       LEFT JOIN users u ON c.teacher_id = u.id
       WHERE c.id = ? AND c.school_id = ?`,
      [req.params.classId, req.schoolId]
    )
    if (!classRows.length) return res.status(404).json({ message: 'Turma não encontrada' })

    const [assignments] = await pool.query(
      `SELECT a.id, a.title, a.type, a.max_score, a.due_date, a.description, g.score
       FROM assignments a
       LEFT JOIN grades g ON a.id = g.assignments_id AND g.student_id = ?
       WHERE a.class_id = ?
       ORDER BY a.due_date ASC`,
      [req.userId, req.params.classId]
    )

    let assignmentsWithFiles = assignments
    if (assignments.length > 0) {
      const ids = assignments.map(a => a.id)
      const [fileRows] = await pool.query(
        `SELECT id, assignment_id, original_name, stored_name FROM assignment_files WHERE assignment_id IN (?)`,
        [ids]
      ).catch(() => [[]])
      const fileMap = new Map()
      for (const f of fileRows) {
        if (!fileMap.has(f.assignment_id)) fileMap.set(f.assignment_id, [])
        fileMap.get(f.assignment_id).push({
          id: f.id, originalName: f.original_name,
          url: `/uploads/assignments/${f.stored_name}`
        })
      }
      assignmentsWithFiles = assignments.map(a => ({ ...a, files: fileMap.get(a.id) || [] }))
    }

    res.json({ ...classRows[0], assignments: assignmentsWithFiles })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Erro ao buscar detalhes da turma' })
  }
}

export async function getMyAssignments(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT a.id, a.title, a.type, a.max_score, a.due_date, a.description,
              c.name AS class_name, g.score
       FROM assignments a
       INNER JOIN classes c ON a.class_id = c.id
       INNER JOIN class_students cs ON c.id = cs.class_id
       LEFT JOIN grades g ON a.id = g.assignments_id AND g.student_id = ?
       WHERE cs.student_id = ? AND c.school_id = ?
       ORDER BY a.due_date ASC`,
      [req.userId, req.userId, req.schoolId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Erro ao buscar atividades' })
  }
}
