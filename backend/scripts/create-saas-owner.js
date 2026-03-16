/**
 * Script para criar o usuário SAAS_OWNER no banco de dados.
 *
 * Uso:
 *   node scripts/create-saas-owner.js
 *   node scripts/create-saas-owner.js --email=saas@admin.com --password=MinhaSenh@123
 */

import bcrypt from 'bcryptjs'
import mysql  from 'mysql2/promise'
import { config } from 'dotenv'

config() // carrega o .env

const DB = {
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT) || 3306,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'school_manager',
}

// ─── Argumentos da linha de comando ──────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => a.slice(2).split('='))
)

const EMAIL    = args.email    || 'saas@admin.com'
const PASSWORD = args.password || 'saas1234'
const NAME     = args.name     || 'SaaS Owner'

async function main() {
  const conn = await mysql.createConnection(DB)
  console.log('✅ Conectado ao banco:', DB.database)

  try {
    // 1. Garante que o ENUM users.role inclui SAAS_OWNER
    const [colRows] = await conn.query(`
      SELECT COLUMN_TYPE FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'role'
      LIMIT 1
    `)

    if (colRows.length && !colRows[0].COLUMN_TYPE.includes('SAAS_OWNER')) {
      await conn.query(`
        ALTER TABLE \`users\`
        MODIFY COLUMN role ENUM('ADMIN','TEACHER','SECRETARY','SAAS_OWNER') NOT NULL DEFAULT 'ADMIN'
      `)
      console.log("✅ ENUM 'SAAS_OWNER' adicionado à coluna users.role")
    }

    // 2. Verifica se já existe um SAAS_OWNER com esse e-mail
    const [existing] = await conn.query(
      `SELECT id, email FROM users WHERE email = ? LIMIT 1`,
      [EMAIL]
    )

    if (existing.length > 0) {
      // Atualiza a senha e garante role correto
      const hash = await bcrypt.hash(PASSWORD, 10)
      await conn.query(
        `UPDATE users SET password_hash = ?, role = 'SAAS_OWNER', is_active = 1, full_name = ? WHERE email = ?`,
        [hash, NAME, EMAIL]
      )
      console.log(`✅ Usuário SAAS_OWNER atualizado: ${EMAIL}`)
    } else {
      // Cria novo
      const hash = await bcrypt.hash(PASSWORD, 10)
      const [result] = await conn.query(
        `INSERT INTO users (full_name, email, role, password_hash, is_active, school_id)
         VALUES (?, ?, 'SAAS_OWNER', ?, 1, 1)`,
        [NAME, EMAIL, hash]
      )
      console.log(`✅ Usuário SAAS_OWNER criado! ID: ${result.insertId}`)
    }

    console.log('\n─────────────────────────────────────')
    console.log('  Login do SaaS Owner:')
    console.log(`  E-mail:  ${EMAIL}`)
    console.log(`  Senha:   ${PASSWORD}`)
    console.log('─────────────────────────────────────\n')

  } finally {
    await conn.end()
  }
}

main().catch(err => {
  console.error('❌ Erro:', err.message)
  process.exit(1)
})
