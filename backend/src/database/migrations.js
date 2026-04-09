import pool from './connection.js'
import { ensureReportColumns } from '../controllers/reportsController.js'

// ─── helper: verifica se coluna existe ───────────────────────────────────────
async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1`,
    [table, column]
  )
  return rows.length > 0
}

// ─── helper: adiciona coluna se não existir ───────────────────────────────────
async function addColumnIfMissing(table, colDef) {
  const colName = colDef.split(' ')[0]
  if (!(await columnExists(table, colName))) {
    await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN ${colDef}`)
    console.log(`[migration] Coluna ${colName} adicionada à tabela ${table}`)
  }
}

// ─── SCHOOLS TABLE ────────────────────────────────────────────────────────────
async function ensureSchoolsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schools (
      id              INT AUTO_INCREMENT PRIMARY KEY,
      name            VARCHAR(150) NOT NULL,
      cnpj            VARCHAR(20)  NULL,
      email           VARCHAR(150) NULL,
      phone           VARCHAR(30)  NULL,
      address         TEXT         NULL,
      plan            ENUM('TRIAL','BASIC','PRO') NOT NULL DEFAULT 'BASIC',
      is_active       TINYINT(1)   NOT NULL DEFAULT 1,
      monthly_fee     DECIMAL(8,2) NOT NULL DEFAULT 0.00,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `)

  // Garante que existe pelo menos a escola padrão (id=1) para dados legados
  const [[count]] = await pool.query('SELECT COUNT(*) as n FROM schools')
  if (count.n === 0) {
    await pool.query(`
      INSERT INTO schools (id, name, plan) VALUES (1, 'Escola Padrão', 'BASIC')
    `)
    console.log('[migration] Escola padrão criada (id=1)')
  }
}

// ─── SCHOOL_ID em todas as tabelas principais ─────────────────────────────────
async function ensureSchoolIdColumns() {
  const tables = [
    'users', 'students', 'classes', 'responsibles',
    'inventory_items', 'crm_leads', 'lesson_plan_templates'
  ]

  for (const table of tables) {
    const [tableCheck] = await pool.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1`,
      [table]
    )
    if (!tableCheck.length) continue

    // 1. Adicionar coluna school_id se não existir
    if (!(await columnExists(table, 'school_id'))) {
      await pool.query(
        `ALTER TABLE \`${table}\` ADD COLUMN school_id INT NOT NULL DEFAULT 1`
      )
      console.log(`[migration] school_id adicionado à tabela ${table}`)
    }

    // 2. Adicionar INDEX em school_id se não existir
    const [idxCheck] = await pool.query(
      `SELECT 1 FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = ? AND index_name = 'idx_school_id' LIMIT 1`,
      [table]
    )
    if (!idxCheck.length) {
      await pool.query(`ALTER TABLE \`${table}\` ADD INDEX idx_school_id (school_id)`)
      console.log(`[migration] INDEX idx_school_id adicionado à tabela ${table}`)
    }
  }
}

// ─── UNIQUE constraints por escola (evita conflito entre escolas) ─────────────
async function ensurePerSchoolUniqueConstraints() {
  // students: email único por escola (não globalmente)
  const [stuEmail] = await pool.query(
    `SELECT 1 FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'students'
       AND index_name = 'uq_students_email_school' LIMIT 1`
  )
  if (!stuEmail.length) {
    // Remove unique global de email se existir
    const [globalIdx] = await pool.query(
      `SELECT index_name AS idx_name FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = 'students'
         AND column_name = 'email' AND non_unique = 0
         AND index_name != 'PRIMARY'
       LIMIT 1`
    )
    if (globalIdx.length && globalIdx[0].idx_name) {
      await pool.query(`ALTER TABLE students DROP INDEX \`${globalIdx[0].idx_name}\``)
      console.log('[migration] Removido unique global de students.email')
    }
    await pool.query(
      `ALTER TABLE students ADD UNIQUE KEY uq_students_email_school (email, school_id)`
    )
    console.log('[migration] Unique (email, school_id) adicionado a students')
  }

  // students: cpf único por escola
  const [stuCpf] = await pool.query(
    `SELECT 1 FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'students'
       AND index_name = 'uq_students_cpf_school' LIMIT 1`
  )
  if (!stuCpf.length) {
    const [globalIdx] = await pool.query(
      `SELECT index_name AS idx_name FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = 'students'
         AND column_name = 'cpf' AND non_unique = 0
         AND index_name != 'PRIMARY'
       LIMIT 1`
    )
    if (globalIdx.length && globalIdx[0].idx_name) {
      await pool.query(`ALTER TABLE students DROP INDEX \`${globalIdx[0].idx_name}\``)
      console.log('[migration] Removido unique global de students.cpf')
    }
    await pool.query(
      `ALTER TABLE students ADD UNIQUE KEY uq_students_cpf_school (cpf, school_id)`
    )
    console.log('[migration] Unique (cpf, school_id) adicionado a students')
  }

  // users: email único por escola
  const [usrEmail] = await pool.query(
    `SELECT 1 FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'users'
       AND index_name = 'uq_users_email_school' LIMIT 1`
  )
  if (!usrEmail.length) {
    const [globalIdx] = await pool.query(
      `SELECT index_name AS idx_name FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = 'users'
         AND column_name = 'email' AND non_unique = 0
         AND index_name != 'PRIMARY'
       LIMIT 1`
    )
    if (globalIdx.length && globalIdx[0].idx_name) {
      await pool.query(`ALTER TABLE users DROP INDEX \`${globalIdx[0].idx_name}\``)
      console.log('[migration] Removido unique global de users.email')
    }
    await pool.query(
      `ALTER TABLE users ADD UNIQUE KEY uq_users_email_school (email, school_id)`
    )
    console.log('[migration] Unique (email, school_id) adicionado a users')
  }

  // responsibles: email único por escola
  const [respEmail] = await pool.query(
    `SELECT 1 FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'responsibles'
       AND index_name = 'uq_responsibles_email_school' LIMIT 1`
  )
  if (!respEmail.length) {
    const [globalIdx] = await pool.query(
      `SELECT index_name AS idx_name FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = 'responsibles'
         AND column_name = 'email' AND non_unique = 0
         AND index_name != 'PRIMARY'
       LIMIT 1`
    )
    if (globalIdx.length && globalIdx[0].idx_name) {
      await pool.query(`ALTER TABLE responsibles DROP INDEX \`${globalIdx[0].idx_name}\``)
      console.log('[migration] Removido unique global de responsibles.email')
    }
    await pool.query(
      `ALTER TABLE responsibles ADD UNIQUE KEY uq_responsibles_email_school (email, school_id)`
    )
    console.log('[migration] Unique (email, school_id) adicionado a responsibles')
  }
}

// ─── FK CONSTRAINT school_id → schools ───────────────────────────────────────
async function ensureSchoolForeignKeys() {
  const tables = ['users', 'students', 'classes', 'responsibles']
  for (const table of tables) {
    const [tableCheck] = await pool.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1`, [table]
    )
    if (!tableCheck.length) continue

    const fkName = `fk_${table}_school`
    const [fkCheck] = await pool.query(
      `SELECT 1 FROM information_schema.referential_constraints
       WHERE constraint_schema = DATABASE() AND constraint_name = ? LIMIT 1`,
      [fkName]
    )
    if (!fkCheck.length) {
      try {
        await pool.query(
          `ALTER TABLE \`${table}\`
           ADD CONSTRAINT \`${fkName}\`
           FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE RESTRICT ON UPDATE CASCADE`
        )
        console.log(`[migration] FK ${fkName} adicionada`)
      } catch (e) {
        // Ignora se já existe com outro nome
        if (!e.message.includes('Duplicate')) console.warn(`[migration] FK ${fkName}: ${e.message}`)
      }
    }
  }
}
async function addPhoneColumnIfMissing(tableName) {
  await addColumnIfMissing(tableName, 'phone VARCHAR(30) NULL')
}

async function addStudentPasswordHashIfMissing() {
  await addColumnIfMissing('students', 'password_hash VARCHAR(255) NULL')
}

async function ensureResponsiblePasswordHash() {
  await addColumnIfMissing('responsibles', 'password_hash VARCHAR(255) NULL')
}

async function ensureUserExtraColumns() {
  await addColumnIfMissing('users', 'cpf VARCHAR(20) NULL')
  await addColumnIfMissing('users', 'rg VARCHAR(20) NULL')
  await addColumnIfMissing('users', 'birth_date DATE NULL')
}

async function ensureIsActive(tableName) {
  await addColumnIfMissing(tableName, 'is_active TINYINT(1) NOT NULL DEFAULT 1')
}

async function ensureStudentDeactivationColumns() {
  await addColumnIfMissing('students', 'deactivated_at DATETIME NULL')
  await addColumnIfMissing('students', 'deactivation_reason VARCHAR(100) NULL')
  await addColumnIfMissing('students', 'created_by INT NULL')
  await addColumnIfMissing('students', 'city VARCHAR(100) NULL')
}

// ─── SAAS_OWNER role no ENUM de users ────────────────────────────────────────
async function ensureSaasOwnerRole() {
  // Verifica se SAAS_OWNER já está no ENUM
  const [rows] = await pool.query(`
    SELECT COLUMN_TYPE FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'role'
    LIMIT 1
  `)
  if (!rows.length) return
  const colType = rows[0].COLUMN_TYPE || ''
  if (colType.includes('SAAS_OWNER')) return

  await pool.query(`
    ALTER TABLE \`users\`
    MODIFY COLUMN role ENUM('ADMIN','TEACHER','SECRETARY','SAAS_OWNER') NOT NULL DEFAULT 'ADMIN'
  `)
  console.log('[migration] Role SAAS_OWNER adicionado ao ENUM de users')
}

// ─── Colunas is_temp / temp_expires_at (legado — removida da inicialização)
// A impersonação é 100% baseada no JWT; estas colunas no banco não são mais lidas.
// A função é mantida aqui apenas para referência histórica, mas não é mais chamada.

// ─── EXPORT PRINCIPAL ─────────────────────────────────────────────────────────
export async function ensureContactColumns() {
  await ensureSchoolsTable()
  await addColumnIfMissing('schools', 'monthly_fee DECIMAL(8,2) NOT NULL DEFAULT 0.00')
  await addPhoneColumnIfMissing('users')
  await addPhoneColumnIfMissing('students')
  await addPhoneColumnIfMissing('responsibles')
  await addStudentPasswordHashIfMissing()
  await ensureUserExtraColumns()
  await ensureResponsiblePasswordHash()
  await ensureIsActive('classes')
  await ensureIsActive('students')
  await ensureIsActive('responsibles')
  await ensureStudentDeactivationColumns()
  await ensureSchoolIdColumns()           // adiciona school_id + INDEX
  await ensurePerSchoolUniqueConstraints() // unique (email+school_id)
  await ensureSchoolForeignKeys()          // FK school_id → schools
  await ensureSaasOwnerRole()              // ENUM SAAS_OWNER em users.role
  await ensureReportColumns()
  console.log('[migration] Todas as migrações aplicadas com sucesso')
}
