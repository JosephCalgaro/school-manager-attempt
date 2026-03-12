import express from 'express'
import path from 'path'
import cors from 'cors'

import pool from './database/connection.js'
import { ensureContactColumns } from './database/migrations.js'
import { authenticate } from './middlewares/auth.js'

import authRoutes from './routes/authRoutes.js'
import adminRoutes from './routes/adminRoutes.js'
import teacherRoutes from './routes/teacherRoutes.js'
import secretaryRoutes from './routes/secretaryRoutes.js'
import studentSelfRoutes from './routes/studentSelfRoutes.js'
import responsibleSelfRoutes from './routes/resposibleSelfRoutes.js'

const app = express()

app.use(cors())
app.use(express.json({ limit: '25mb' }))
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')))

ensureContactColumns().catch((error) => {
  console.error('Erro ao aplicar migrações:', error)
})

app.use('/auth',       authRoutes)
app.use('/admin',      authenticate, adminRoutes)
app.use('/teacher',    authenticate, teacherRoutes)
app.use('/secretary',  authenticate, secretaryRoutes)
app.use('/student',    studentSelfRoutes)
app.use('/responsible', responsibleSelfRoutes)

app.get('/ping', async (req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ message: 'API funcionando', database: 'MySQL conectado com sucesso 🚀' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao conectar no banco de dados' })
  }
})

export default app
