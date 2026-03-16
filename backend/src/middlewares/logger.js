// Structured JSON logger middleware
// Logs every request with: timestamp, method, path, status, duration, schoolId, userId, ip

import fs from 'fs'
import path from 'path'

const LOG_DIR  = path.resolve(process.cwd(), 'logs')
const LOG_FILE = path.join(LOG_DIR, 'app.log')
const MAX_BYTES = 10 * 1024 * 1024  // 10 MB — rotaciona automaticamente

// Cria o diretório de logs se não existir
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })

// Rotação simples: renomeia app.log → app.1.log quando passa de 10MB
function maybeRotate() {
  try {
    const stat = fs.statSync(LOG_FILE)
    if (stat.size >= MAX_BYTES) {
      const rotated = path.join(LOG_DIR, 'app.1.log')
      if (fs.existsSync(rotated)) fs.unlinkSync(rotated)
      fs.renameSync(LOG_FILE, rotated)
    }
  } catch { /* arquivo pode não existir ainda */ }
}

function writeLog(entry) {
  maybeRotate()
  const line = JSON.stringify(entry) + '\n'
  fs.appendFileSync(LOG_FILE, line, 'utf8')
}

// ─── Logger de requisições HTTP ───────────────────────────────────────────────
export function requestLogger(req, res, next) {
  const start = Date.now()
  const { method, originalUrl, ip } = req

  // Captura o fim da resposta
  res.on('finish', () => {
    const entry = {
      ts:       new Date().toISOString(),
      level:    res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO',
      method,
      path:     originalUrl,
      status:   res.statusCode,
      ms:       Date.now() - start,
      schoolId: req.schoolId  ?? null,
      userId:   req.userId    ?? null,
      role:     req.userRole  ?? null,
      ip:       (ip || '').replace('::ffff:', ''),
    }
    writeLog(entry)
    // Também imprime no console durante desenvolvimento
    if (process.env.NODE_ENV !== 'production') {
      const color = entry.level === 'ERROR' ? '\x1b[31m'
                  : entry.level === 'WARN'  ? '\x1b[33m' : '\x1b[32m'
      console.log(`${color}[${entry.ts}] ${method} ${originalUrl} ${res.statusCode} ${entry.ms}ms\x1b[0m`)
    }
  })
  next()
}

// ─── Logger de erros internos ─────────────────────────────────────────────────
export function logError(err, req = null) {
  const entry = {
    ts:       new Date().toISOString(),
    level:    'ERROR',
    message:  err?.message || String(err),
    stack:    err?.stack?.split('\n').slice(0, 5).join(' | '),
    path:     req?.originalUrl ?? null,
    schoolId: req?.schoolId    ?? null,
    userId:   req?.userId      ?? null,
  }
  writeLog(entry)
  console.error('\x1b[31m[ERROR]', entry.message, '\x1b[0m')
}

// ─── Middleware de erros Express ──────────────────────────────────────────────
export function errorHandler(err, req, res, next) {
  logError(err, req)
  res.status(500).json({ error: 'Erro interno do servidor' })
}

// ─── Utilitário para logar eventos de negócio ─────────────────────────────────
export function logEvent(level = 'INFO', event, data = {}) {
  writeLog({ ts: new Date().toISOString(), level, event, ...data })
}

// ─── Endpoint para o SaaS owner consultar logs ────────────────────────────────
export function getRecentLogs(req, res) {
  try {
    const { limit = 200, level, school_id } = req.query
    if (!fs.existsSync(LOG_FILE)) return res.json([])

    const lines = fs.readFileSync(LOG_FILE, 'utf8')
      .split('\n')
      .filter(Boolean)
      .slice(-Number(limit))
      .map(l => { try { return JSON.parse(l) } catch { return null } })
      .filter(Boolean)

    const filtered = lines.filter(l => {
      if (level     && l.level    !== level.toUpperCase())    return false
      if (school_id && String(l.schoolId) !== String(school_id)) return false
      return true
    }).reverse()  // mais recente primeiro

    res.json(filtered)
  } catch (err) {
    res.status(500).json({ error: 'Erro ao ler logs' })
  }
}
