import { Router } from 'express'
import { getMySchool, updateMySchool } from '../controllers/schoolsController.js'

const router = Router()

// Rotas para o admin da escola ver e editar os dados da própria escola
// Montado em: /admin/school  (authenticate + isAdmin já aplicados)
router.get('/',  getMySchool)
router.put('/',  updateMySchool)

export default router
