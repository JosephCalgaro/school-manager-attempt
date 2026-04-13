import pool from './connection.js'

// ─── helper: checa se índice existe ──────────────────────────────────────────
async function indexExists(table, indexName) {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1`,
    [table, indexName]
  )
  return rows.length > 0
}

// ─── helper: adiciona índice se não existir ───────────────────────────────────
async function addIndex(table, indexName, definition) {
  if (await indexExists(table, indexName)) return
  await pool.query(`ALTER TABLE \`${table}\` ADD ${definition}`)
  console.log(`[indexes] ${indexName} adicionado à tabela ${table}`)
}

// ─── ATTENDANCE ───────────────────────────────────────────────────────────────
// uq_attendance: garante sem duplicatas de presença por (turma, aluno, data)
// É o que habilita o ON DUPLICATE KEY UPDATE no bulk upsert do teacherController.
async function ensureAttendanceIndexes() {
  await addIndex('attendance', 'uq_attendance',
    'UNIQUE KEY uq_attendance (class_id, student_id, date)')
  await addIndex('attendance', 'idx_attendance_student',
    'INDEX idx_attendance_student (student_id)')
}

// ─── CLASS_STUDENTS ───────────────────────────────────────────────────────────
async function ensureClassStudentsIndexes() {
  await addIndex('class_students', 'idx_cs_class',
    'INDEX idx_cs_class (class_id)')
  await addIndex('class_students', 'idx_cs_student',
    'INDEX idx_cs_student (student_id)')
}

// ─── GRADES ───────────────────────────────────────────────────────────────────
async function ensureGradesIndexes() {
  await addIndex('grades', 'idx_grades_assignment',
    'INDEX idx_grades_assignment (assignments_id)')
  await addIndex('grades', 'idx_grades_student',
    'INDEX idx_grades_student (student_id)')
}

// ─── ASSIGNMENT_FILES ─────────────────────────────────────────────────────────
async function ensureAssignmentFilesIndexes() {
  await addIndex('assignment_files', 'idx_af_assignment',
    'INDEX idx_af_assignment (assignment_id)')
}

// ─── ASSIGNMENT_COMPLETIONS ───────────────────────────────────────────────────
async function ensureAssignmentCompletionsIndexes() {
  await addIndex('assignment_completions', 'idx_ac_assignment',
    'INDEX idx_ac_assignment (assignment_id)')
}

// ─── STUDENTS ─────────────────────────────────────────────────────────────────
async function ensureStudentsIndexes() {
  await addIndex('students', 'idx_students_responsible',
    'INDEX idx_students_responsible (responsible_id)')
}

// ─── CLASSES ──────────────────────────────────────────────────────────────────
async function ensureClassesIndexes() {
  await addIndex('classes', 'idx_classes_teacher',
    'INDEX idx_classes_teacher (teacher_id)')
  await addIndex('classes', 'idx_classes_active',
    'INDEX idx_classes_active (school_id, is_active)')
}

// ─── USERS ───────────────────────────────────────────────────────────────────
async function ensureUsersIndexes() {
  await addIndex('users', 'idx_users_active',
    'INDEX idx_users_active (school_id, is_active)')
}

// ─── ASSIGNMENTS ─────────────────────────────────────────────────────────────
async function ensureAssignmentsIndexes() {
  await addIndex('assignments', 'idx_assignments_class',
    'INDEX idx_assignments_class (class_id)')
}

// ─── EXPORT PRINCIPAL ─────────────────────────────────────────────────────────
export async function ensureIndexes() {
  await ensureAttendanceIndexes()
  await ensureClassStudentsIndexes()
  await ensureGradesIndexes()
  await ensureAssignmentFilesIndexes()
  await ensureAssignmentCompletionsIndexes()
  await ensureStudentsIndexes()
  await ensureClassesIndexes()
  await ensureUsersIndexes()
  await ensureAssignmentsIndexes()
  console.log('[indexes] Todos os índices verificados')
}
