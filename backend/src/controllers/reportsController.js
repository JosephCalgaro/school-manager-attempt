import pool from '../database/connection.js'

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

export async function ensureReportColumns() {
  const needed = [
    ['students', 'deactivated_at',      'DATETIME NULL'],
    ['students', 'deactivation_reason', 'VARCHAR(100) NULL'],
    ['students', 'created_by',          'INT NULL'],
    ['students', 'city',                'VARCHAR(100) NULL'],
  ]
  for (const [tbl, col, def] of needed) {
    const [rows] = await pool.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1`,
      [tbl, col]
    )
    if (!rows.length) {
      await pool.query(`ALTER TABLE \`${tbl}\` ADD COLUMN \`${col}\` ${def}`)
      console.log(`[migration] ${tbl}.${col} adicionado`)
    }
  }
}

export async function enrollmentsByMonth(req, res) {
  const sid  = req.schoolId
  const year = Number(req.query.year) || new Date().getFullYear()
  try {
    const [rows] = await pool.query(
      `SELECT MONTH(created_at) AS m, COUNT(*) AS total
       FROM students WHERE school_id = ? AND YEAR(created_at) = ?
       GROUP BY MONTH(created_at)`, [sid, year]
    )
    const data = MONTHS.map((label, i) => ({
      label, total: Number(rows.find(r => Number(r.m) === i + 1)?.total ?? 0)
    }))
    res.json({ year, data })
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erro' }) }
}

export async function cancellationsByMonth(req, res) {
  const sid  = req.schoolId
  const year = Number(req.query.year) || new Date().getFullYear()
  try {
    const [rows] = await pool.query(
      `SELECT MONTH(deactivated_at) AS m,
              IFNULL(NULLIF(TRIM(deactivation_reason),''), 'Sem motivo') AS reason,
              COUNT(*) AS total
       FROM students
       WHERE school_id = ? AND is_active = 0 AND deactivated_at IS NOT NULL AND YEAR(deactivated_at) = ?
       GROUP BY MONTH(deactivated_at), reason`, [sid, year]
    )
    const reasons = [...new Set(rows.map(r => r.reason))]
    const data = MONTHS.map((label, i) => {
      const entry = { label }
      for (const reason of reasons)
        entry[reason] = Number(rows.find(r => Number(r.m) === i + 1 && r.reason === reason)?.total ?? 0)
      return entry
    })
    res.json({ year, reasons, data })
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erro' }) }
}

export async function attendanceAll(req, res) {
  const sid = req.schoolId
  try {
    const [rows] = await pool.query(`
      SELECT s.id, s.full_name,
             COUNT(a.id)    AS total,
             SUM(a.present) AS present
      FROM students s
      LEFT JOIN attendance a ON a.student_id = s.id
      WHERE s.school_id = ? AND s.is_active = 1
      GROUP BY s.id, s.full_name
      ORDER BY s.full_name
    `, [sid])
    const data = rows.map(r => {
      const total   = Number(r.total ?? 0)
      const present = Number(r.present ?? 0)
      return { id: r.id, full_name: r.full_name, total, present,
               rate: total > 0 ? Math.round((present / total) * 100) : null }
    })
    res.json(data)
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erro' }) }
}

export async function yearReview(req, res) {
  const sid  = req.schoolId
  const year = Number(req.query.year) || new Date().getFullYear()
  try {
    const [enrRows] = await pool.query(
      `SELECT MONTH(created_at) AS m, COUNT(*) AS total
       FROM students WHERE school_id = ? AND YEAR(created_at) = ? GROUP BY m`, [sid, year]
    )
    const [canRows] = await pool.query(
      `SELECT MONTH(deactivated_at) AS m, COUNT(*) AS total
       FROM students
       WHERE school_id = ? AND is_active=0 AND deactivated_at IS NOT NULL AND YEAR(deactivated_at)=?
       GROUP BY m`, [sid, year]
    )
    const [[{ totalEnr }]] = await pool.query(
      `SELECT COUNT(*) AS totalEnr FROM students WHERE school_id = ? AND YEAR(created_at) = ?`, [sid, year])
    const [[{ totalCan }]] = await pool.query(
      `SELECT COUNT(*) AS totalCan FROM students
       WHERE school_id = ? AND is_active=0 AND deactivated_at IS NOT NULL AND YEAR(deactivated_at)=?`, [sid, year])
    const data = MONTHS.map((label, i) => {
      const enr = Number(enrRows.find(r => Number(r.m) === i+1)?.total ?? 0)
      const can = Number(canRows.find(r => Number(r.m) === i+1)?.total ?? 0)
      return { label, matriculas: enr, cancelamentos: can, liquido: enr - can }
    })
    res.json({ year, totalEnrollments: Number(totalEnr), totalCancellations: Number(totalCan), data })
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erro' }) }
}

export async function secretaryRanking(req, res) {
  const sid   = req.schoolId
  const month = Number(req.query.month) || new Date().getMonth() + 1
  const year  = Number(req.query.year)  || new Date().getFullYear()
  try {
    const [rows] = await pool.query(`
      SELECT u.id, u.full_name, COUNT(s.id) AS enrollments
      FROM students s
      JOIN users u ON u.id = s.created_by
      WHERE s.school_id = ? AND MONTH(s.created_at) = ? AND YEAR(s.created_at) = ?
        AND u.role IN ('SECRETARY','ADMIN')
      GROUP BY u.id, u.full_name
      ORDER BY enrollments DESC
    `, [sid, month, year])
    res.json({ month, year, data: rows.map(r => ({ ...r, enrollments: Number(r.enrollments) })) })
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erro' }) }
}

export async function crmConversion(req, res) {
  const sid = req.schoolId
  try {
    const [stageRows] = await pool.query(
      `SELECT stage, COUNT(*) AS total FROM crm_leads WHERE school_id = ? GROUP BY stage`, [sid]
    )
    const [[{ archivedEnrolled }]] = await pool.query(
      `SELECT COUNT(*) AS archivedEnrolled FROM crm_leads WHERE school_id = ? AND archived=1 AND stage='MATRICULADO'`, [sid]
    )
    const [sourceRows] = await pool.query(
      `SELECT source, COUNT(*) AS total FROM crm_leads WHERE school_id = ? GROUP BY source ORDER BY total DESC`, [sid]
    )
    const stageMap      = Object.fromEntries(stageRows.map(r => [r.stage, Number(r.total)]))
    const totalLeads    = stageRows.reduce((s, r) => s + Number(r.total), 0)
    const matriculados  = (stageMap['MATRICULADO'] ?? 0) + Number(archivedEnrolled)
    const perdidos      = stageMap['PERDIDO'] ?? 0
    const emAndamento   = totalLeads - matriculados - perdidos
    res.json({
      totalLeads, matriculados, perdidos, emAndamento,
      conversionRate: totalLeads > 0 ? Math.round((matriculados / totalLeads) * 100) : 0,
      bySource: sourceRows.map(r => ({ source: r.source, total: Number(r.total) }))
    })
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erro' }) }
}

export async function citiesRanking(req, res) {
  const sid = req.schoolId
  try {
    const [rows] = await pool.query(`
      SELECT IFNULL(NULLIF(TRIM(city),''), 'Não informado') AS city, COUNT(*) AS total
      FROM students WHERE school_id = ? AND is_active = 1
      GROUP BY city ORDER BY total DESC LIMIT 20
    `, [sid])
    res.json(rows.map(r => ({ city: r.city, total: Number(r.total) })))
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erro' }) }
}
