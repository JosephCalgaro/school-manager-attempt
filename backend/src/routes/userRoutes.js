//importa o router do express
import { Router } from "express";

//importa as funções do controller de usuários
import {
    createUser,
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser
} from '../controllers/userController.js'

//cria uma instancia do Router
const router = Router()

//define rotas:
//cada rota conecta um metodo http + url a uma função do controller
//o '/' é relativo - no app.js vamos montar em '/users',
//então '/' vira '/users' e o '/:id' vira '/users/:id'
router.get('/', getAllUsers)
router.get('/:id', getUserById)
router.post('/', createUser)
router.put('/:id', updateUser)
router.delete('/:id', deleteUser)

//exporta o router para ser usado no app.js
export default router