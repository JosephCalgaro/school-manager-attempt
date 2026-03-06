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

export async function ensureContactColumns() {
  await addPhoneColumnIfMissing('users')
  await addPhoneColumnIfMissing('students')
  await addPhoneColumnIfMissing('responsibles')
}
