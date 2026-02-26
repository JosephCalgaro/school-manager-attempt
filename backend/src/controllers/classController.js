import pool from '../database/connection.js'
import { validateClassPayload } from '../utils/validator.js'

// POST /classes - criar nova turma com professor e alunos
export async function createClass(req, res) {
  const errors = validateClassPayload(req.body)
  if (errors.length > 0) {
    return res.status(400).json({ errors })
  }

  const { name, teacherId, schedule, students } = req.body
  const conn = await pool.getConnection()

  try {
    await conn.beginTransaction()

    // cria a turma
    const [result] = await conn.query(
      'INSERT INTO classes (name, teacher_id, schedule) VALUES (?, ?, ?)',
      [name, teacherId, schedule]
    )
    const classId = result.insertId

    // matricula os alunos na turma
    if (students.length > 0) {
      const values = students.map(sid => [classId, sid])
      await conn.query(
        'INSERT INTO class_students (class_id, student_id) VALUES ?',
        [values]
      )
    }

    await conn.commit()
    res.status(201).json({ message: 'Turma criada com sucesso', classId })
  } catch (err) {
    await conn.rollback()
    console.error(err)
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Aluno já matriculado nesta turma' })
    }
    res.status(500).json({ error: 'Erro ao criar turma' })
  } finally {
    conn.release()
  }
}

// GET /classes - listar todas as turmas com nome do professor
export async function getClasses(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT c.id, c.name, c.schedule, c.teacher_id,
              u.full_name AS teacher_name
       FROM classes c
       JOIN users u ON c.teacher_id = u.id
       ORDER BY c.name`
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao buscar turmas' })
  }
}

// GET /classes/:id - detalhes de uma turma com professor e alunos
export async function getClassById(req, res) {
  const classId = req.params.id
  try {
    // busca a turma com dados do professor
    const [classRows] = await pool.query(
      `SELECT c.id, c.name, c.schedule, c.teacher_id,
              u.full_name AS teacher_name, u.email AS teacher_email
       FROM classes c
       JOIN users u ON c.teacher_id = u.id
       WHERE c.id = ?`,
      [classId]
    )
    if (classRows.length === 0) {
      return res.status(404).json({ error: 'Turma não encontrada' })
    }

    // busca alunos matriculados
    const [studentRows] = await pool.query(
      `SELECT s.id, s.full_name AS fullName, s.email
       FROM students s
       JOIN class_students cs ON cs.student_id = s.id
       WHERE cs.class_id = ?`,
      [classId]
    )

    res.json({ ...classRows[0], students: studentRows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao buscar detalhes da turma' })
  }
}

// PUT /classes/:id - atualizar turma
export async function updateClass(req, res) {
  const classId = req.params.id
  const { name, teacherId, schedule, students } = req.body
  const conn = await pool.getConnection()

  try {
    await conn.beginTransaction()

    // verifica se a turma existe
    const [existing] = await conn.query('SELECT id FROM classes WHERE id = ?', [classId])
    if (existing.length === 0) {
      await conn.rollback()
      return res.status(404).json({ error: 'Turma não encontrada' })
    }

    // atualiza dados da turma
    const fields = []
    const values = []
    if (name) { fields.push('name = ?'); values.push(name) }
    if (teacherId) { fields.push('teacher_id = ?'); values.push(teacherId) }
    if (schedule) { fields.push('schedule = ?'); values.push(schedule) }

    if (fields.length > 0) {
      await conn.query(
        `UPDATE classes SET ${fields.join(', ')} WHERE id = ?`,
        [...values, classId]
      )
    }

    // se enviou lista de alunos, substitui a matrícula
    if (Array.isArray(students)) {
      await conn.query('DELETE FROM class_students WHERE class_id = ?', [classId])
      if (students.length > 0) {
        const rows = students.map(sid => [classId, sid])
        await conn.query('INSERT INTO class_students (class_id, student_id) VALUES ?', [rows])
      }
    }

    await conn.commit()
    res.json({ message: 'Turma atualizada com sucesso' })
  } catch (err) {
    await conn.rollback()
    console.error(err)
    res.status(500).json({ error: 'Erro ao atualizar turma' })
  } finally {
    conn.release()
  }
}

// DELETE /classes/:id - remover turma
export async function deleteClass(req, res) {
  try {
    const [result] = await pool.query('DELETE FROM classes WHERE id = ?', [req.params.id])
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Turma não encontrada' })
    }
    res.json({ message: 'Turma removida com sucesso' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao remover turma' })
  }
}
