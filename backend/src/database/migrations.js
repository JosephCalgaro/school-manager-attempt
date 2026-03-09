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
    await pool.query(`ALTER TABLE \`students\` ADD COLUMN password_hash VARCHAR(255) NULL`)
    console.log('[migration] Coluna password_hash adicionada à tabela students')
  }
}

async function ensureResponsiblePasswordHash() {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'responsibles' AND column_name = 'password_hash' LIMIT 1`
  )
  if (rows.length === 0) {
    await pool.query(`ALTER TABLE \`responsibles\` ADD COLUMN password_hash VARCHAR(255) NULL`)
    console.log('[migration] Coluna password_hash adicionada à tabela responsibles')
  }
}

async function ensureUserExtraColumns() {
  const cols = ['cpf VARCHAR(20) NULL', 'rg VARCHAR(20) NULL', 'birth_date DATE NULL']
  for (const colDef of cols) {
    const colName = colDef.split(' ')[0]
    const [rows] = await pool.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = ? LIMIT 1`,
      [colName]
    )
    if (rows.length === 0) {
      await pool.query(`ALTER TABLE \`users\` ADD COLUMN ${colDef}`)
      console.log(`[migration] Coluna ${colName} adicionada à tabela users`)
    }
  }
}

async function ensureIsActive(tableName) {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = 'is_active' LIMIT 1`,
    [tableName]
  )
  if (rows.length === 0) {
    await pool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1`)
    console.log(`[migration] Coluna is_active adicionada à tabela ${tableName}`)
  }
}

export async function ensureContactColumns() {
  await addPhoneColumnIfMissing('users')
  await addPhoneColumnIfMissing('students')
  await addPhoneColumnIfMissing('responsibles')
  await addStudentPasswordHashIfMissing()
  await ensureUserExtraColumns()
  await ensureResponsiblePasswordHash()
  await ensureIsActive('classes')
  await ensureIsActive('students')
  await ensureIsActive('responsibles')
}
