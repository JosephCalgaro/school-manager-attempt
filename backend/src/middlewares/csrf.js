const CSRF_TOKEN_BYTES = 32
const CSRF_COOKIE_NAME = '__csrf'
const CSRF_HEADER_NAME = 'x-csrf-token'

function generateToken() {
  const bytes = new Uint8Array(CSRF_TOKEN_BYTES)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

export function csrfMiddleware(req, res, next) {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS']
  if (safeMethods.includes(req.method)) return next()

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME]
  const headerToken = req.headers[CSRF_HEADER_NAME]

  if (!cookieToken || !headerToken) {
    return res.status(403).json({ error: 'CSRF token ausente' })
  }
  if (cookieToken !== headerToken) {
    return res.status(403).json({ error: 'CSRF token inválido' })
  }

  next()
}

export function createCsrfToken(req, res) {
  const token = generateToken()
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 1000
  })
  return token
}

export { CSRF_COOKIE_NAME, CSRF_HEADER_NAME }
