import pool  from '../database/connection.js'
/**
 * Common locals used across controllers:
 * - sid: school id for the current request (from `req.schoolId`)
 * - req.userId: id of the authenticated user
 * - req.userRole / req.isTemp: auth metadata
 * - t: short name for wildcard search values (`%term%`) when used
 * - countQ / query: SQL query strings (countQ typically holds COUNT(*) SQL)
 * - params: array of SQL parameter values
 * - conn: DB connection from `pool.getConnection()` when using transactions
 */
import jwt   from 'jsonwebtoken'
import { logEvent } from '../middlewares/logger.js'

const JWT_SECRET    = process.env.JWT_SECRET
const TEMP_EXPIRES_H = 2  // horas de validade do token temporário

// ─── Token temporário (vive só no JWT, sem user no banco) ────────────────────
// sub       = id do SAAS_OWNER (para auditoria)
// role      = 'ADMIN' (acesso total à escola)
// school_id = escola que está sendo acessada
// is_temp   = true  (flag de impersonação)
// saas_name = nome do SaaS owner para exibir no banner
function signTempToken(saasOwner, schoolId, expiresIn = `${TEMP_EXPIRES_H}h`) {
  return jwt.sign(
    {
      sub:       saasOwner.id,
      role:      'ADMIN',
      school_id: schoolId,
      is_temp:   true,
      saas_name: saasOwner.full_name ?? saasOwner.fullName ?? 'SaaS Owner',
    },
    JWT_SECRET,
    { expiresIn }
  )
}

// ─── Dashboard geral do SaaS owner ───────────────────────────────────────────
/**
 * getSaasDashboard - dashboard agregadoo para o SaaS owner
 *
 * Locals:
 * - totals, topSchools, monthlyEnrollments, monthlySchools: query results
 */
export async function getSaasDashboard(req, res) {
  try {
    const [[totals]] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM schools WHERE is_active = 1)  AS active_schools,
        (SELECT COUNT(*) FROM schools)                       AS total_schools,
        (SELECT COUNT(*) FROM students WHERE is_active = 1) AS active_students,
        (SELECT COUNT(*) FROM students)                      AS total_students,
        (SELECT COUNT(*) FROM users WHERE is_active = 1
          AND role IN ('ADMIN','TEACHER','SECRETARY'))       AS active_users,
        (SELECT COUNT(*) FROM classes WHERE is_active = 1)  AS active_classes
    `)
    const [topSchools] = await pool.query(`
      SELECT s.id, s.name, s.plan, s.is_active, s.created_at,
        COUNT(st.id) AS students,
        (SELECT COUNT(*) FROM users u WHERE u.school_id = s.id AND u.role != 'SAAS_OWNER') AS users
      FROM schools s
      LEFT JOIN students st ON st.school_id = s.id AND st.is_active = 1
      GROUP BY s.id ORDER BY students DESC LIMIT 10
    `)
    const [monthlyEnrollments] = await pool.query(`
      SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS total
      FROM students WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY month ORDER BY month
    `)
    const [monthlySchools] = await pool.query(`
      SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS total
      FROM schools WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY month ORDER BY month
    `)
    res.json({
      totals: {
        active_schools:  Number(totals.active_schools),
        total_schools:   Number(totals.total_schools),
        active_students: Number(totals.active_students),
        total_students:  Number(totals.total_students),
        active_users:    Number(totals.active_users),
        active_classes:  Number(totals.active_classes),
      },
      top_schools:         topSchools.map(s => ({ ...s, students: Number(s.students), users: Number(s.users) })),
      monthly_enrollments: monthlyEnrollments.map(r => ({ ...r, total: Number(r.total) })),
      monthly_schools:     monthlySchools.map(r => ({ ...r, total: Number(r.total) })),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao buscar dashboard SaaS' })
  }
}

// ─── Detalhes de uma escola específica ───────────────────────────────────────
/**
 * getSchoolDetails - detalhes e contagens de uma escola específica
 *
 * Locals:
 * - id: escola id (from params)
 * - school, counts, recentStudents: query results
 */
export async function getSchoolDetails(req, res) {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID inválido' })
  try {
    const [[school]] = await pool.query(
      `SELECT id, name, cnpj, email, phone, address, plan, is_active, created_at
       FROM schools WHERE id = ?`, [id]
    )
    if (!school) return res.status(404).json({ error: 'Escola não encontrada' })

    const [[counts]] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM students  WHERE school_id = ? AND is_active = 1)               AS students,
        (SELECT COUNT(*) FROM users     WHERE school_id = ? AND is_active = 1
          AND role NOT IN ('SAAS_OWNER'))                                                     AS users,
        (SELECT COUNT(*) FROM classes   WHERE school_id = ? AND is_active = 1)               AS classes,
        (SELECT COUNT(*) FROM crm_leads WHERE school_id = ? AND archived = 0)                AS crm_leads
    `, [id, id, id, id])

    const [recentStudents] = await pool.query(
      `SELECT id, full_name, email, created_at FROM students
       WHERE school_id = ? ORDER BY created_at DESC LIMIT 5`, [id]
    )

    res.json({
      school,
      counts: {
        students:  Number(counts.students),
        users:     Number(counts.users),
        classes:   Number(counts.classes),
        crm_leads: Number(counts.crm_leads),
      },
      recent_students: recentStudents,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao buscar detalhes' })
  }
}

// ─── Impersonar escola ────────────────────────────────────────────────────────
// Lógica:
//   1. Valida escola
//   2. Busca o SAAS_OWNER pelo token da requisição (x-saas-key não carrega user,
//      então recebemos o saas_owner_id opcionalmente no body, ou buscamos pelo email)
//   3. Gera token JWT com role=ADMIN + school_id=escola + is_temp=true
//   4. Nenhum user é criado/modificado no banco
/**
 * impersonateSchool - gera token temporário para acessar escola como ADMIN
 *
 * Locals:
 * - id: escola id (from params)
 * - school, saasOwners, saasOwner, expiresAt, token: intermediate values
 */
export async function impersonateSchool(req, res) {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID inválido' })

  try {
    // 1. Valida escola
    const [[school]] = await pool.query(
      `SELECT id, name, is_active FROM schools WHERE id = ?`, [id]
    )
    if (!school)           return res.status(404).json({ error: 'Escola não encontrada' })
    if (!school.is_active) return res.status(403).json({ error: 'Escola inativa' })

    // 2. Busca o SAAS_OWNER no banco para compor o token e o display name
    //    (a rota usa requireSaasKey, então sabemos que quem chama é o SaaS owner)
    const [saasOwners] = await pool.query(
      `SELECT id, full_name, email FROM users
       WHERE role = 'SAAS_OWNER' AND is_active = 1
       ORDER BY id ASC LIMIT 1`
    )
    if (!saasOwners.length) {
      return res.status(500).json({ error: 'Nenhum SaaS Owner ativo encontrado.' })
    }
    const saasOwner = saasOwners[0]

    // 3. Gera token temporário — sem tocar no banco
    const expiresAt = new Date(Date.now() + TEMP_EXPIRES_H * 60 * 60 * 1000)
    const token     = signTempToken(saasOwner, id)

    logEvent('INFO', 'SAAS_IMPERSONATE', {
      saasOwnerId: saasOwner.id,
      schoolId: id,
      schoolName: school.name,
      expiresAt: expiresAt.toISOString(),
    })

    return res.json({
      token,
      is_temp:    true,
      expires_at: expiresAt.toISOString(),
      user: {
        id:              saasOwner.id,
        full_name:       `${saasOwner.full_name} (via SaaS)`,
        email:           saasOwner.email,
        role:            'ADMIN',
        school_id:       id,
        school_name:     school.name,
        is_temp:         true,
        temp_expires_at: expiresAt.toISOString(),
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao acessar escola' })
  }
}

// ─── Revogar impersonação (apenas loga — o token expira sozinho) ──────────────
/**
 * revokeImpersonation - revoga impersonação (log apenas)
 *
 * Locals:
 * - id: escola id (from params)
 */
export async function revokeImpersonation(req, res) {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID inválido' })
  logEvent('INFO', 'SAAS_IMPERSONATE_REVOKED', { schoolId: id })
  res.json({ message: 'Sessão encerrada' })
}
