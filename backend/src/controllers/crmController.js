import pool from '../database/connection.js'

// ─── Migration ────────────────────────────────────────────────────────────────

async function ensureCrmTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS crm_leads (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      name         VARCHAR(150) NOT NULL,
      phone        VARCHAR(30)  NULL,
      email        VARCHAR(150) NULL,
      student_name VARCHAR(150) NULL,
      age_range    VARCHAR(30)  NULL,
      source       ENUM('INDICACAO','INSTAGRAM','GOOGLE','SITE','OUTRO') NOT NULL DEFAULT 'OUTRO',
      stage        ENUM('NOVO','CONTATO','EXPERIMENTAL','PROPOSTA','MATRICULADO','PERDIDO') NOT NULL DEFAULT 'NOVO',
      lost_reason  VARCHAR(255) NULL,
      notes        TEXT         NULL,
      assigned_to  INT          NULL,
      archived     TINYINT(1)   NOT NULL DEFAULT 0,
      enrolled_at  DATETIME     NULL,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_crm_stage (stage),
      INDEX idx_crm_assigned (assigned_to)
    )
  `)
  // Incremental migrations for existing tables (MySQL-compatible)
  const [colRows] = await pool.query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'crm_leads'
      AND COLUMN_NAME IN ('archived','enrolled_at','lost_at')
  `)
  const existing = colRows.map(r => r.COLUMN_NAME)
  if (!existing.includes('archived')) {
    await pool.query(`ALTER TABLE crm_leads ADD COLUMN archived TINYINT(1) NOT NULL DEFAULT 0`)
  }
  if (!existing.includes('enrolled_at')) {
    await pool.query(`ALTER TABLE crm_leads ADD COLUMN enrolled_at DATETIME NULL`)
  }
  if (!existing.includes('lost_at')) {
    await pool.query(`ALTER TABLE crm_leads ADD COLUMN lost_at DATETIME NULL`)
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS crm_activities (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      lead_id      INT NOT NULL,
      type         ENUM('LIGACAO','MENSAGEM','EMAIL','AULA_EXP','NOTA','FOLLOW_UP') NOT NULL DEFAULT 'NOTA',
      description  TEXT NOT NULL,
      scheduled_at DATETIME NULL,
      done         TINYINT(1) NOT NULL DEFAULT 0,
      created_by   INT NULL,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_crm_act_lead (lead_id),
      INDEX idx_crm_act_sched (scheduled_at)
    )
  `)
}

// ─── Leads ────────────────────────────────────────────────────────────────────

export async function getLeads(req, res) {
  try {
    await ensureCrmTables()
    const [rows] = await pool.query(`
      SELECT
        l.*,
        u.full_name AS assigned_name,
        COALESCE(agg.total_activities, 0)  AS total_activities,
        COALESCE(agg.pending_followups, 0) AS pending_followups,
        agg.next_followup
      FROM crm_leads l
      LEFT JOIN users u ON u.id = l.assigned_to
      LEFT JOIN (
        SELECT
          lead_id,
          COUNT(id) AS total_activities,
          SUM(CASE WHEN done = 0 AND scheduled_at IS NOT NULL THEN 1 ELSE 0 END) AS pending_followups,
          MIN(CASE WHEN done = 0 AND scheduled_at IS NOT NULL THEN scheduled_at END) AS next_followup
        FROM crm_activities
        GROUP BY lead_id
      ) agg ON agg.lead_id = l.id
      WHERE l.archived = 0
      ORDER BY l.updated_at DESC
    `)
    res.json(rows)
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao buscar leads' }) }
}

export async function createLead(req, res) {
  try {
    await ensureCrmTables()
    const { name, phone, email, student_name, age_range, source, notes, assigned_to } = req.body || {}
    if (!name?.trim()) return res.status(400).json({ error: 'Nome é obrigatório' })
    const [r] = await pool.query(
      `INSERT INTO crm_leads (name, phone, email, student_name, age_range, source, notes, assigned_to)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name.trim(), phone||null, email||null, student_name||null, age_range||null,
       source||'OUTRO', notes||null, assigned_to||req.userId]
    )
    const [rows] = await pool.query(
      `SELECT l.*, u.full_name AS assigned_name,
              0 AS total_activities, 0 AS pending_followups, NULL AS next_followup
       FROM crm_leads l
       LEFT JOIN users u ON u.id = l.assigned_to
       WHERE l.id = ?`,
      [r.insertId]
    )
    res.status(201).json(rows[0])
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao criar lead' }) }
}

export async function updateLead(req, res) {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID inválido' })
  try {
    await ensureCrmTables()
    const allowed = ['name','phone','email','student_name','age_range','source','stage','lost_reason','notes','assigned_to']
    const fields = []; const values = []
    for (const key of allowed) {
      if (req.body[key] !== undefined) { fields.push(`${key} = ?`); values.push(req.body[key] || null) }
    }
    if (!fields.length) return res.status(400).json({ error: 'Nenhum campo para atualizar' })
    // Auto-set enrolled_at when stage becomes MATRICULADO
    if (req.body.stage === 'MATRICULADO') {
      fields.push('enrolled_at = IFNULL(enrolled_at, NOW())')
    }
    if (req.body.stage === 'PERDIDO') {
      fields.push('lost_at = IFNULL(lost_at, NOW())')
    }
    await pool.query(`UPDATE crm_leads SET ${fields.join(', ')} WHERE id = ?`, [...values, id])
    const [rows] = await pool.query('SELECT * FROM crm_leads WHERE id = ?', [id])
    if (!rows.length) return res.status(404).json({ error: 'Lead não encontrado' })
    res.json(rows[0])
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao atualizar lead' }) }
}

export async function deleteLead(req, res) {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID inválido' })
  try {
    await pool.query('DELETE FROM crm_activities WHERE lead_id = ?', [id])
    const [r] = await pool.query('DELETE FROM crm_leads WHERE id = ?', [id])
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Lead não encontrado' })
    res.json({ message: 'Lead removido' })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao remover lead' }) }
}

// ─── Activities ───────────────────────────────────────────────────────────────

export async function getActivities(req, res) {
  const leadId = Number(req.params.id)
  if (!Number.isInteger(leadId)) return res.status(400).json({ error: 'ID inválido' })
  try {
    await ensureCrmTables()
    const [rows] = await pool.query(`
      SELECT a.*, u.full_name AS created_by_name
      FROM crm_activities a
      LEFT JOIN users u ON u.id = a.created_by
      WHERE a.lead_id = ?
      ORDER BY a.created_at DESC
    `, [leadId])
    res.json(rows)
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao buscar atividades' }) }
}

export async function createActivity(req, res) {
  const leadId = Number(req.params.id)
  if (!Number.isInteger(leadId)) return res.status(400).json({ error: 'ID inválido' })
  try {
    await ensureCrmTables()
    const { type, description, scheduled_at } = req.body || {}
    if (!description?.trim()) return res.status(400).json({ error: 'Descrição é obrigatória' })
    const [r] = await pool.query(
      `INSERT INTO crm_activities (lead_id, type, description, scheduled_at, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [leadId, type||'NOTA', description.trim(), scheduled_at||null, req.userId]
    )
    // Bump lead updated_at so it surfaces on top
    await pool.query('UPDATE crm_leads SET updated_at = NOW() WHERE id = ?', [leadId])
    const [rows] = await pool.query(
      `SELECT a.*, u.full_name AS created_by_name FROM crm_activities a
       LEFT JOIN users u ON u.id = a.created_by WHERE a.id = ?`, [r.insertId]
    )
    res.status(201).json(rows[0])
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao criar atividade' }) }
}

export async function toggleActivity(req, res) {
  const actId = Number(req.params.actId)
  if (!Number.isInteger(actId)) return res.status(400).json({ error: 'ID inválido' })
  try {
    await pool.query('UPDATE crm_activities SET done = NOT done WHERE id = ?', [actId])
    const [rows] = await pool.query('SELECT * FROM crm_activities WHERE id = ?', [actId])
    res.json(rows[0])
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro' }) }
}

// ─── Archive enrolled leads from previous months ──────────────────────────────

export async function archiveEnrolled(req, res) {
  try {
    const [r] = await pool.query(`
      UPDATE crm_leads SET archived = 1
      WHERE stage = 'MATRICULADO' AND archived = 0
        AND enrolled_at IS NOT NULL
        AND (YEAR(enrolled_at) < YEAR(NOW()) OR MONTH(enrolled_at) < MONTH(NOW()))
    `)
    res.json({ archived: r.affectedRows })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao arquivar' }) }
}

export async function archiveLost(req, res) {
  try {
    const [r] = await pool.query(`
      UPDATE crm_leads SET archived = 1
      WHERE stage = 'PERDIDO' AND archived = 0
        AND lost_at IS NOT NULL
        AND (YEAR(lost_at) < YEAR(NOW()) OR MONTH(lost_at) < MONTH(NOW()))
    `)
    res.json({ archived: r.affectedRows })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao arquivar' }) }
}
