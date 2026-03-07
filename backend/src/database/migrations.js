import pool from './connection.js'

async function addPhoneColumnIfMissing(tableName) {
  const [rows] = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND column_name = 'phone'
     LIMIT 1`,
    [tableName]
  )

  if (rows.length === 0) {
    await pool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN phone VARCHAR(30) NULL`)
  }
}

async function addStudentPasswordHashIfMissing() {
  const [rows] = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'students'
       AND column_name = 'password_hash'
     LIMIT 1`
  )

  if (rows.length === 0) {
    // Coluna nullable: alunos existentes ficam sem senha até o admin definir uma
    await pool.query(`ALTER TABLE \`students\` ADD COLUMN password_hash VARCHAR(255) NULL`)
    console.log('[migration] Coluna password_hash adicionada à tabela students')
  }
}

export async function ensureContactColumns() {
  await addPhoneColumnIfMissing('users')
  await addPhoneColumnIfMissing('students')
  await addPhoneColumnIfMissing('responsibles')
  await addStudentPasswordHashIfMissing()
}
