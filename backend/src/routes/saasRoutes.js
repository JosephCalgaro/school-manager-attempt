import { Router } from 'express'
import {
  getSaasDashboard, getSchoolDetails,
  impersonateSchool, revokeImpersonation,
} from '../controllers/saasController.js'
import {
  listAllSchools, createSchoolWithAdmin,
  updateSchool, toggleSchool, deleteSchool,
} from '../controllers/schoolsController.js'
import { getRecentLogs } from '../middlewares/logger.js'

const router = Router()

const SAAS_KEY = process.env.SAAS_MASTER_KEY || 'saas_dev_key_change_in_production'

function requireSaasKey(req, res, next) {
  const key = req.headers['x-saas-key']
  if (!key || key !== SAAS_KEY) {
    return res.status(401).json({ error: 'Acesso negado. Chave SaaS inválida.' })
  }
  next()
}

router.use(requireSaasKey)

router.get('/dashboard',                  getSaasDashboard)
router.get('/logs',                       getRecentLogs)
router.get('/schools',                    listAllSchools)
router.post('/schools',                   createSchoolWithAdmin)
router.get('/schools/:id',                getSchoolDetails)
router.put('/schools/:id',                updateSchool)
router.patch('/schools/:id/toggle',       toggleSchool)
router.delete('/schools/:id',             deleteSchool)
router.post('/schools/:id/impersonate',   impersonateSchool)
router.delete('/schools/:id/impersonate', revokeImpersonation)

export default router
