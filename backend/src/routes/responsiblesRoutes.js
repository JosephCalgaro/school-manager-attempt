import {Router} from 'express'
import {
    createResponsible,
    getAllResponsibles,
    getResponsibleById,
    updateResponsible,
    deleteResponsible,
    getStudentsByResponsibleId
} from '../controllers/responsiblesController.js'

const router = Router()

router.get('/', getAllResponsibles)
router.get('/:id', getResponsibleById)
router.post('/', createResponsible)
router.put('/:id', updateResponsible)
router.delete('/:id', deleteResponsible)
router.get('/:id/students', getStudentsByResponsibleId)

export default router