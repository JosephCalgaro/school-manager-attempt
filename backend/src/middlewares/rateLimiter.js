// ─── Rate limiter simples em memória ─────────────────────────────────────────
// Sem dependências externas. Bloqueia após MAX_ATTEMPTS tentativas falhas.
// O IP é liberado após BLOCK_DURATION_MS milissegundos.

const MAX_ATTEMPTS     = 8
const BLOCK_DURATION   = 15 * 60 * 1000  // 15 minutos em ms
const WINDOW_DURATION  = 10 * 60 * 1000  // janela de 10 minutos para contagem

const attempts = new Map() // ip -> { count, firstAttempt, blockedUntil }

function getIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim()
    || req.socket?.remoteAddress
    || 'unknown'
}

export function loginRateLimiter(req, res, next) {
  const ip  = getIp(req)
  const now = Date.now()
  const rec = attempts.get(ip)

  if (rec) {
    // IP bloqueado?
    if (rec.blockedUntil && now < rec.blockedUntil) {
      const remaining = Math.ceil((rec.blockedUntil - now) / 60000)
      return res.status(429).json({
        error: `Muitas tentativas. Tente novamente em ${remaining} minuto${remaining > 1 ? 's' : ''}.`,
        retry_after: rec.blockedUntil,
      })
    }

    // Janela expirou — reseta
    if (now - rec.firstAttempt > WINDOW_DURATION) {
      attempts.delete(ip)
    }
  }

  next()
}

export function recordFailedLogin(ip) {
  const now = Date.now()
  const rec = attempts.get(ip) || { count: 0, firstAttempt: now, blockedUntil: null }

  // Janela expirou — reseta
  if (now - rec.firstAttempt > WINDOW_DURATION) {
    rec.count        = 0
    rec.firstAttempt = now
    rec.blockedUntil = null
  }

  rec.count++

  if (rec.count >= MAX_ATTEMPTS) {
    rec.blockedUntil = now + BLOCK_DURATION
    console.warn(`[security] IP ${ip} bloqueado por ${BLOCK_DURATION / 60000}min após ${rec.count} tentativas`)
  }

  attempts.set(ip, rec)
}

export function clearLoginAttempts(ip) {
  attempts.delete(ip)
}

// Limpeza periódica para evitar crescimento da memória
setInterval(() => {
  const now = Date.now()
  for (const [ip, rec] of attempts.entries()) {
    const expired = rec.blockedUntil
      ? now > rec.blockedUntil
      : now - rec.firstAttempt > WINDOW_DURATION
    if (expired) attempts.delete(ip)
  }
}, 5 * 60 * 1000) // a cada 5 minutos
