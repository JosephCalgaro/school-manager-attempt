import express from 'express'
import path    from 'path'
import cors    from 'cors'
import cookieParser from 'cookie-parser'

import pool from './database/connection.js'
import { ensureContactColumns }           from './database/migrations.js'
import { ensureIndexes }                  from './database/indexes.js'
import { initCrmTables }                  from './controllers/crmController.js'
import { authenticate }                   from './middlewares/auth.js'
import { requestLogger, errorHandler }    from './middlewares/logger.js'

import authRoutes            from './routes/authRoutes.js'
import adminRoutes           from './routes/adminRoutes.js'
import teacherRoutes         from './routes/teacherRoutes.js'
import secretaryRoutes       from './routes/secretaryRoutes.js'
import studentSelfRoutes     from './routes/studentSelfRoutes.js'
import responsibleSelfRoutes from './routes/responsibleSelfRoutes.js'
import schoolsRoutes         from './routes/schoolsRoutes.js'
import saasRoutes            from './routes/saasRoutes.js'

const app = express()

// ─── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}))  

// ─── Body parser ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }))

// ─── Arquivos estáticos ────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')))

// ─── Logger estruturado (todas as rotas) ──────────────────────────────────────
app.use(requestLogger)

// ─── Migrações ao iniciar ─────────────────────────────────────────────────────
ensureContactColumns().catch((error) => {
  console.error('Erro ao aplicar migrações:', error)
})
initCrmTables().catch((error) => {
  console.error('Erro ao inicializar tabelas CRM:', error)
})
ensureIndexes().catch((error) => {
  console.error('Erro ao aplicar índices:', error)
})

// ─── Cookie parser ─────────────────────────────────────────────────────────────
app.use(cookieParser())

// ─── Rotas públicas ───────────────────────────────────────────────────────────
app.use('/auth',        authRoutes)

// ─── Rotas autenticadas ───────────────────────────────────────────────────────
app.use('/admin',       authenticate, adminRoutes)
app.use('/admin/school', authenticate, schoolsRoutes)  // escola vê ela mesma
app.use('/teacher',     authenticate, teacherRoutes)
app.use('/secretary',   authenticate, secretaryRoutes)
app.use('/student',     authenticate, studentSelfRoutes)
app.use('/responsible', authenticate, responsibleSelfRoutes)

// ─── Rotas SaaS owner (master key) ───────────────────────────────────────────
app.use('/saas', saasRoutes)

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/ping', async (req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ ok: true, message: 'API funcionando', db: 'conectado' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ ok: false, error: 'Banco de dados inacessível' })
  }
})

// ─── Error handler global ─────────────────────────────────────────────────────
app.use(errorHandler)

export default app
