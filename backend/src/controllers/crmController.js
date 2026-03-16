import pool from '../database/connection.js'

async function ensureCrmTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS crm_leads (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      school_id    INT NOT NULL DEFAULT 1,
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
      lost_at      DATETIME     NULL,
      follow_up_at DATETIME     NULL,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_crm_stage (stage),
      INDEX idx_crm_school (school_id)
    )
  `)
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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS crm_stage_logs (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      lead_id    INT NOT NULL,
      school_id  INT NOT NULL DEFAULT 1,
      from_stage VARCHAR(30) NULL,
      to_stage   VARCHAR(30) NOT NULL,
      changed_by INT NULL,
      note       TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_stage_log_lead (lead_id),
      INDEX idx_stage_log_school (school_id)
    )
  `)
  // colunas legadas
  for (const [col, def] of [
    ['archived',    'TINYINT(1) NOT NULL DEFAULT 0'],
    ['school_id',   'INT NOT NULL DEFAULT 1'],
    ['enrolled_at', 'DATETIME NULL'],
    ['lost_at',     'DATETIME NULL'],
    ['follow_up_at','DATETIME NULL'],
  ]) {
    const [r] = await pool.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema=DATABASE() AND table_name='crm_leads' AND column_name=? LIMIT 1`, [col]
    )
    if (!r.length) await pool.query(`ALTER TABLE crm_leads ADD COLUMN ${col} ${def}`)
  }
}

export async function getLeads(req, res) {
  const sid = req.schoolId
  try {
    await ensureCrmTables()
    const [rows] = await pool.query(`
      SELECT l.*, u.full_name AS assigned_name,
        COALESCE(agg.total_activities, 0)  AS total_activities,
        COALESCE(agg.pending_followups, 0) AS pending_followups,
        COALESCE(agg.done_followups, 0)    AS done_followups,
        agg.next_followup,
        exp_agg.next_exp_class,
        COALESCE(exp_agg.pending_exp_classes, 0) AS pending_exp_classes,
        COALESCE(exp_agg.done_exp_classes, 0)    AS done_exp_classes
      FROM crm_leads l
      LEFT JOIN users u ON u.id = l.assigned_to
      LEFT JOIN (
        SELECT lead_id,
          COUNT(id) AS total_activities,
          SUM(CASE WHEN done=0 AND scheduled_at IS NOT NULL AND type != 'AULA_EXP' THEN 1 ELSE 0 END) AS pending_followups,
          MIN(CASE WHEN done=0 AND scheduled_at IS NOT NULL AND type != 'AULA_EXP' THEN scheduled_at END) AS next_followup,
          SUM(CASE WHEN done=1 AND type = 'FOLLOW_UP' THEN 1 ELSE 0 END) AS done_followups
        FROM crm_activities GROUP BY lead_id
      ) agg ON agg.lead_id = l.id
      LEFT JOIN (
        SELECT lead_id,
          MIN(CASE WHEN done=0 AND scheduled_at IS NOT NULL THEN scheduled_at END) AS next_exp_class,
          SUM(CASE WHEN done=0 AND scheduled_at IS NOT NULL THEN 1 ELSE 0 END) AS pending_exp_classes,
          SUM(CASE WHEN done=1 THEN 1 ELSE 0 END) AS done_exp_classes
        FROM crm_activities WHERE type = 'AULA_EXP' GROUP BY lead_id
      ) exp_agg ON exp_agg.lead_id = l.id
      WHERE l.school_id = ? AND l.archived = 0
      ORDER BY l.updated_at DESC
    `, [sid])
    res.json(rows)
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao buscar leads' }) }
}

export async function createLead(req, res) {
  const sid = req.schoolId
  try {
    await ensureCrmTables()
    const { name, phone, email, student_name, age_range, source, notes, assigned_to } = req.body || {}
    if (!name?.trim()) return res.status(400).json({ error: 'Nome é obrigatório' })
    const [r] = await pool.query(
      `INSERT INTO crm_leads (school_id, name, phone, email, student_name, age_range, source, notes, assigned_to)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sid, name.trim(), phone||null, email||null, student_name||null,
       age_range||null, source||'OUTRO', notes||null, assigned_to||req.userId]
    )
    // log criação
    await pool.query(
      `INSERT INTO crm_stage_logs (lead_id, school_id, from_stage, to_stage, changed_by, note)
       VALUES (?, ?, NULL, 'NOVO', ?, 'Lead criado')`,
      [r.insertId, sid, req.userId]
    )
    const [rows] = await pool.query(
      `SELECT l.*, u.full_name AS assigned_name,
              0 AS total_activities, 0 AS pending_followups, NULL AS next_followup,
              NULL AS next_exp_class, 0 AS pending_exp_classes
       FROM crm_leads l LEFT JOIN users u ON u.id = l.assigned_to WHERE l.id = ?`,
      [r.insertId]
    )
    res.status(201).json(rows[0])
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao criar lead' }) }
}

export async function updateLead(req, res) {
  const id = Number(req.params.id); const sid = req.schoolId
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID inválido' })
  try {
    const [existing] = await pool.query('SELECT * FROM crm_leads WHERE id = ? AND school_id = ?', [id, sid])
    if (!existing.length) return res.status(404).json({ error: 'Lead não encontrado' })
    const prev = existing[0]

    const allowed = ['name','phone','email','student_name','age_range','source','stage',
                     'lost_reason','notes','assigned_to','follow_up_at']
    const fields = []; const values = []
    for (const key of allowed) {
      if (req.body[key] !== undefined) { fields.push(`${key} = ?`); values.push(req.body[key] || null) }
    }
    if (!fields.length) return res.status(400).json({ error: 'Nenhum campo para atualizar' })
    if (req.body.stage === 'MATRICULADO') fields.push('enrolled_at = IFNULL(enrolled_at, NOW())')
    if (req.body.stage === 'PERDIDO')     fields.push('lost_at = IFNULL(lost_at, NOW())')

    await pool.query(`UPDATE crm_leads SET ${fields.join(', ')} WHERE id = ? AND school_id = ?`, [...values, id, sid])

    // log mudança de estágio
    if (req.body.stage && req.body.stage !== prev.stage) {
      await pool.query(
        `INSERT INTO crm_stage_logs (lead_id, school_id, from_stage, to_stage, changed_by)
         VALUES (?, ?, ?, ?, ?)`,
        [id, sid, prev.stage, req.body.stage, req.userId]
      )
    }
    // log follow_up_at agendado
    if (req.body.follow_up_at && req.body.follow_up_at !== prev.follow_up_at) {
      await pool.query(
        `INSERT INTO crm_stage_logs (lead_id, school_id, from_stage, to_stage, changed_by, note)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, sid, null, 'FOLLOW_UP_AGENDADO', req.userId,
         `Follow-up agendado para ${req.body.follow_up_at}`]
      )
    }

    const [rows] = await pool.query('SELECT * FROM crm_leads WHERE id = ?', [id])
    res.json(rows[0])
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao atualizar lead' }) }
}

export async function deleteLead(req, res) {
  const id = Number(req.params.id); const sid = req.schoolId
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID inválido' })
  try {
    await pool.query('DELETE FROM crm_activities WHERE lead_id = ?', [id])
    await pool.query('DELETE FROM crm_stage_logs WHERE lead_id = ?', [id])
    const [r] = await pool.query('DELETE FROM crm_leads WHERE id = ? AND school_id = ?', [id, sid])
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Lead não encontrado' })
    res.json({ message: 'Lead removido' })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao remover lead' }) }
}

export async function getActivities(req, res) {
  const leadId = Number(req.params.id)
  if (!Number.isInteger(leadId)) return res.status(400).json({ error: 'ID inválido' })
  try {
    const [acts] = await pool.query(
      `SELECT a.*, u.full_name AS created_by_name
       FROM crm_activities a LEFT JOIN users u ON u.id = a.created_by
       WHERE a.lead_id = ? ORDER BY a.created_at DESC`, [leadId]
    )
    const [logs] = await pool.query(
      `SELECT l.*, u.full_name AS changed_by_name
       FROM crm_stage_logs l LEFT JOIN users u ON u.id = l.changed_by
       WHERE l.lead_id = ? ORDER BY l.created_at DESC`, [leadId]
    )
    res.json({ activities: acts, logs })
  } catch (err) { res.status(500).json({ error: 'Erro ao buscar atividades' }) }
}

export async function createActivity(req, res) {
  const leadId = Number(req.params.id)
  if (!Number.isInteger(leadId)) return res.status(400).json({ error: 'ID inválido' })
  try {
    const { type, description, scheduled_at } = req.body || {}
    if (!description?.trim()) return res.status(400).json({ error: 'Descrição é obrigatória' })
    const [r] = await pool.query(
      `INSERT INTO crm_activities (lead_id, type, description, scheduled_at, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [leadId, type||'NOTA', description.trim(), scheduled_at||null, req.userId]
    )
    // log nota adicionada
    const sid = req.schoolId
    await pool.query(
      `INSERT INTO crm_stage_logs (lead_id, school_id, from_stage, to_stage, changed_by, note)
       VALUES (?, ?, NULL, 'ATIVIDADE', ?, ?)`,
      [leadId, sid, req.userId, `${type||'NOTA'}: ${description.trim().slice(0,80)}`]
    )
    await pool.query('UPDATE crm_leads SET updated_at = NOW() WHERE id = ?', [leadId])
    const [rows] = await pool.query(
      `SELECT a.*, u.full_name AS created_by_name FROM crm_activities a
       LEFT JOIN users u ON u.id = a.created_by WHERE a.id = ?`, [r.insertId]
    )
    res.status(201).json(rows[0])
  } catch (err) { res.status(500).json({ error: 'Erro ao criar atividade' }) }
}

export async function toggleActivity(req, res) {
  const actId = Number(req.params.actId)
  if (!Number.isInteger(actId)) return res.status(400).json({ error: 'ID inválido' })
  try {
    await pool.query('UPDATE crm_activities SET done = NOT done WHERE id = ?', [actId])
    const [rows] = await pool.query('SELECT * FROM crm_activities WHERE id = ?', [actId])
    res.json(rows[0])
  } catch (err) { res.status(500).json({ error: 'Erro' }) }
}

export async function getRecentFeed(req, res) {
  const sid = req.schoolId
  try {
    await ensureCrmTables()
    const [rows] = await pool.query(`
      SELECT l.id, l.lead_id, l.from_stage, l.to_stage, l.note, l.created_at,
             u.full_name AS changed_by_name,
             c.name AS lead_name
      FROM crm_stage_logs l
      LEFT JOIN users u ON u.id = l.changed_by
      LEFT JOIN crm_leads c ON c.id = l.lead_id
      WHERE l.school_id = ?
      ORDER BY l.created_at DESC
      LIMIT 50
    `, [sid])
    res.json(rows)
  } catch (err) { res.status(500).json({ error: 'Erro ao buscar feed' }) }
}

export async function archiveEnrolled(req, res) {
  const sid = req.schoolId
  try {
    const [r] = await pool.query(`
      UPDATE crm_leads SET archived = 1
      WHERE school_id = ? AND stage = 'MATRICULADO' AND archived = 0
        AND enrolled_at IS NOT NULL
        AND (YEAR(enrolled_at) < YEAR(NOW()) OR MONTH(enrolled_at) < MONTH(NOW()))
    `, [sid])
    res.json({ archived: r.affectedRows })
  } catch (err) { res.status(500).json({ error: 'Erro ao arquivar' }) }
}

export async function archiveLost(req, res) {
  const sid = req.schoolId
  try {
    const [r] = await pool.query(`
      UPDATE crm_leads SET archived = 1
      WHERE school_id = ? AND stage = 'PERDIDO' AND archived = 0
        AND lost_at IS NOT NULL
        AND (YEAR(lost_at) < YEAR(NOW()) OR MONTH(lost_at) < MONTH(NOW()))
    `, [sid])
    res.json({ archived: r.affectedRows })
  } catch (err) { res.status(500).json({ error: 'Erro ao arquivar' }) }
}
