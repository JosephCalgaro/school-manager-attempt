import pool from '../database/connection.js'
import fs from 'fs/promises'
import path from 'path'

let gradesColumnsCache = null
const uploadsDir = path.resolve(process.cwd(), 'uploads', 'assignments')

function isTeacherRole(role) {
  return String(role || '').toUpperCase() === 'TEACHER'
}

function isAdminRole(role) {
  return String(role || '').toUpperCase() === 'ADMIN'
}

function isValidISODate(value) {
  if (!value || typeof value !== 'string') return false
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  const [y, m, d] = value.split('-').map(Number)
  return date.getUTCFullYear() === y && date.getUTCMonth() + 1 === m && date.getUTCDate() === d
}

function safeFileName(value) {
  const base = String(value || 'arquivo')
  return base.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function buildAttachmentUrl(storedName) {
  return `/uploads/assignments/${storedName}`
}

async function ensureAssignmentFilesTable() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS assignment_files (
      id INT AUTO_INCREMENT PRIMARY KEY,
      assignment_id INT NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      stored_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(150) NULL,
      size_bytes INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  )
}

async function ensureAssignmentCompletionsTable() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS assignment_completions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      assignment_id INT NOT NULL,
      student_id INT NOT NULL,
      completed TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_assignment_student (assignment_id, student_id)
    )`
  )
}

async function ensureStudentNotesTable() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS student_notes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      class_id INT NOT NULL,
      student_id INT NOT NULL,
      note1 DECIMAL(5,2) NULL,
      note2 DECIMAL(5,2) NULL,
      note3 DECIMAL(5,2) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_class_student_notes (class_id, student_id)
    )`
  )
}

async function readAssignmentFiles(assignmentIds) {
  if (!assignmentIds.length) return new Map()
  await ensureAssignmentFilesTable()

  const [rows] = await pool.query(
    `SELECT id, assignment_id AS assignmentId, original_name AS originalName, stored_name AS storedName,
            mime_type AS mimeType, size_bytes AS sizeBytes, created_at AS createdAt
     FROM assignment_files
     WHERE assignment_id IN (?)
     ORDER BY id DESC`,
    [assignmentIds]
  )

  const grouped = new Map()
  for (const row of rows) {
    const item = {
      id: row.id,
      originalName: row.originalName,
      storedName: row.storedName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      createdAt: row.createdAt,
      url: buildAttachmentUrl(row.storedName)
    }
    if (!grouped.has(row.assignmentId)) grouped.set(row.assignmentId, [])
    grouped.get(row.assignmentId).push(item)
  }
  return grouped
}

async function readAssignmentCompletions(assignmentIds, totalStudents) {
  if (!assignmentIds.length) return new Map()
  await ensureAssignmentCompletionsTable()

  const [rows] = await pool.query(
    `SELECT assignment_id AS assignmentId, student_id AS studentId, completed
     FROM assignment_completions
     WHERE assignment_id IN (?)`,
    [assignmentIds]
  )

  const grouped = new Map()
  for (const assignmentId of assignmentIds) {
    grouped.set(assignmentId, {
      byStudent: {},
      completedCount: 0,
      totalStudents
    })
  }

  for (const row of rows) {
    const info = grouped.get(row.assignmentId)
    if (!info) continue
    const completed = Number(row.completed) === 1
    info.byStudent[row.studentId] = completed
    if (completed) info.completedCount += 1
  }

  for (const assignmentId of assignmentIds) {
    const info = grouped.get(assignmentId)
    info.allCompleted = totalStudents > 0 && info.completedCount === totalStudents
    info.pendingCount = Math.max(totalStudents - info.completedCount, 0)
  }

  return grouped
}

async function saveAssignmentFiles(assignmentId, files) {
  if (!Array.isArray(files) || files.length === 0) return []
  await ensureAssignmentFilesTable()
  await fs.mkdir(uploadsDir, { recursive: true })

  const savedFiles = []
  for (const file of files) {
    if (!file?.name || !file?.contentBase64) continue
    const originalName = safeFileName(file.name)
    const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const storedName = `${assignmentId}_${stamp}_${originalName}`
    const buffer = Buffer.from(String(file.contentBase64), 'base64')
    const fullPath = path.join(uploadsDir, storedName)

    await fs.writeFile(fullPath, buffer)
    const [result] = await pool.query(
      `INSERT INTO assignment_files (assignment_id, original_name, stored_name, mime_type, size_bytes)
       VALUES (?, ?, ?, ?, ?)`,
      [assignmentId, file.name, storedName, file.mimeType || null, buffer.length]
    )
    savedFiles.push({
      id: result.insertId,
      originalName: file.name,
      storedName,
      mimeType: file.mimeType || null,
      sizeBytes: buffer.length,
      url: buildAttachmentUrl(storedName)
    })
  }

  return savedFiles
}

async function getAccessibleClass(classId, userId, userRole) {
  const isAdmin = isAdminRole(userRole)
  const query = isAdmin
    ? `SELECT c.id, c.name, c.schedule, c.classroom, c.teacher_id, u.full_name AS teacher_name
       FROM classes c
       JOIN users u ON u.id = c.teacher_id
       WHERE c.id = ?`
    : `SELECT c.id, c.name, c.schedule, c.classroom, c.teacher_id, u.full_name AS teacher_name
       FROM classes c
       JOIN users u ON u.id = c.teacher_id
       WHERE c.id = ? AND c.teacher_id = ?`
  const params = isAdmin ? [classId] : [classId, userId]
  const [rows] = await pool.query(query, params)
  return rows[0] || null
}

async function getGradesColumns() {
  if (gradesColumnsCache) return gradesColumnsCache
  const [rows] = await pool.query('SHOW COLUMNS FROM grades')
  const columns = new Set(rows.map((row) => row.Field))

  const pick = (options) => options.find((item) => columns.has(item)) || null
  gradesColumnsCache = {
    id: pick(['id']),
    student: pick(['student_id', 'studentId']),
    assignment: pick(['assignment_id', 'assignmentId', 'assignments_id', 'activity_id', 'activityId']),
    score: pick(['score', 'grade', 'value'])
  }
  return gradesColumnsCache
}

async function getTeacherClassesWithStats(teacherId, userRole) {
  const isAdmin = isAdminRole(userRole)
  const whereClause = isAdmin ? 'WHERE c.is_active = 1' : 'WHERE c.teacher_id = ? AND c.is_active = 1'
  const params = isAdmin ? [] : [teacherId]
  const [rows] = await pool.query(
    `SELECT
      c.id,
      c.name,
      c.schedule,
      c.classroom,
      COALESCE(cs.total_students, 0) AS totalStudents,
      COALESCE(att.attendance_rate, 0) AS attendanceRate,
      COALESCE(ass.total_assignments, 0) AS totalAssignments
    FROM classes c
    LEFT JOIN (
      SELECT class_id, COUNT(*) AS total_students
      FROM class_students
      GROUP BY class_id
    ) cs ON cs.class_id = c.id
    LEFT JOIN (
      SELECT
        class_id,
        ROUND((SUM(CASE WHEN present = 1 THEN 1 ELSE 0 END) * 100.0) / NULLIF(COUNT(*), 0), 2) AS attendance_rate
      FROM attendance
      GROUP BY class_id
    ) att ON att.class_id = c.id
    LEFT JOIN (
      SELECT class_id, COUNT(*) AS total_assignments
      FROM assignments
      GROUP BY class_id
    ) ass ON ass.class_id = c.id
    ${whereClause}
    ORDER BY c.name`,
    params
  )
  return rows
}

export async function getTeacherStudents(req, res) {
  try {
    const teacherId = req.userId
    const [rows] = await pool.query(
      `SELECT DISTINCT
        s.id,
        s.full_name,
        s.email,
        s.phone,
        c.id   AS class_id,
        c.name AS class_name
      FROM students s
      JOIN class_students cs ON cs.student_id = s.id
      JOIN classes c ON c.id = cs.class_id
      WHERE c.teacher_id = ?
      ORDER BY s.full_name`,
      [teacherId]
    )
    return res.json(rows)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao buscar alunos' })
  }
}

async function getClassAssignments(classId, totalStudents = 0) {
  try {
    const [rows] = await pool.query(
      `SELECT id, title, type, max_score AS maxScore, due_date AS dueDate, description
       FROM assignments
       WHERE class_id = ?
       ORDER BY due_date, id`,
      [classId]
    )
    const assignmentIds = rows.map((item) => item.id)
    const fileMap = await readAssignmentFiles(assignmentIds)
    const completionMap = await readAssignmentCompletions(assignmentIds, totalStudents)
    return rows.map((row) => ({
      ...row,
      files: fileMap.get(row.id) || [],
      completion: completionMap.get(row.id) || {
        byStudent: {},
        completedCount: 0,
        totalStudents,
        allCompleted: false,
        pendingCount: totalStudents
      }
    }))
  } catch (error) {
    if (error.code !== 'ER_BAD_FIELD_ERROR') {
      throw error
    }

    const [rows] = await pool.query(
      `SELECT id, title, due_date AS dueDate, description
       FROM assignments
       WHERE class_id = ?
       ORDER BY due_date, id`,
      [classId]
    )

    const enriched = rows.map((row) => ({
      ...row,
      type: null,
      maxScore: null,
      files: []
    }))
    const assignmentIds = enriched.map((item) => item.id)
    const fileMap = await readAssignmentFiles(assignmentIds)
    const completionMap = await readAssignmentCompletions(assignmentIds, totalStudents)
    return enriched.map((row) => ({
      ...row,
      files: fileMap.get(row.id) || [],
      completion: completionMap.get(row.id) || {
        byStudent: {},
        completedCount: 0,
        totalStudents,
        allCompleted: false,
        pendingCount: totalStudents
      }
    }))
  }
}

async function getClassStudents(classId) {
  let students = []
  try {
    const [rows] = await pool.query(
      `SELECT
        s.id,
        s.full_name AS fullName,
        s.email
      FROM class_students cs
      JOIN students s ON s.id = cs.student_id
      WHERE cs.class_id = ?
      ORDER BY s.full_name`,
      [classId]
    )
    students = rows
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') return []
    throw error
  }

  let attendanceMap = new Map()
  try {
    const [attendanceRows] = await pool.query(
      `SELECT
        student_id AS studentId,
        ROUND((SUM(CASE WHEN present = 1 THEN 1 ELSE 0 END) * 100.0) / NULLIF(COUNT(*), 0), 2) AS attendanceRate
      FROM attendance
      WHERE class_id = ?
      GROUP BY student_id`,
      [classId]
    )
    attendanceMap = new Map(attendanceRows.map((row) => [Number(row.studentId), Number(row.attendanceRate || 0)]))
  } catch (error) {
    if (!['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(error.code)) {
      throw error
    }
  }

  return students.map((row) => ({
    ...row,
    attendanceRate: attendanceMap.get(Number(row.id)) || 0
  }))
}

async function getClassGrades(classId) {
  try {
    const gradeCols = await getGradesColumns()
    if (!gradeCols.student || !gradeCols.assignment || !gradeCols.score) {
      return []
    }

    const [rows] = await pool.query(
      `SELECT g.\`${gradeCols.student}\` AS studentId, g.\`${gradeCols.assignment}\` AS assignmentId, g.\`${gradeCols.score}\` AS score
       FROM grades g
       JOIN assignments a ON a.id = g.\`${gradeCols.assignment}\`
       WHERE a.class_id = ?`,
      [classId]
    )
    return rows
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_FIELD_ERROR') {
      return []
    }
    throw error
  }
}

async function getClassNotes(classId) {
  try {
    await ensureStudentNotesTable()
    const [rows] = await pool.query(
      `SELECT student_id AS studentId, note1, note2, note3
       FROM student_notes
       WHERE class_id = ?`,
      [classId]
    )
    return rows
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') return []
    throw error
  }
}

function addNotesToStudents(students, notes) {
  const byStudent = new Map(notes.map((item) => [Number(item.studentId), item]))
  return students.map((student) => {
    const note = byStudent.get(Number(student.id))
    const note1 = note?.note1 === null || note?.note1 === undefined ? null : Number(note.note1)
    const note2 = note?.note2 === null || note?.note2 === undefined ? null : Number(note.note2)
    const note3 = note?.note3 === null || note?.note3 === undefined ? null : Number(note.note3)
    const available = [note1, note2, note3].filter((value) => typeof value === 'number')
    const average = available.length > 0 ? Number((available.reduce((acc, val) => acc + val, 0) / available.length).toFixed(2)) : null
    return {
      ...student,
      note1,
      note2,
      note3,
      average
    }
  })
}

export function isTeacher(req, res, next) {
  if (!isTeacherRole(req.userRole) && !isAdminRole(req.userRole)) {
    return res.status(403).json({ error: 'Acesso negado. Apenas professores ou administradores.' })
  }
  next()
}

export async function getTeacherStats(req, res) {
  try {
    const teacherId = req.userId
    const isAdmin = isAdminRole(req.userRole)
    const classes = await getTeacherClassesWithStats(teacherId, req.userRole)

    const [studentsRows] = await pool.query(
      `SELECT COUNT(DISTINCT cs.student_id) AS totalStudents
       FROM classes c
       JOIN class_students cs ON cs.class_id = c.id
       ${isAdmin ? '' : 'WHERE c.teacher_id = ?'}`,
      isAdmin ? [] : [teacherId]
    )

    const [assignmentsRows] = await pool.query(
      `SELECT COUNT(*) AS upcomingAssignments
       FROM assignments a
       JOIN classes c ON c.id = a.class_id
       ${isAdmin ? 'WHERE a.due_date >= CURDATE()' : 'WHERE c.teacher_id = ? AND a.due_date >= CURDATE()'}`,
      isAdmin ? [] : [teacherId]
    )

    res.json({
      totalStudents: Number(studentsRows[0]?.totalStudents || 0),
      totalClasses: classes.length,
      upcomingAssignments: Number(assignmentsRows[0]?.upcomingAssignments || 0),
      classes
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao buscar estatísticas do professor' })
  }
}

export async function getTeacherClasses(req, res) {
  try {
    const classes = await getTeacherClassesWithStats(req.userId, req.userRole)
    res.json(classes)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao buscar turmas do professor' })
  }
}

export async function getTeacherClassById(req, res) {
  const classId = Number(req.params.id)
  if (!Number.isInteger(classId)) {
    return res.status(400).json({ error: 'ID da turma inválido' })
  }

  try {
    const classInfo = await getAccessibleClass(classId, req.userId, req.userRole)
    if (!classInfo) {
      return res.status(404).json({ error: 'Turma não encontrada para este professor' })
    }

    let totalStudents = 0
    try {
      const [studentCountRows] = await pool.query(
        `SELECT COUNT(*) AS totalStudents
         FROM class_students
         WHERE class_id = ?`,
        [classId]
      )
      totalStudents = Number(studentCountRows[0]?.totalStudents || 0)
    } catch (error) {
      if (error.code !== 'ER_NO_SUCH_TABLE') throw error
    }

    let attendanceRate = 0
    try {
      const [attendanceRows] = await pool.query(
        `SELECT
          ROUND((SUM(CASE WHEN present = 1 THEN 1 ELSE 0 END) * 100.0) / NULLIF(COUNT(*), 0), 2) AS attendanceRate
         FROM attendance
         WHERE class_id = ?`,
        [classId]
      )
      attendanceRate = Number(attendanceRows[0]?.attendanceRate || 0)
    } catch (error) {
      if (!['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(error.code)) {
        throw error
      }
    }

    const students = await getClassStudents(classId)
    const assignments = await getClassAssignments(classId, totalStudents)
    const notes = await getClassNotes(classId)

    res.json({
      ...classInfo,
      totalStudents,
      attendanceRate,
      assignments,
      students: addNotesToStudents(students, notes)
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({
      error: 'Erro ao buscar detalhes da turma',
      details: error.message
    })
  }
}

export async function getTeacherClassStudents(req, res) {
  const classId = Number(req.params.id)
  if (!Number.isInteger(classId)) {
    return res.status(400).json({ error: 'ID da turma inválido' })
  }

  try {
    const classInfo = await getAccessibleClass(classId, req.userId, req.userRole)
    if (!classInfo) {
      return res.status(404).json({ error: 'Turma não encontrada para este professor' })
    }

    const students = await getClassStudents(classId)
    const assignments = await getClassAssignments(classId, students.length)
    const notes = await getClassNotes(classId)

    res.json({
      classId,
      assignments,
      students: addNotesToStudents(students, notes)
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao buscar alunos da turma' })
  }
}

export async function registerClassAttendance(req, res) {
  const classId = Number(req.params.id)
  const records = Array.isArray(req.body) ? req.body : req.body?.records
  if (!Number.isInteger(classId)) {
    return res.status(400).json({ error: 'ID da turma inválido' })
  }
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'Envie um array records com ao menos um item' })
  }

  try {
    const classInfo = await getAccessibleClass(classId, req.userId, req.userRole)
    if (!classInfo) {
      return res.status(404).json({ error: 'Turma não encontrada para este professor' })
    }

    const [studentRows] = await pool.query(
      'SELECT student_id AS studentId FROM class_students WHERE class_id = ?',
      [classId]
    )
    const studentIds = new Set(studentRows.map((row) => row.studentId))

    for (const item of records) {
      if (!Number.isInteger(Number(item.studentId))) {
        return res.status(400).json({ error: 'studentId inválido em records' })
      }
      if (typeof item.present !== 'boolean') {
        return res.status(400).json({ error: 'present deve ser boolean em records' })
      }
      if (item.date && !isValidISODate(item.date)) {
        return res.status(400).json({ error: 'date deve estar no formato YYYY-MM-DD' })
      }
      if (!studentIds.has(Number(item.studentId))) {
        return res.status(400).json({ error: `Aluno ${item.studentId} não pertence a esta turma` })
      }
    }

    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      for (const item of records) {
        const studentId = Number(item.studentId)
        const date = item.date || new Date().toISOString().slice(0, 10)
        const present = item.present ? 1 : 0

        const [existingRows] = await conn.query(
          'SELECT id FROM attendance WHERE class_id = ? AND student_id = ? AND date = ? ORDER BY id DESC LIMIT 1',
          [classId, studentId, date]
        )

        if (existingRows.length > 0) {
          await conn.query(
            'UPDATE attendance SET present = ? WHERE id = ?',
            [present, existingRows[0].id]
          )
        } else {
          await conn.query(
            'INSERT INTO attendance (class_id, student_id, date, present) VALUES (?, ?, ?, ?)',
            [classId, studentId, date, present]
          )
        }
      }

      await conn.commit()
      return res.status(201).json({ message: 'Presença registrada com sucesso' })
    } catch (error) {
      await conn.rollback()
      console.error(error)
      return res.status(500).json({ error: 'Erro ao registrar presença' })
    } finally {
      conn.release()
    }
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'Erro ao registrar presença' })
  }
}

export async function upsertClassGrade(req, res) {
  const classId = Number(req.params.id)
  const { studentId, assignmentId, score } = req.body || {}

  if (!Number.isInteger(classId)) {
    return res.status(400).json({ error: 'ID da turma inválido' })
  }
  if (!Number.isInteger(Number(studentId))) {
    return res.status(400).json({ error: 'studentId inválido' })
  }
  if (!Number.isInteger(Number(assignmentId))) {
    return res.status(400).json({ error: 'assignmentId inválido' })
  }
  if (typeof score !== 'number' || Number.isNaN(score)) {
    return res.status(400).json({ error: 'score inválido' })
  }

  try {
    const classInfo = await getAccessibleClass(classId, req.userId, req.userRole)
    if (!classInfo) {
      return res.status(404).json({ error: 'Turma não encontrada para este professor' })
    }

    const gradeCols = await getGradesColumns()
    if (!gradeCols.student || !gradeCols.assignment || !gradeCols.score) {
      return res.status(500).json({ error: 'Tabela de notas incompatível com o módulo de professor' })
    }

    let assignmentRows
    try {
      ;[assignmentRows] = await pool.query(
        'SELECT id, max_score AS maxScore FROM assignments WHERE id = ? AND class_id = ?',
        [assignmentId, classId]
      )
    } catch (error) {
      if (error.code !== 'ER_BAD_FIELD_ERROR') throw error
      ;[assignmentRows] = await pool.query(
        'SELECT id, NULL AS maxScore FROM assignments WHERE id = ? AND class_id = ?',
        [assignmentId, classId]
      )
    }
    if (assignmentRows.length === 0) {
      return res.status(404).json({ error: 'Atividade não pertence a esta turma' })
    }

    if (assignmentRows[0].maxScore !== null && Number(score) > Number(assignmentRows[0].maxScore)) {
      return res.status(400).json({ error: `score não pode ser maior que ${assignmentRows[0].maxScore}` })
    }
    if (Number(score) < 0) {
      return res.status(400).json({ error: 'score não pode ser negativo' })
    }

    const [studentRows] = await pool.query(
      'SELECT 1 FROM class_students WHERE class_id = ? AND student_id = ? LIMIT 1',
      [classId, studentId]
    )
    if (studentRows.length === 0) {
      return res.status(400).json({ error: 'Aluno não pertence a esta turma' })
    }

    const selectExistingSql = gradeCols.id
      ? `SELECT \`${gradeCols.id}\` AS id
         FROM grades
         WHERE \`${gradeCols.student}\` = ? AND \`${gradeCols.assignment}\` = ?
         ORDER BY \`${gradeCols.id}\` DESC
         LIMIT 1`
      : `SELECT 1 AS existsRow
         FROM grades
         WHERE \`${gradeCols.student}\` = ? AND \`${gradeCols.assignment}\` = ?
         LIMIT 1`

    const [gradeRows] = await pool.query(selectExistingSql, [studentId, assignmentId])

    if (gradeRows.length > 0) {
      if (gradeCols.id) {
        await pool.query(
          `UPDATE grades SET \`${gradeCols.score}\` = ? WHERE \`${gradeCols.id}\` = ?`,
          [score, gradeRows[0].id]
        )
      } else {
        await pool.query(
          `UPDATE grades
           SET \`${gradeCols.score}\` = ?
           WHERE \`${gradeCols.student}\` = ? AND \`${gradeCols.assignment}\` = ?`,
          [score, studentId, assignmentId]
        )
      }
    } else {
      await pool.query(
        `INSERT INTO grades (\`${gradeCols.student}\`, \`${gradeCols.assignment}\`, \`${gradeCols.score}\`)
         VALUES (?, ?, ?)`,
        [studentId, assignmentId, score]
      )
    }

    res.status(201).json({ message: 'Nota registrada com sucesso' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao registrar nota' })
  }
}

export async function upsertStudentNotes(req, res) {
  const classId = Number(req.params.id)
  const { studentId, note1, note2, note3 } = req.body || {}

  if (!Number.isInteger(classId)) {
    return res.status(400).json({ error: 'ID da turma inválido' })
  }
  if (!Number.isInteger(Number(studentId))) {
    return res.status(400).json({ error: 'studentId inválido' })
  }

  const parseNote = (value, label) => {
    if (value === null || value === undefined || value === '') return null
    const parsed = Number(value)
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 10) {
      throw new Error(`${label} deve ser um número entre 0 e 10`)
    }
    return parsed
  }

  try {
    const classInfo = await getAccessibleClass(classId, req.userId, req.userRole)
    if (!classInfo) {
      return res.status(404).json({ error: 'Turma não encontrada para este professor' })
    }

    const [studentRows] = await pool.query(
      'SELECT 1 FROM class_students WHERE class_id = ? AND student_id = ? LIMIT 1',
      [classId, studentId]
    )
    if (studentRows.length === 0) {
      return res.status(400).json({ error: 'Aluno não pertence a esta turma' })
    }

    const n1 = parseNote(note1, 'Nota 1')
    const n2 = parseNote(note2, 'Nota 2')
    const n3 = parseNote(note3, 'Nota 3')

    await ensureStudentNotesTable()
    await pool.query(
      `INSERT INTO student_notes (class_id, student_id, note1, note2, note3)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE note1 = VALUES(note1), note2 = VALUES(note2), note3 = VALUES(note3)`,
      [classId, studentId, n1, n2, n3]
    )

    res.status(201).json({ message: 'Notas atualizadas com sucesso' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: error.message || 'Erro ao salvar notas' })
  }
}

export async function upsertAssignmentCompletions(req, res) {
  const classId = Number(req.params.id)
  const assignmentId = Number(req.params.assignmentId)
  const records = Array.isArray(req.body) ? req.body : req.body?.records

  if (!Number.isInteger(classId) || !Number.isInteger(assignmentId)) {
    return res.status(400).json({ error: 'IDs inválidos' })
  }
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'Envie records com ao menos um aluno' })
  }

  try {
    const classInfo = await getAccessibleClass(classId, req.userId, req.userRole)
    if (!classInfo) return res.status(404).json({ error: 'Turma não encontrada para este professor' })

    const [assignmentRows] = await pool.query(
      'SELECT id FROM assignments WHERE id = ? AND class_id = ?',
      [assignmentId, classId]
    )
    if (assignmentRows.length === 0) {
      return res.status(404).json({ error: 'Atividade não encontrada para esta turma' })
    }

    const [studentRows] = await pool.query(
      'SELECT student_id AS studentId FROM class_students WHERE class_id = ?',
      [classId]
    )
    const studentIds = new Set(studentRows.map((row) => Number(row.studentId)))

    await ensureAssignmentCompletionsTable()
    for (const item of records) {
      if (!Number.isInteger(Number(item.studentId))) {
        return res.status(400).json({ error: 'studentId inválido em records' })
      }
      if (typeof item.completed !== 'boolean') {
        return res.status(400).json({ error: 'completed deve ser boolean em records' })
      }
      if (!studentIds.has(Number(item.studentId))) {
        return res.status(400).json({ error: `Aluno ${item.studentId} não pertence a esta turma` })
      }

      await pool.query(
        `INSERT INTO assignment_completions (assignment_id, student_id, completed)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE completed = VALUES(completed)`,
        [assignmentId, Number(item.studentId), item.completed ? 1 : 0]
      )
    }

    res.status(201).json({ message: 'Realização da atividade atualizada com sucesso' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao atualizar realização da atividade' })
  }
}

export async function createClassAssignment(req, res) {
  const classId = Number(req.params.id)
  const { title, description, dueDate, type, maxScore, files } = req.body || {}

  if (!Number.isInteger(classId)) {
    return res.status(400).json({ error: 'ID da turma inválido' })
  }
  if (!title || String(title).trim() === '') {
    return res.status(400).json({ error: 'title é obrigatório' })
  }
  if (!isValidISODate(dueDate)) {
    return res.status(400).json({ error: 'dueDate deve estar no formato YYYY-MM-DD' })
  }

  try {
    const classInfo = await getAccessibleClass(classId, req.userId, req.userRole)
    if (!classInfo) {
      return res.status(404).json({ error: 'Turma não encontrada para este professor' })
    }

    const normalizedType = String(type || 'WORK').toUpperCase()
    const assignmentType = ['WORK', 'EXAM'].includes(normalizedType) ? normalizedType : 'WORK'

    const parsedMaxScore = maxScore === null || maxScore === undefined || maxScore === ''
      ? 10
      : Number(maxScore)

    if (Number.isNaN(parsedMaxScore) || parsedMaxScore < 0) {
      return res.status(400).json({ error: 'maxScore inválido' })
    }

    let result
    try {
      ;[result] = await pool.query(
        `INSERT INTO assignments (title, type, max_score, due_date, description, class_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [String(title).trim(), assignmentType, parsedMaxScore, dueDate, description || null, classId]
      )
    } catch (error) {
      if (error.code !== 'ER_BAD_FIELD_ERROR') throw error
      ;[result] = await pool.query(
        `INSERT INTO assignments (title, due_date, description, class_id)
         VALUES (?, ?, ?, ?)`,
        [String(title).trim(), dueDate, description || null, classId]
      )
    }

    const savedFiles = await saveAssignmentFiles(result.insertId, files)
    res.status(201).json({ id: result.insertId, files: savedFiles, message: 'Atividade criada com sucesso' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao criar atividade', details: error.message })
  }
}

export async function updateClassAssignment(req, res) {
  const classId = Number(req.params.id)
  const assignmentId = Number(req.params.assignmentId)
  const { title, description, dueDate, type, maxScore, files } = req.body || {}

  if (!Number.isInteger(classId) || !Number.isInteger(assignmentId)) {
    return res.status(400).json({ error: 'IDs inválidos' })
  }

  try {
    const classInfo = await getAccessibleClass(classId, req.userId, req.userRole)
    if (!classInfo) {
      return res.status(404).json({ error: 'Turma não encontrada para este professor' })
    }

    const [existsRows] = await pool.query(
      'SELECT id FROM assignments WHERE id = ? AND class_id = ?',
      [assignmentId, classId]
    )
    if (existsRows.length === 0) {
      return res.status(404).json({ error: 'Atividade não encontrada para esta turma' })
    }

    const fields = []
    const values = []
    if (title !== undefined) {
      fields.push('title = ?')
      values.push(String(title).trim())
    }
    if (description !== undefined) {
      fields.push('description = ?')
      values.push(description || null)
    }
    if (dueDate !== undefined) {
      if (!isValidISODate(dueDate)) {
        return res.status(400).json({ error: 'dueDate deve estar no formato YYYY-MM-DD' })
      }
      fields.push('due_date = ?')
      values.push(dueDate)
    }
    if (maxScore !== undefined) {
      const parsedMaxScore = maxScore === null || maxScore === '' ? 10 : Number(maxScore)
      if (Number.isNaN(parsedMaxScore) || parsedMaxScore < 0) {
        return res.status(400).json({ error: 'maxScore inválido' })
      }
      fields.push('max_score = ?')
      values.push(parsedMaxScore)
    }
    if (type !== undefined) {
      const normalizedType = String(type).toUpperCase()
      const assignmentType = ['WORK', 'EXAM'].includes(normalizedType) ? normalizedType : 'WORK'
      fields.push('type = ?')
      values.push(assignmentType)
    }

    if (fields.length > 0) {
      try {
        await pool.query(
          `UPDATE assignments SET ${fields.join(', ')} WHERE id = ? AND class_id = ?`,
          [...values, assignmentId, classId]
        )
      } catch (error) {
        if (error.code !== 'ER_BAD_FIELD_ERROR') throw error
        const basicFields = []
        const basicValues = []
        fields.forEach((field, index) => {
          if (field === 'type = ?' || field === 'max_score = ?') return
          basicFields.push(field)
          basicValues.push(values[index])
        })
        if (basicFields.length > 0) {
          await pool.query(
            `UPDATE assignments SET ${basicFields.join(', ')} WHERE id = ? AND class_id = ?`,
            [...basicValues, assignmentId, classId]
          )
        }
      }
    }

    const savedFiles = await saveAssignmentFiles(assignmentId, files)
    res.json({ message: 'Atividade atualizada com sucesso', files: savedFiles })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao atualizar atividade', details: error.message })
  }
}

export async function deleteClassAssignment(req, res) {
  const classId = Number(req.params.id)
  const assignmentId = Number(req.params.assignmentId)
  if (!Number.isInteger(classId) || !Number.isInteger(assignmentId)) {
    return res.status(400).json({ error: 'IDs inválidos' })
  }

  try {
    const classInfo = await getAccessibleClass(classId, req.userId, req.userRole)
    if (!classInfo) return res.status(404).json({ error: 'Turma não encontrada para este professor' })

    const [filesRows] = await pool.query(
      'SELECT stored_name AS storedName FROM assignment_files WHERE assignment_id = ?',
      [assignmentId]
    ).catch(() => [[]])

    await pool.query('DELETE FROM assignment_files WHERE assignment_id = ?', [assignmentId]).catch(() => {})
    await pool.query('DELETE FROM assignment_completions WHERE assignment_id = ?', [assignmentId]).catch(() => {})
    await pool.query('DELETE FROM grades WHERE assignments_id = ?', [assignmentId]).catch(() => {})
    await pool.query('DELETE FROM grades WHERE assignment_id = ?', [assignmentId]).catch(() => {})

    const [result] = await pool.query(
      'DELETE FROM assignments WHERE id = ? AND class_id = ?',
      [assignmentId, classId]
    )
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Atividade não encontrada para esta turma' })
    }

    for (const file of filesRows) {
      if (!file.storedName) continue
      const fullPath = path.join(uploadsDir, file.storedName)
      await fs.unlink(fullPath).catch(() => {})
    }

    res.json({ message: 'Atividade removida com sucesso' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao remover atividade' })
  }
}

// ─── LESSON PLANS (biblioteca + vínculo por turma) ───────────────────────────

async function ensureLessonPlanTables() {
  // Migração: remover tabela antiga se existir
  await pool.query(`DROP TABLE IF EXISTS lesson_plans`)

  // Biblioteca de templates (por professor)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lesson_plan_templates (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      teacher_id  INT NOT NULL,
      title       VARCHAR(255) NOT NULL,
      description TEXT NULL,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_lpt_teacher (teacher_id)
    )
  `)

  // Instâncias vinculadas a turmas
  await pool.query(`
    CREATE TABLE IF NOT EXISTS class_lesson_plans (
      id               INT AUTO_INCREMENT PRIMARY KEY,
      template_id      INT NOT NULL,
      class_id         INT NOT NULL,
      planned_date     DATE NOT NULL,
      status           ENUM('PLANNED','DONE','CANCELLED') NOT NULL DEFAULT 'PLANNED',
      completion_notes TEXT NULL,
      created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_clp_class    (class_id),
      INDEX idx_clp_template (template_id),
      INDEX idx_clp_date     (planned_date)
    )
  `)
}


// ── TEMPLATES (biblioteca do professor) ──────────────────────────────────────

// GET /teacher/lesson-plans
export async function getMyTemplates(req, res) {
  try {
    await ensureLessonPlanTables()
    const teacherId = isAdminRole(req.userRole) ? null : req.userId
    const [rows] = teacherId
      ? await pool.query(
          `SELECT id, teacher_id, title, description, created_at, updated_at
           FROM lesson_plan_templates WHERE teacher_id = ? ORDER BY title`,
          [teacherId]
        )
      : await pool.query(
          `SELECT t.id, t.teacher_id, u.full_name AS teacher_name, t.title, t.description, t.created_at
           FROM lesson_plan_templates t
           LEFT JOIN users u ON u.id = t.teacher_id
           ORDER BY u.full_name, t.title`
        )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao buscar templates' })
  }
}

// POST /teacher/lesson-plans
export async function createTemplate(req, res) {
  const { title, description } = req.body || {}
  if (!title || String(title).trim() === '')
    return res.status(400).json({ error: 'Título é obrigatório' })
  try {
    await ensureLessonPlanTables()
    const [result] = await pool.query(
      `INSERT INTO lesson_plan_templates (teacher_id, title, description) VALUES (?, ?, ?)`,
      [req.userId, String(title).trim(), description || null]
    )
    const [rows] = await pool.query('SELECT * FROM lesson_plan_templates WHERE id = ?', [result.insertId])
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao criar template' })
  }
}

// PUT /teacher/lesson-plans/:templateId
export async function updateTemplate(req, res) {
  const templateId = Number(req.params.templateId)
  const { title, description } = req.body || {}
  if (!Number.isInteger(templateId)) return res.status(400).json({ error: 'ID inválido' })
  try {
    await ensureLessonPlanTables()
    const whereClause = isAdminRole(req.userRole)
      ? 'WHERE id = ?' : 'WHERE id = ? AND teacher_id = ?'
    const whereParams = isAdminRole(req.userRole)
      ? [templateId] : [templateId, req.userId]

    const [existing] = await pool.query(`SELECT id FROM lesson_plan_templates ${whereClause}`, whereParams)
    if (existing.length === 0) return res.status(404).json({ error: 'Template não encontrado' })

    const fields = []; const values = []
    if (title !== undefined)       { fields.push('title = ?');       values.push(String(title).trim()) }
    if (description !== undefined) { fields.push('description = ?'); values.push(description || null) }
    if (fields.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar' })

    await pool.query(`UPDATE lesson_plan_templates SET ${fields.join(', ')} WHERE id = ?`, [...values, templateId])
    const [rows] = await pool.query('SELECT * FROM lesson_plan_templates WHERE id = ?', [templateId])
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao atualizar template' })
  }
}

// DELETE /teacher/lesson-plans/:templateId
export async function deleteTemplate(req, res) {
  const templateId = Number(req.params.templateId)
  if (!Number.isInteger(templateId)) return res.status(400).json({ error: 'ID inválido' })
  try {
    await ensureLessonPlanTables()
    const whereClause = isAdminRole(req.userRole) ? 'WHERE id = ?' : 'WHERE id = ? AND teacher_id = ?'
    const whereParams = isAdminRole(req.userRole) ? [templateId] : [templateId, req.userId]
    const [result] = await pool.query(`DELETE FROM lesson_plan_templates ${whereClause}`, whereParams)
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Template não encontrado' })
    // desvincula das turmas também
    await pool.query('DELETE FROM class_lesson_plans WHERE template_id = ?', [templateId])
    res.json({ message: 'Template removido com sucesso' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao remover template' })
  }
}

// ── VÍNCULOS (instâncias por turma) ──────────────────────────────────────────

// GET /teacher/classes/:id/lesson-plans
export async function getLessonPlans(req, res) {
  const classId = Number(req.params.id)
  if (!Number.isInteger(classId)) return res.status(400).json({ error: 'ID inválido' })
  try {
    const classInfo = await getAccessibleClass(classId, req.userId, req.userRole)
    if (!classInfo) return res.status(404).json({ error: 'Turma não encontrada' })
    await ensureLessonPlanTables()
    const [rows] = await pool.query(
      `SELECT clp.id, clp.template_id, clp.class_id, clp.planned_date,
              clp.status, clp.completion_notes, clp.created_at,
              t.title, t.description
       FROM class_lesson_plans clp
       JOIN lesson_plan_templates t ON t.id = clp.template_id
       WHERE clp.class_id = ?
       ORDER BY clp.planned_date ASC, clp.id ASC`,
      [classId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao buscar planos da turma' })
  }
}

// POST /teacher/classes/:id/lesson-plans  (vincular template a turma)
export async function createLessonPlan(req, res) {
  const classId = Number(req.params.id)
  const { template_id, planned_date } = req.body || {}
  if (!Number.isInteger(classId)) return res.status(400).json({ error: 'ID inválido' })
  if (!Number.isInteger(Number(template_id))) return res.status(400).json({ error: 'template_id é obrigatório' })
  if (!isValidISODate(planned_date)) return res.status(400).json({ error: 'planned_date deve ser YYYY-MM-DD' })
  try {
    const classInfo = await getAccessibleClass(classId, req.userId, req.userRole)
    if (!classInfo) return res.status(404).json({ error: 'Turma não encontrada' })
    await ensureLessonPlanTables()
    const whereClause = isAdminRole(req.userRole) ? 'WHERE id = ?' : 'WHERE id = ? AND teacher_id = ?'
    const whereParams = isAdminRole(req.userRole) ? [Number(template_id)] : [Number(template_id), req.userId]
    const [tRows] = await pool.query(`SELECT id FROM lesson_plan_templates ${whereClause}`, whereParams)
    if (tRows.length === 0) return res.status(404).json({ error: 'Template não encontrado' })
    const [result] = await pool.query(
      `INSERT INTO class_lesson_plans (template_id, class_id, planned_date) VALUES (?, ?, ?)`,
      [Number(template_id), classId, planned_date]
    )
    const [rows] = await pool.query(
      `SELECT clp.id, clp.template_id, clp.class_id, clp.planned_date,
              clp.status, clp.completion_notes, clp.created_at, t.title, t.description
       FROM class_lesson_plans clp
       JOIN lesson_plan_templates t ON t.id = clp.template_id
       WHERE clp.id = ?`,
      [result.insertId]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao vincular plano' })
  }
}

// PUT /teacher/classes/:id/lesson-plans/:planId  (status / completion_notes / data)
export async function updateLessonPlan(req, res) {
  const classId = Number(req.params.id)
  const planId  = Number(req.params.planId)
  const { planned_date, status, completion_notes } = req.body || {}
  if (!Number.isInteger(classId) || !Number.isInteger(planId))
    return res.status(400).json({ error: 'IDs inválidos' })
  const VALID_STATUS = ['PLANNED', 'DONE', 'CANCELLED']
  if (status !== undefined && !VALID_STATUS.includes(String(status).toUpperCase()))
    return res.status(400).json({ error: `status deve ser: ${VALID_STATUS.join(', ')}` })
  try {
    const classInfo = await getAccessibleClass(classId, req.userId, req.userRole)
    if (!classInfo) return res.status(404).json({ error: 'Turma não encontrada' })
    await ensureLessonPlanTables()
    const [existing] = await pool.query(
      'SELECT id FROM class_lesson_plans WHERE id = ? AND class_id = ?', [planId, classId]
    )
    if (existing.length === 0) return res.status(404).json({ error: 'Vínculo não encontrado nesta turma' })
    const fields = []; const values = []
    if (planned_date !== undefined) {
      if (!isValidISODate(planned_date)) return res.status(400).json({ error: 'planned_date inválido' })
      fields.push('planned_date = ?'); values.push(planned_date)
    }
    if (status !== undefined)           { fields.push('status = ?');           values.push(String(status).toUpperCase()) }
    if (completion_notes !== undefined) { fields.push('completion_notes = ?'); values.push(completion_notes || null) }
    if (fields.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar' })
    await pool.query(`UPDATE class_lesson_plans SET ${fields.join(', ')} WHERE id = ?`, [...values, planId])
    const [rows] = await pool.query(
      `SELECT clp.id, clp.template_id, clp.class_id, clp.planned_date,
              clp.status, clp.completion_notes, clp.created_at, t.title, t.description
       FROM class_lesson_plans clp
       JOIN lesson_plan_templates t ON t.id = clp.template_id
       WHERE clp.id = ?`, [planId]
    )
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao atualizar vínculo' })
  }
}

// DELETE /teacher/classes/:id/lesson-plans/:planId  (desvincular)
export async function deleteLessonPlan(req, res) {
  const classId = Number(req.params.id)
  const planId  = Number(req.params.planId)
  if (!Number.isInteger(classId) || !Number.isInteger(planId))
    return res.status(400).json({ error: 'IDs inválidos' })
  try {
    const classInfo = await getAccessibleClass(classId, req.userId, req.userRole)
    if (!classInfo) return res.status(404).json({ error: 'Turma não encontrada' })
    await ensureLessonPlanTables()
    const [result] = await pool.query(
      'DELETE FROM class_lesson_plans WHERE id = ? AND class_id = ?', [planId, classId]
    )
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Vínculo não encontrado' })
    res.json({ message: 'Plano desvinculado com sucesso' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao desvincular plano' })
  }
}
