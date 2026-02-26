// Importa o router do express
// O router é um mini app que permite definir rotas separadas do app principal
import { Router } from "express";

// Importa funções do controller de alunos
import {
    createStudent,
    getAllStudents,
    getStudentById,
    updateStudent,
    deleteStudent
} from '../controllers/studentController.js'

// Cria uma instancia do Router
const router = Router()

// Define rotas:
// Cada rota conecta um metodo http + url a uma função do controller
// O '/' é relativo - no app.js vamos montar em '/students',
// então '/' vira '/students' e o '/:id' vira '/students/:id'

router.get('/', getAllStudents)         // GET /students → lista todos os alunos
router.get('/:id', getStudentById)     // GET /students/5 → busca aluno com id 5
router.post('/', createStudent)        // POST /students → cadastra novo aluno
router.put('/:id', updateStudent)      // PUT /students/5 → atualiza aluno com id 5
router.delete('/:id', deleteStudent)   // DELETE /students/5 → remove aluno com id 5

// Exporta o router para ser usado no app.js
export default router