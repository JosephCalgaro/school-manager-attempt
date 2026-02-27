// Importa o framework Express (servidor HTTP)
import express from 'express'

// Importa o CORS (permite que o frontend acesse a API)
import cors from 'cors'

// Importa o pool de conexão com o MySQL
import pool from './database/connection.js'

// Importa autenticação de token JWT
import { authenticate } from './middlewares/auth.js'

// Importa rotas de alunos
import studentRoutes from './routes/studentRoutes.js'

// Importa rotas de usuários
import userRoutes from './routes/userRoutes.js'

// Importa rotas de autenticação de login
import authRoutes from './routes/authRoutes.js'

// Importa rotas de turmas
import classRoutes from './routes/classRoutes.js'

// Importa rotas de tarefas
import assignmentRoutes from './routes/assignmentRoutes.js'

// Cria a aplicação Express
const app = express()

// Habilita CORS para permitir requisições externas (React, etc.)
app.use(cors())

// Permite que a API receba JSON no body das requisições
app.use(express.json())

// Protege e monta as rotas de alunos /students
app.use('/students', authenticate, studentRoutes)

// Protege e monta as rotas de usuários /users
app.use('/users', authenticate, userRoutes)

// Protege e monta as rotas de turmas /classes
app.use('/classes', authenticate, classRoutes)

// Protege e monta as rotas de tarefas /assignments
app.use('/assignments', authenticate, assignmentRoutes)

// Monta as rotas de autenticação no caminho /auth
app.use('/auth', authRoutes)

// Rota de teste da API
// Usada para verificar se:
// 1) O servidor está rodando
// 2) O MySQL está conectado
app.get('/ping', async (req, res) => {
try {
    // Executa uma query simples no banco
    // "SELECT 1" não acessa nenhuma tabela, só testa a conexão
    const [rows] = await pool.query('SELECT 1')

    // Se chegou aqui, o banco está conectado
    res.json({
    message: 'API funcionando',
    database: 'MySQL conectado com sucesso 🚀'
    })
} catch (error) {
    // Se ocorrer qualquer erro, ele cai aqui
    console.error(error)

    // Retorna erro 500 (erro interno do servidor)
    res.status(500).json({
    error: 'Erro ao conectar no banco de dados'
    })
}
})

// Exporta o app para ser usado pelo server.js
export default app