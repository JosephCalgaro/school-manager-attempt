import pool from '../database/connection.js'
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

// ─── Tabelas e migrações ──────────────────────────────────────────────────────

// ─── Inicialização de tabelas — chamada UMA VEZ na startup do servidor ────────
// Não deve ser chamada em cada request. Ver app.js: initCrmTables()
let _crmTablesReady = false

/**
 * initCrmTables - inicializa tabelas CRM na startup (idempotente)
 *
 * Locals:
 * - _crmTablesReady: flag de inicialização
 */
export async function initCrmTables() {
  if (_crmTablesReady) return
  await ensureCrmTables()
  _crmTablesReady = true
  console.log('[CRM] Tabelas inicializadas com sucesso')
}

/**
 * ensureCrmTables - cria/migra tabelas CRM quando necessário
 *
 * Locals:
 * - activityCols, newCols, enumCols, newIndexes: arrays de migração
 * - r: result sets from information_schema checks
 */
async function ensureCrmTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS crm_leads (
      id                       INT AUTO_INCREMENT PRIMARY KEY,
      school_id                INT NOT NULL DEFAULT 1,
      name                     VARCHAR(150) NOT NULL,
      phone                    VARCHAR(30)  NULL,
      email                    VARCHAR(150) NULL,
      cpf                      VARCHAR(20)  NULL,
      rg                       VARCHAR(20)  NULL,
      student_name             VARCHAR(150) NULL,
      age_range                VARCHAR(30)  NULL,
      source   ENUM('INDICACAO','INSTAGRAM','GOOGLE','SITE','OUTRO') NOT NULL DEFAULT 'OUTRO',
      stage    ENUM('NOVO','CONTATO','EXPERIMENTAL','PROPOSTA','MATRICULADO','PERDIDO') NOT NULL DEFAULT 'NOVO',
      lost_reason              VARCHAR(255) NULL,
      lost_reason_type ENUM('PRECO','HORARIO','DISTANCIA','CONCORRENCIA','NAO_RESPONDEU','DESISTIU','OUTRO') NULL,
      notes                    TEXT         NULL,
      tags                     VARCHAR(500) NULL,
      assigned_to              INT          NULL,
      score                    INT          NOT NULL DEFAULT 0,
      temperature ENUM('QUENTE','MORNO','FRIO') NOT NULL DEFAULT 'FRIO',
      expected_enrollment_date DATE         NULL,
      archived                 TINYINT(1)   NOT NULL DEFAULT 0,
      enrolled_at              DATETIME     NULL,
      lost_at                  DATETIME     NULL,
      follow_up_at             DATETIME     NULL,
      last_activity_at         DATETIME     NULL,
      created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_crm_stage    (stage),
      INDEX idx_crm_school   (school_id),
      INDEX idx_crm_score    (score),
      INDEX idx_crm_temp     (temperature)
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS crm_activities (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      lead_id      INT NOT NULL,
      type ENUM('LIGACAO','MENSAGEM','EMAIL','AULA_EXP','NOTA','FOLLOW_UP') NOT NULL DEFAULT 'NOTA',
      description  TEXT NOT NULL,
      scheduled_at DATETIME NULL,
      done         TINYINT(1) NOT NULL DEFAULT 0,
      done_note    TEXT NULL,
      created_by   INT NULL,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_crm_act_lead  (lead_id),
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
      INDEX idx_stage_log_lead   (lead_id),
      INDEX idx_stage_log_school (school_id)
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS crm_custom_fields (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      school_id  INT NOT NULL,
      name       VARCHAR(100) NOT NULL,
      field_type ENUM('TEXT','NUMBER','DATE','SELECT','BOOLEAN') NOT NULL DEFAULT 'TEXT',
      options    TEXT NULL,
      required   TINYINT(1) NOT NULL DEFAULT 0,
      position   INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_field_school_name (school_id, name),
      INDEX idx_cf_school (school_id)
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS crm_lead_field_values (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      lead_id       INT NOT NULL,
      school_id     INT NOT NULL,
      field_id      INT NOT NULL,
      value         TEXT NULL,
      updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_lead_field (lead_id, field_id),
      INDEX idx_lfv_lead   (lead_id),
      INDEX idx_lfv_school (school_id)
    )
  `)

  const activityCols = [
    ['done_note', 'TEXT NULL'],
  ]
  for (const [col, def] of activityCols) {
    const [r] = await pool.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema=DATABASE() AND table_name='crm_activities' AND column_name=? LIMIT 1`, [col]
    )
    if (!r.length) await pool.query(`ALTER TABLE crm_activities ADD COLUMN \`${col}\` ${def}`)
  }

  const newCols = [
    ['archived',                 'TINYINT(1) NOT NULL DEFAULT 0'],
    ['school_id',                'INT NOT NULL DEFAULT 1'],
    ['enrolled_at',              'DATETIME NULL'],
    ['lost_at',                  'DATETIME NULL'],
    ['follow_up_at',             'DATETIME NULL'],
    ['last_activity_at',         'DATETIME NULL'],
    ['tags',                     'VARCHAR(500) NULL'],
    ['score',                    'INT NOT NULL DEFAULT 0'],
    ['expected_enrollment_date', 'DATE NULL'],
    ['cpf',                      'VARCHAR(20) NULL'],
    ['rg',                       'VARCHAR(20) NULL'],
    ['cpf_normalized',           'VARCHAR(14) NULL COMMENT "CPF só dígitos, para busca indexada"'],
    ['phone_normalized',         'VARCHAR(20) NULL COMMENT "Telefone só dígitos, para busca indexada"'],
  ]
  for (const [col, def] of newCols) {
    const [r] = await pool.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema=DATABASE() AND table_name='crm_leads' AND column_name=? LIMIT 1`, [col]
    )
    if (!r.length) await pool.query(`ALTER TABLE crm_leads ADD COLUMN \`${col}\` ${def}`)
  }
  const enumCols = [
    ['temperature',      "ENUM('QUENTE','MORNO','FRIO') NOT NULL DEFAULT 'FRIO'"],
    ['lost_reason_type', "ENUM('PRECO','HORARIO','DISTANCIA','CONCORRENCIA','NAO_RESPONDEU','DESISTIU','OUTRO') NULL"],
  ]
  for (const [col, def] of enumCols) {
    const [r] = await pool.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema=DATABASE() AND table_name='crm_leads' AND column_name=? LIMIT 1`, [col]
    )
    if (!r.length) await pool.query(`ALTER TABLE crm_leads ADD COLUMN \`${col}\` ${def}`)
  }

  // Índices nas colunas normalizadas (cpf_normalized, phone_normalized)
  const newIndexes = [
    ['idx_cpf_norm',   'cpf_normalized'],
    ['idx_phone_norm', 'phone_normalized'],
  ]
  for (const [idxName, colName] of newIndexes) {
    const [r] = await pool.query(
      `SELECT 1 FROM information_schema.statistics
       WHERE table_schema=DATABASE() AND table_name='crm_leads' AND index_name=? LIMIT 1`, [idxName]
    )
    if (!r.length) await pool.query(`ALTER TABLE crm_leads ADD INDEX \`${idxName}\` (\`${colName}\`)`)
  }

  // Popula colunas normalizadas para registros já existentes (migração única)
  await pool.query(`
    UPDATE crm_leads
    SET cpf_normalized   = REGEXP_REPLACE(cpf,   '[^0-9]', ''),
        phone_normalized = REGEXP_REPLACE(phone, '[^0-9]', '')
    WHERE (cpf_normalized IS NULL AND cpf IS NOT NULL)
       OR (phone_normalized IS NULL AND phone IS NOT NULL)
  `)
}

// ─── Score ────────────────────────────────────────────────────────────────────

/**
 * calcScore - calcula score de um lead a partir de sinais e contagens
 *
 * Locals:
 * - s: score acumulado
 * - stageBonus: mapeamento de bônus por estágio
 * - actCount, doneFollowUps, doneExpClasses: contadores passados
 */
function calcScore(lead, actCount = 0, doneFollowUps = 0, doneExpClasses = 0) {
  let s = 0
  if (lead.phone)        s += 10
  if (lead.email)        s += 10
  if (lead.cpf)          s += 5
  if (lead.student_name) s += 5
  if (lead.age_range)    s += 5
  const stageBonus = { NOVO:0, CONTATO:10, EXPERIMENTAL:20, PROPOSTA:30, MATRICULADO:40, PERDIDO:0 }
  s += stageBonus[lead.stage] ?? 0
  s += Math.min(actCount * 3, 15)
  s += Math.min(doneFollowUps * 5, 10)
  s += Math.min(doneExpClasses * 10, 20)
  if (lead.expected_enrollment_date) s += 5
  return Math.min(s, 100)
}

/**
 * calcTemperature - classifica temperatura com base em score e última atividade
 *
 * Locals:
 * - days: dias desde a última atividade (ou 999 se indefinido)
 */
function calcTemperature(score, lastActivityAt) {
  const days = lastActivityAt
    ? Math.floor((Date.now() - new Date(lastActivityAt).getTime()) / 86400000) : 999
  if (score >= 60 && days <= 7)  return 'QUENTE'
  if (score >= 30 && days <= 14) return 'MORNO'
  return 'FRIO'
}

/**
 * recalcScore - recalcula score e temperatura de um lead e atualiza DB
 *
 * Locals:
 * - lead, agg: rows selected from DB
 * - score, temperature: calculados via helpers
 */
async function recalcScore(leadId) {
  const [[lead]] = await pool.query('SELECT * FROM crm_leads WHERE id = ?', [leadId])
  if (!lead) return
  const [[agg]] = await pool.query(`
    SELECT COUNT(*) AS total,
      SUM(CASE WHEN done=1 AND type='FOLLOW_UP' THEN 1 ELSE 0 END) AS done_followups,
      SUM(CASE WHEN done=1 AND type='AULA_EXP'  THEN 1 ELSE 0 END) AS done_exp,
      MAX(created_at) AS last_act
    FROM crm_activities WHERE lead_id = ?
  `, [leadId])
  const score       = calcScore(lead, Number(agg.total||0), Number(agg.done_followups||0), Number(agg.done_exp||0))
  const temperature = calcTemperature(score, agg.last_act || lead.last_activity_at)
  await pool.query(
    `UPDATE crm_leads SET score=?, temperature=?, last_activity_at=COALESCE(?,last_activity_at) WHERE id=?`,
    [score, temperature, agg.last_act || null, leadId]
  )
}

// ─── Helper: subquery de agregados ────────────────────────────────────────────

const LEAD_AGG_SQL = `
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
      SUM(CASE WHEN done=0 AND scheduled_at IS NOT NULL AND type!='AULA_EXP' THEN 1 ELSE 0 END) AS pending_followups,
      MIN(CASE WHEN done=0 AND scheduled_at IS NOT NULL AND type!='AULA_EXP' THEN scheduled_at END) AS next_followup,
      SUM(CASE WHEN done=1 AND type='FOLLOW_UP' THEN 1 ELSE 0 END) AS done_followups
    FROM crm_activities GROUP BY lead_id
  ) agg ON agg.lead_id = l.id
  LEFT JOIN (
    SELECT lead_id,
      MIN(CASE WHEN done=0 AND scheduled_at IS NOT NULL THEN scheduled_at END) AS next_exp_class,
      SUM(CASE WHEN done=0 AND scheduled_at IS NOT NULL THEN 1 ELSE 0 END) AS pending_exp_classes,
      SUM(CASE WHEN done=1 THEN 1 ELSE 0 END) AS done_exp_classes
    FROM crm_activities WHERE type='AULA_EXP' GROUP BY lead_id
  ) exp_agg ON exp_agg.lead_id = l.id
`

// ─── checkDuplicate ───────────────────────────────────────────────────────────
// Verifica duplicidade por CPF, RG ou telefone antes de criar/atualizar

/**
 * checkDuplicate - verifica duplicidade de lead por CPF/RG/telefone
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * Locals:
 * - sid: school id
 * - cpf, rg, phone, exclude_id: query params
 * - cpfClean, rgClean, phoneClean: normalized values
 * - conditions, params, sql, allParams
 */
export async function checkDuplicate(req, res) {
  const sid = req.schoolId
  const { cpf, rg, phone, exclude_id } = req.query
  try {
    const digitsOnly  = v => v?.replace(/\D/g, '')              || null
    const alphaDigits = v => v?.replace(/[^a-zA-Z0-9]/g, '')   || null

    const cpfClean   = digitsOnly(cpf)
    const rgClean    = alphaDigits(rg)
    const phoneClean = digitsOnly(phone)

    const conditions = []; const params = []

    // Usa colunas normalizadas com índice — sem REGEXP_REPLACE em runtime
    if (cpfClean)   { conditions.push('cpf_normalized = ?');           params.push(cpfClean) }
    if (phoneClean) { conditions.push('phone_normalized LIKE ?');      params.push(`%${phoneClean}%`) }
    // RG ainda não tem coluna normalizada dedicada — mantém REGEXP_REPLACE apenas para ele
    if (rgClean)    {
      conditions.push("REGEXP_REPLACE(rg, '[^a-zA-Z0-9]', '') = ?")
      params.push(rgClean)
    }

    if (!conditions.length) return res.json({ duplicates: [] })

    let sql = `SELECT id, name, stage, archived, cpf, rg, phone FROM crm_leads
               WHERE school_id = ? AND (${conditions.join(' OR ')})`
    const allParams = [sid, ...params]
    if (exclude_id) { sql += ' AND id != ?'; allParams.push(Number(exclude_id)) }

    const [rows] = await pool.query(sql, allParams)
    res.json({ duplicates: rows })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao verificar duplicidade' }) }
}

// ─── getLeadById ──────────────────────────────────────────────────────────────

/**
 * getLeadById - retorna um lead com agregados por id
 *
 * Locals:
 * - id: id do lead (Number(req.params.id))
 * - sid: school id
 */
export async function getLeadById(req, res) {
  const id = Number(req.params.id); const sid = req.schoolId
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID inválido' })
  try {
    await ensureCrmTables()
    const [rows] = await pool.query(
      `${LEAD_AGG_SQL} WHERE l.id = ? AND l.school_id = ?`, [id, sid]
    )
    if (!rows.length) return res.status(404).json({ error: 'Lead não encontrado' })
    res.json(rows[0])
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao buscar lead' }) }
}

// ─── getLeads ─────────────────────────────────────────────────────────────────

/**
 * getLeads - lista leads com filtros, paginação e agregados
 *
 * Locals:
 * - sid, assigned_to, source, temperature, search, page, limit
 * - pageNum, pageSize, offset
 * - where, params, total, rows
 */
export async function getLeads(req, res) {
  const sid = req.schoolId
  try {
    await ensureCrmTables()
    const { assigned_to, source, temperature, search, page, limit } = req.query

    // Paginação: page (1-based), limit (padrão 100, máx 500)
    const pageNum  = Math.max(1, parseInt(page)  || 1)
    const pageSize = Math.min(500, Math.max(1, parseInt(limit) || 100))
    const offset   = (pageNum - 1) * pageSize

    let where = 'l.school_id = ? AND l.archived = 0'
    const params = [sid]
    if (assigned_to) { where += ' AND l.assigned_to = ?';  params.push(assigned_to) }
    if (source)      { where += ' AND l.source = ?';       params.push(source) }
    if (temperature) { where += ' AND l.temperature = ?';  params.push(temperature) }
    if (search) {
      where += ' AND (l.name LIKE ? OR l.phone LIKE ? OR l.email LIKE ? OR l.student_name LIKE ? OR l.cpf LIKE ? OR l.rg LIKE ?)'
      const t = `%${search}%`; params.push(t, t, t, t, t, t)
    }

    // Total para metadados de paginação
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM crm_leads l WHERE ${where}`, params
    )

    const [rows] = await pool.query(
      `${LEAD_AGG_SQL} WHERE ${where} ORDER BY l.score DESC, l.updated_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    )

    res.json({
      data:       rows,
      pagination: {
        page:       pageNum,
        limit:      pageSize,
        total:      Number(total),
        totalPages: Math.ceil(Number(total) / pageSize),
      },
    })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao buscar leads' }) }
}

// ─── getArchivedLeads ─────────────────────────────────────────────────────────

/**
 * getArchivedLeads - retorna leads arquivados com filtros
 *
 * Locals:
 * - sid, type, search, where, params, rows
 */
export async function getArchivedLeads(req, res) {
  const sid = req.schoolId
  const { type = 'all', search } = req.query // type: all | enrolled | lost
  try {
    await ensureCrmTables()
    let where = 'l.school_id = ? AND l.archived = 1'
    const params = [sid]
    if (type === 'enrolled') { where += " AND l.stage = 'MATRICULADO'" }
    else if (type === 'lost') { where += " AND l.stage = 'PERDIDO'" }
    if (search) {
      where += ' AND (l.name LIKE ? OR l.phone LIKE ? OR l.email LIKE ? OR l.student_name LIKE ?)'
      const t = `%${search}%`; params.push(t, t, t, t)
    }
    const [rows] = await pool.query(
      `${LEAD_AGG_SQL} WHERE ${where} ORDER BY l.updated_at DESC`, params
    )
    res.json(rows)
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao buscar arquivados' }) }
}

// ─── reactivateLead ───────────────────────────────────────────────────────────

/**
 * reactivateLead - reativa um lead arquivado/perdido e recalcula score
 *
 * Locals:
 * - id, sid, lead, prev, reactivateNote
 */
export async function reactivateLead(req, res) {
  const id = Number(req.params.id); const sid = req.schoolId
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID inválido' })
  try {
    const [[lead]] = await pool.query('SELECT * FROM crm_leads WHERE id=? AND school_id=?', [id, sid])
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' })
    if (!lead.archived && lead.stage !== 'PERDIDO') {
      return res.status(400).json({ error: 'Lead não está arquivado ou perdido' })
    }
    const prevStage = lead.stage
    await pool.query(
      "UPDATE crm_leads SET stage='CONTATO', archived=0, lost_at=NULL, lost_reason=NULL, lost_reason_type=NULL, follow_up_at=NULL, updated_at=NOW() WHERE id=?",
      [id]
    )
    const reactivateNote = 'Reativado do estagio ' + prevStage
    await pool.query(
      "INSERT INTO crm_stage_logs (lead_id, school_id, from_stage, to_stage, changed_by, note) VALUES (?, ?, ?, 'REATIVACAO', ?, ?)",
      [id, sid, prevStage, req.userId, reactivateNote]
    )
    await recalcScore(id)
    const [rows] = await pool.query(
      `${LEAD_AGG_SQL} WHERE l.id = ?`, [id]
    )
    res.json(rows[0])
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao reativar lead' }) }
}

/**
 * createLead - cria um lead CRM e cria log inicial
 *
 * Locals:
 * - sid, name, phone, email, cpf, rg, student_name, age_range, source, notes
 * - cpfNorm, phoneNorm, r, rows
 */
export async function createLead(req, res) {
  const sid = req.schoolId
  try {
    await ensureCrmTables()
    const { name, phone, email, cpf, rg, student_name, age_range, source,
            notes, assigned_to, tags, expected_enrollment_date } = req.body || {}
    if (!name?.trim()) return res.status(400).json({ error: 'Nome é obrigatório' })

    const cpfNorm   = cpf   ? cpf.replace(/\D/g, '')   : null
    const phoneNorm = phone ? phone.replace(/\D/g, '') : null

    const [r] = await pool.query(
      `INSERT INTO crm_leads
       (school_id, name, phone, email, cpf, rg, student_name, age_range, source,
        notes, assigned_to, tags, expected_enrollment_date, cpf_normalized, phone_normalized)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sid, name.trim(), phone||null, email||null, cpf||null, rg||null,
       student_name||null, age_range||null, source||'OUTRO', notes||null,
       assigned_to||req.userId, tags||null, expected_enrollment_date||null,
       cpfNorm, phoneNorm]
    )
    await pool.query(
      `INSERT INTO crm_stage_logs (lead_id, school_id, from_stage, to_stage, changed_by, note)
       VALUES (?, ?, NULL, 'NOVO', ?, 'Lead criado')`,
      [r.insertId, sid, req.userId]
    )
    await recalcScore(r.insertId)
    const [rows] = await pool.query(
      `${LEAD_AGG_SQL} WHERE l.id = ?`, [r.insertId]
    )
    res.status(201).json(rows[0])
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao criar lead' }) }
}

// ─── updateLead ───────────────────────────────────────────────────────────────

/**
 * updateLead - atualiza campos de um lead, sincroniza colunas normalizadas
 *
 * Locals:
 * - id, sid, existing, prev, allowed, fields, values, changed, changedFields
 */
export async function updateLead(req, res) {
  const id = Number(req.params.id); const sid = req.schoolId
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID inválido' })
  try {
    const [existing] = await pool.query('SELECT * FROM crm_leads WHERE id=? AND school_id=?', [id, sid])
    if (!existing.length) return res.status(404).json({ error: 'Lead não encontrado' })
    const prev = existing[0]
    const allowed = ['name','phone','email','cpf','rg','student_name','age_range','source',
                     'stage','lost_reason','lost_reason_type','notes','assigned_to',
                     'follow_up_at','tags','expected_enrollment_date']
    const fields = []; const values = []
    for (const key of allowed) {
      if (req.body[key] !== undefined) { fields.push(`\`${key}\` = ?`); values.push(req.body[key] || null) }
    }
    if (!fields.length) return res.status(400).json({ error: 'Nenhum campo para atualizar' })
    // Mantém colunas normalizadas sincronizadas
    if (req.body.cpf  !== undefined) { fields.push('cpf_normalized = ?');   values.push(req.body.cpf   ? req.body.cpf.replace(/\D/g, '')   : null) }
    if (req.body.phone !== undefined) { fields.push('phone_normalized = ?'); values.push(req.body.phone ? req.body.phone.replace(/\D/g, '') : null) }
    if (req.body.stage === 'MATRICULADO') fields.push('enrolled_at = IFNULL(enrolled_at, NOW())')
    if (req.body.stage === 'PERDIDO')     fields.push('lost_at = IFNULL(lost_at, NOW())')
    await pool.query(`UPDATE crm_leads SET ${fields.join(', ')} WHERE id=? AND school_id=?`, [...values, id, sid])

    if (req.body.stage && req.body.stage !== prev.stage) {
      await pool.query(
        `INSERT INTO crm_stage_logs (lead_id, school_id, from_stage, to_stage, changed_by)
         VALUES (?, ?, ?, ?, ?)`, [id, sid, prev.stage, req.body.stage, req.userId]
      )
    }
    if (req.body.follow_up_at && req.body.follow_up_at !== prev.follow_up_at) {
      await pool.query(
        `INSERT INTO crm_stage_logs (lead_id, school_id, from_stage, to_stage, changed_by, note)
         VALUES (?, ?, NULL, 'FOLLOW_UP_AGENDADO', ?, ?)`,
        [id, sid, req.userId, `Follow-up agendado para ${req.body.follow_up_at}`]
      )
    }
    // Log de edição de dados cadastrais
    const cadastralFields = ['name','phone','email','cpf','rg','student_name']
    const changed = cadastralFields.filter(f => req.body[f] !== undefined && req.body[f] !== prev[f])
    if (changed.length) {
      await pool.query(
        `INSERT INTO crm_stage_logs (lead_id, school_id, from_stage, to_stage, changed_by, note)
         VALUES (?, ?, NULL, 'EDICAO', ?, ?)`,
        [id, sid, req.userId, `Campos editados: ${changed.join(', ')}`]
      )
    }
    await recalcScore(id)
    const [rows] = await pool.query(
      `${LEAD_AGG_SQL} WHERE l.id = ?`, [id]
    )
    res.json(rows[0])
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao atualizar lead' }) }
}

// ─── deleteLead ───────────────────────────────────────────────────────────────

/**
 * deleteLead - remove lead e dados relacionados em transação
 *
 * Locals:
 * - id, sid, conn, r
 */
export async function deleteLead(req, res) {
  const id = Number(req.params.id); const sid = req.schoolId
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID inválido' })
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await conn.query('DELETE FROM crm_lead_field_values WHERE lead_id = ?', [id])
    await conn.query('DELETE FROM crm_activities WHERE lead_id = ?', [id])
    await conn.query('DELETE FROM crm_stage_logs WHERE lead_id = ?', [id])
    const [r] = await conn.query('DELETE FROM crm_leads WHERE id=? AND school_id=?', [id, sid])
    if (r.affectedRows === 0) { await conn.rollback(); return res.status(404).json({ error: 'Lead não encontrado' }) }
    await conn.commit()
    res.json({ message: 'Lead removido' })
  } catch (err) {
    await conn.rollback()
    console.error(err); res.status(500).json({ error: 'Erro ao remover lead' })
  } finally { conn.release() }
}

// ─── Custom Fields ────────────────────────────────────────────────────────────

/**
 * getCustomFields - lista campos personalizados da escola
 *
 * Locals:
 * - sid, rows
 */
export async function getCustomFields(req, res) {
  const sid = req.schoolId
  try {
    await ensureCrmTables()
    const [rows] = await pool.query(
      'SELECT * FROM crm_custom_fields WHERE school_id=? ORDER BY position, id', [sid]
    )
    res.json(rows)
  } catch (err) { 
    console.error('Erro ao buscar campos:', err)
    res.status(500).json({ error: 'Erro ao buscar campos' }) 
  }
}

/**
 * createCustomField - cria um campo personalizado e retorna o registro
 *
 * Locals:
 * - sid, name, field_type, options, required, pos, r, field
 */
export async function createCustomField(req, res) {
  const sid = req.schoolId
  const { name, field_type = 'TEXT', options, required = 0 } = req.body || {}
  if (!name?.trim()) return res.status(400).json({ error: 'Nome é obrigatório' })
  try {
    await ensureCrmTables()
    const [[pos]] = await pool.query(
      'SELECT COALESCE(MAX(position),0)+1 AS next FROM crm_custom_fields WHERE school_id=?', [sid]
    )
    const [r] = await pool.query(
      `INSERT INTO crm_custom_fields (school_id, name, field_type, options, required, position)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sid, name.trim(), field_type, options||null, required?1:0, pos.next]
    )
    const [[field]] = await pool.query('SELECT * FROM crm_custom_fields WHERE id=?', [r.insertId])
    res.status(201).json(field)
  } catch (err) {
    if (err?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Já existe um campo com este nome' })
    console.error('Erro ao criar campo:', err)
    res.status(500).json({ error: 'Erro ao criar campo' })
  }
}

/**
 * updateCustomField - atualiza um campo personalizado
 *
 * Locals:
 * - id, sid, name, field_type, options, required, position, fields, values
 */
export async function updateCustomField(req, res) {
  const id = Number(req.params.fieldId); const sid = req.schoolId
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID inválido' })
  const { name, field_type, options, required, position } = req.body || {}
  try {
    const fields = []; const values = []
    if (name      !== undefined) { fields.push('name=?');      values.push(name) }
    if (field_type!== undefined) { fields.push('field_type=?');values.push(field_type) }
    if (options   !== undefined) { fields.push('options=?');   values.push(options||null) }
    if (required  !== undefined) { fields.push('required=?');  values.push(required?1:0) }
    if (position  !== undefined) { fields.push('position=?');  values.push(position) }
    if (!fields.length) return res.status(400).json({ error: 'Nenhum campo para atualizar' })
    await pool.query(
      `UPDATE crm_custom_fields SET ${fields.join(',')} WHERE id=? AND school_id=?`,
      [...values, id, sid]
    )
    const [[field]] = await pool.query('SELECT * FROM crm_custom_fields WHERE id=?', [id])
    res.json(field)
  } catch (err) { 
    console.error('Erro ao atualizar campo:', err)
    res.status(500).json({ error: 'Erro ao atualizar campo' }) 
  }
}

/**
 * deleteCustomField - remove campo personalizado e seus valores
 *
 * Locals:
 * - id, sid
 */
export async function deleteCustomField(req, res) {
  const id = Number(req.params.fieldId); const sid = req.schoolId
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID inválido' })
  try {
    await pool.query('DELETE FROM crm_lead_field_values WHERE field_id=?', [id])
    await pool.query('DELETE FROM crm_custom_fields WHERE id=? AND school_id=?', [id, sid])
    res.json({ message: 'Campo removido' })
  } catch (err) { 
    console.error('Erro ao remover campo:', err)
    res.status(500).json({ error: 'Erro ao remover campo' }) 
  }
}

/**
 * getLeadFieldValues - obtém valores de campos personalizados de um lead
 *
 * Locals:
 * - leadId, rows
 */
export async function getLeadFieldValues(req, res) {
  const leadId = Number(req.params.id)
  if (!Number.isInteger(leadId)) return res.status(400).json({ error: 'ID inválido' })
  try {
    const [rows] = await pool.query(
      `SELECT v.*, f.name, f.field_type, f.options, f.required
       FROM crm_lead_field_values v
       JOIN crm_custom_fields f ON f.id = v.field_id
       WHERE v.lead_id=? ORDER BY f.position, f.id`, [leadId]
    )
    res.json(rows)
  } catch (err) { 
    console.error('Erro ao buscar valores:', err)
    res.status(500).json({ error: 'Erro ao buscar valores' }) 
  }
}

/**
 * upsertLeadFieldValues - insere ou atualiza valores de campos personalizados em batch
 *
 * Locals:
 * - leadId, sid, values, validValues, fieldIds, existingMap, changedFields
 */
export async function upsertLeadFieldValues(req, res) {
  const leadId = Number(req.params.id); const sid = req.schoolId
  if (!Number.isInteger(leadId)) return res.status(400).json({ error: 'ID inválido' })
  const { values } = req.body || {} // [{ field_id, value }]
  if (!Array.isArray(values)) return res.status(400).json({ error: 'values deve ser um array' })
  try {
    const [[lead]] = await pool.query('SELECT id, name FROM crm_leads WHERE id=? AND school_id=?', [leadId, sid])
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' })

    const validValues = values.filter(v => Number(v.field_id))
    const fieldIds    = validValues.map(v => Number(v.field_id))

    // Batch SELECT — 1 query instead of N
    const existingMap = {}
    if (fieldIds.length) {
      const [existing] = await pool.query(
        `SELECT field_id, value FROM crm_lead_field_values WHERE lead_id=? AND field_id IN (${fieldIds.map(()=>'?').join(',')})`,
        [leadId, ...fieldIds]
      )
      existing.forEach(r => { existingMap[r.field_id] = r.value })
    }

    const changedFields = []
    if (validValues.length) {
      // Batch UPSERT — 1 query ao invés de N INSERTs individuais
      const batchRows = validValues.map(({ field_id, value }) => [leadId, sid, Number(field_id), value || null])
      await pool.query(
        `INSERT INTO crm_lead_field_values (lead_id, school_id, field_id, value)
         VALUES ? ON DUPLICATE KEY UPDATE value=VALUES(value)`,
        [batchRows]
      )
      for (const { field_id, value } of validValues) {
        const fid = Number(field_id)
        if (existingMap[fid] === undefined || existingMap[fid] !== value) changedFields.push(fid)
      }
    }

    if (changedFields.length) {
      const [fieldNames] = await pool.query(
        `SELECT name FROM crm_custom_fields WHERE id IN (${changedFields.map(()=>'?').join(',')})`,
        changedFields
      )
      await pool.query(
        `INSERT INTO crm_stage_logs (lead_id, school_id, from_stage, to_stage, changed_by, note)
         VALUES (?, ?, NULL, 'CAMPO_PERSONALIZADO', ?, ?)`,
        [leadId, sid, req.userId,
         `Campos atualizados: ${fieldNames.map(f=>f.name).join(', ')}`]
      )
    }

    const [rows] = await pool.query(
      `SELECT v.*, f.name, f.field_type, f.options, f.required
       FROM crm_lead_field_values v
       JOIN crm_custom_fields f ON f.id = v.field_id
       WHERE v.lead_id=? ORDER BY f.position, f.id`, [leadId]
    )
    res.json(rows)
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao salvar valores' }) }
}

// ─── getActivities ────────────────────────────────────────────────────────────

/**
 * getActivities - retorna atividades e logs de um lead
 *
 * Locals:
 * - leadId, acts, logs
 */
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
  } catch (err) {
    console.error('Erro ao buscar atividades:', err)
    res.status(500).json({ error: 'Erro ao buscar atividades' }) 
  }
}

/**
 * createActivity - cria uma atividade e registra log
 *
 * Locals:
 * - leadId, type, description, scheduled_at, r, rows
 */
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
    await pool.query(
      `INSERT INTO crm_stage_logs (lead_id, school_id, from_stage, to_stage, changed_by, note)
       VALUES (?, ?, NULL, 'ATIVIDADE', ?, ?)`,
      [leadId, req.schoolId, req.userId, `${type||'NOTA'}: ${description.trim().slice(0,80)}`]
    )
    await pool.query('UPDATE crm_leads SET updated_at=NOW(), last_activity_at=NOW() WHERE id=?', [leadId])
    await recalcScore(leadId)
    const [rows] = await pool.query(
      `SELECT a.*, u.full_name AS created_by_name FROM crm_activities a
       LEFT JOIN users u ON u.id = a.created_by WHERE a.id = ?`, [r.insertId]
    )
    res.status(201).json(rows[0])
  } catch (err) { 
    console.error('Erro ao criar atividade:', err)
    res.status(500).json({ error: 'Erro ao criar atividade' }) 
  }
}

/**
 * toggleActivity - marca/desmarca atividade como feita e atualiza notas
 *
 * Locals:
 * - actId, act, isDone, hasNote, note, updated
 */
export async function toggleActivity(req, res) {
  const actId = Number(req.params.actId)
  if (!Number.isInteger(actId)) return res.status(400).json({ error: 'ID inválido' })
  try {
    const [[act]] = await pool.query('SELECT * FROM crm_activities WHERE id = ?', [actId])
    if (!act) return res.status(404).json({ error: 'Atividade não encontrada' })

    const isDone = Number(act.done) === 1
    const hasNote = Object.prototype.hasOwnProperty.call(req.body || {}, 'done_note')
    if (!isDone) {
      const note = (req.body?.done_note || '').trim()
      if (!note) return res.status(400).json({ error: 'Resultado é obrigatório' })
      await pool.query('UPDATE crm_activities SET done=1, done_note=? WHERE id=?', [note, actId])
      await pool.query(
        "INSERT INTO crm_stage_logs (lead_id, school_id, from_stage, to_stage, changed_by, note) VALUES (?, ?, NULL, 'ATIVIDADE_FEITA', ?, ?)",
        [act.lead_id, req.schoolId, req.userId, 'Atividade concluída: ' + note.slice(0,120)]
      )
    } else if (hasNote) {
      const note = (req.body?.done_note || '').trim()
      if (!note) return res.status(400).json({ error: 'Resultado é obrigatório' })
      await pool.query('UPDATE crm_activities SET done_note=? WHERE id=?', [note, actId])
    } else {
      await pool.query('UPDATE crm_activities SET done=0, done_note=NULL WHERE id=?', [actId])
    }
    const [[updated]] = await pool.query(
      `SELECT a.*, u.full_name AS created_by_name FROM crm_activities a LEFT JOIN users u ON u.id = a.created_by WHERE a.id = ?`, [actId]
    )
    await recalcScore(updated.lead_id)
    res.json(updated)
  } catch (err) { 
    console.error('Erro ao atualizar atividade:', err)
    res.status(500).json({ error: 'Erro' }) 
  }
}
// ─── getFunnelMetrics ─────────────────────────────────────────────────────────
// Funil baseado em coorte de jornada:
// "Dos X que entraram no estágio N, quantos avançaram para o estágio N+1?"
// Usa crm_stage_logs para rastrear a jornada real de cada lead.

/**
 * getFunnelMetrics - calcula métricas do funil/coorte e previsões
 *
 * Locals:
 * - sid, REAL_STAGES, firstEntries, leadJourneys, stageMetrics, PIPELINE
 */
export async function getFunnelMetrics(req, res) {
  const sid = req.schoolId
  const REAL_STAGES = ['NOVO','CONTATO','EXPERIMENTAL','PROPOSTA','MATRICULADO','PERDIDO']
  try {
    await ensureCrmTables()

    // ── 1. Primeira vez que cada lead entrou em cada estágio ──────────────────
    // Inclui leads criados diretamente em qualquer estágio (o log inicial registra to_stage)
    const [firstEntries] = await pool.query(`
      SELECT sl.lead_id, sl.to_stage AS stage, MIN(sl.created_at) AS first_entered_at
      FROM crm_stage_logs sl
      JOIN crm_leads l ON l.id = sl.lead_id
      WHERE l.school_id = ?
        AND sl.to_stage IN ('NOVO','CONTATO','EXPERIMENTAL','PROPOSTA','MATRICULADO','PERDIDO')
      GROUP BY sl.lead_id, sl.to_stage
    `, [sid])

    // Organiza em mapa: lead_id → { STAGE → first_entered_at }
    const leadJourneys = {}
    for (const row of firstEntries) {
      if (!leadJourneys[row.lead_id]) leadJourneys[row.lead_id] = {}
      leadJourneys[row.lead_id][row.stage] = new Date(row.first_entered_at)
    }

    // ── 2. Calcula métricas por estágio ───────────────────────────────────────
    const stageMetrics = {}
    for (const stage of REAL_STAGES) {
      const leadsInStage = Object.entries(leadJourneys)
        .filter(([, j]) => j[stage])
        .map(([id, j]) => ({ id: Number(id), entered_at: j[stage] }))

      const entered = leadsInStage.length
      stageMetrics[stage] = { entered, durations_hours: [] }

      for (const { id, entered_at } of leadsInStage) {
        const journey = leadJourneys[id]
        // Tempo no estágio = tempo até entrar em qualquer outro estágio diferente deste
        const exits = REAL_STAGES
          .filter(s => s !== stage && journey[s] && journey[s] > entered_at)
          .map(s => journey[s])
        if (exits.length) {
          const exit = new Date(Math.min(...exits.map(d => d.getTime())))
          const hours = (exit - entered_at) / 3600000
          stageMetrics[stage].durations_hours.push(hours)
        }
      }
    }

    // ── 3. Conversão coorte: dos que entraram em N, quantos chegaram em N+1 ──
    const PIPELINE = ['NOVO','CONTATO','EXPERIMENTAL','PROPOSTA','MATRICULADO']
    const funnel = PIPELINE.map((stage, i) => {
      const { entered, durations_hours } = stageMetrics[stage]
      const nextStage = PIPELINE[i + 1] || null

      // Quantos leads que passaram por este estágio também chegaram no próximo
      let converted = 0
      if (nextStage) {
        converted = Object.values(leadJourneys)
          .filter(j => j[stage] && j[nextStage])
          .length
      }

      // Quantos foram perdidos a partir deste estágio
      // (estavam aqui e foram para PERDIDO antes de avançar ao próximo estágio real)
      const lost_here = nextStage
        ? Object.values(leadJourneys)
            .filter(j => {
              if (!j[stage]) return false
              if (j[nextStage]) return false // avançou, não perdido aqui
              return !!j['PERDIDO']
            }).length
        : 0

      const still_here = entered - converted - lost_here

      // Tempo médio em dias (arredondado para 1 casa decimal)
      const avg_days = durations_hours.length
        ? Math.round((durations_hours.reduce((a, b) => a + b, 0) / durations_hours.length) / 24 * 10) / 10
        : null

      const conversion_rate = entered > 0 && nextStage
        ? Math.round((converted / entered) * 100) : null

      const dropout_rate = entered > 0 && nextStage
        ? Math.round((lost_here / entered) * 100) : null

      return { stage, entered, converted, lost_here, still_here, conversion_rate, dropout_rate, avg_days }
    })

    // ── 4. Tempo médio do ciclo completo (Novo → Matriculado) ─────────────────
    const closedLeads = Object.values(leadJourneys).filter(j => j['NOVO'] && j['MATRICULADO'])
    const avg_days_to_close = closedLeads.length
      ? Math.round(
          closedLeads.reduce((sum, j) => sum + (j['MATRICULADO'] - j['NOVO']) / 86400000, 0)
          / closedLeads.length * 10) / 10
      : null

    // ── 5. Contagem atual por estágio (snapshot = o que está no kanban) ─────────
    const [currentCounts] = await pool.query(`
      SELECT stage, COUNT(*) AS total
      FROM crm_leads
      WHERE school_id = ? AND archived = 0
      GROUP BY stage
    `, [sid])
    const currentMap = Object.fromEntries(currentCounts.map(r => [r.stage, Number(r.total)]))

    // Adiciona current_count a cada estágio do funil
    const funnelWithCurrent = funnel.map(f => ({
      ...f,
      current_count: currentMap[f.stage] || 0,
    }))

    // ── 6. Queries auxiliares ─────────────────────────────────────────────────
    const [[totalActive]] = await pool.query(
      `SELECT COUNT(*) AS total FROM crm_leads WHERE school_id=? AND archived=0`, [sid]
    )
    const enrolled = currentMap['MATRICULADO'] || 0

    const [forecast] = await pool.query(`
      SELECT DATE_FORMAT(expected_enrollment_date,'%Y-%m-%d') AS date, COUNT(*) AS count
      FROM crm_leads
      WHERE school_id=? AND archived=0 AND stage NOT IN ('MATRICULADO','PERDIDO')
        AND expected_enrollment_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
      GROUP BY expected_enrollment_date ORDER BY expected_enrollment_date
    `, [sid])

    const [lostReasons] = await pool.query(`
      SELECT COALESCE(lost_reason_type,'OUTRO') AS reason, COUNT(*) AS total
      FROM crm_leads WHERE school_id=? AND stage='PERDIDO'
      GROUP BY COALESCE(lost_reason_type,'OUTRO') ORDER BY total DESC
    `, [sid])

    const totalLeads = Number(totalActive.total)
    const totalEnrolled = enrolled

    res.json({
      funnel: funnelWithCurrent,
      overall_conversion: totalLeads > 0 ? Math.round((totalEnrolled / totalLeads) * 100) : 0,
      total_leads:       totalLeads,
      total_enrolled:    totalEnrolled,
      avg_days_to_close,
      forecast_30d:      forecast.map(r => ({ ...r, count: Number(r.count) })),
      lost_reasons:      lostReasons.map(r => ({ ...r, total: Number(r.total) })),
    })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao buscar métricas' }) }
}

// ─── Feed / Archive ───────────────────────────────────────────────────────────

/**
 * getRecentFeed - retorna últimos logs de estágio
 *
 * Locals:
 * - sid, rows
 */
export async function getRecentFeed(req, res) {
  const sid = req.schoolId
  try {
    await ensureCrmTables()
    const [rows] = await pool.query(`
      SELECT l.id, l.lead_id, l.from_stage, l.to_stage, l.note, l.created_at,
             u.full_name AS changed_by_name, c.name AS lead_name
      FROM crm_stage_logs l
      LEFT JOIN users u ON u.id=l.changed_by
      LEFT JOIN crm_leads c ON c.id=l.lead_id
      WHERE l.school_id=? ORDER BY l.created_at DESC LIMIT 50
    `, [sid])
    res.json(rows)
  } catch (err) { 
    console.error('Erro ao buscar feed:', err)
    res.status(500).json({ error: 'Erro ao buscar feed' }) 
  }
}

/**
 * archiveEnrolled - arquiva leads matriculados antigos
 *
 * Locals:
 * - sid, r
 */
export async function archiveEnrolled(req, res) {
  const sid = req.schoolId
  try {
    const [r] = await pool.query(`
      UPDATE crm_leads SET archived=1
      WHERE school_id=? AND stage='MATRICULADO' AND archived=0
        AND enrolled_at IS NOT NULL
        AND (YEAR(enrolled_at)<YEAR(NOW()) OR MONTH(enrolled_at)<MONTH(NOW()))
    `, [sid])
    res.json({ archived: r.affectedRows })
  } catch (err) { 
    console.error('Erro ao arquivar leads matriculados:', err)
    res.status(500).json({ error: 'Erro ao arquivar' }) 
  }
}

/**
 * archiveLost - arquiva leads perdidos antigos
 *
 * Locals:
 * - sid, r
 */
export async function archiveLost(req, res) {
  const sid = req.schoolId
  try {
    const [r] = await pool.query(`
      UPDATE crm_leads SET archived=1
      WHERE school_id=? AND stage='PERDIDO' AND archived=0
        AND lost_at IS NOT NULL
        AND (YEAR(lost_at)<YEAR(NOW()) OR MONTH(lost_at)<MONTH(NOW()))
    `, [sid])
    res.json({ archived: r.affectedRows })
  } catch (err) { 
    console.error('Erro ao arquivar leads perdidos:', err)
    res.status(500).json({ error: 'Erro ao arquivar' }) 
  }
}




