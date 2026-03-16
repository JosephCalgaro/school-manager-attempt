import { Router } from 'express'
import { getLeads, createLead, updateLead, deleteLead, getActivities, createActivity, toggleActivity, archiveEnrolled, archiveLost, getRecentFeed } from '../controllers/crmController.js'
import {
  getAllStudents, getStudentDetails, createStudent, updateStudentDetails,
  getStudentClasses, getStudentAttendance, getStudentAssignments,
  getSecretaryStats,
  getAllClasses, createClass, updateClass, toggleClassActive,
  getClassStudentsList, addStudentToClass, removeStudentFromClass,
  toggleStudentActive,
} from '../controllers/adminController.js'
import {
  getAllResponsibles, getResponsibleById,
  createResponsible, updateResponsible, deleteResponsible,
  getStudentsByResponsibleId, toggleResponsibleActive,
} from '../controllers/responsiblesController.js'

const router = Router()

const isSecretary = (req, res, next) => {
  const role = (req.userRole || '').toUpperCase()
  if (role !== 'SECRETARY' && role !== 'ADMIN') {
    return res.status(403).json({ error: 'Acesso negado.' })
  }
  next()
}

router.use(isSecretary)

router.get('/stats',             getSecretaryStats)
router.get('/students',                     getAllStudents)
router.get('/students/:id',                 getStudentDetails)
router.post('/students',                    createStudent)
router.put('/students/:id',                 updateStudentDetails)
router.patch('/students/:id/toggle',        toggleStudentActive)
router.get('/students/:id/classes',         getStudentClasses)
router.get('/students/:id/attendance',      getStudentAttendance)
router.get('/students/:id/assignments',     getStudentAssignments)

// Turmas
router.get('/classes',                            getAllClasses)
router.post('/classes',                           createClass)
router.put('/classes/:id',                        updateClass)
router.patch('/classes/:id/toggle',               toggleClassActive)
router.get('/classes/:id/students',               getClassStudentsList)
router.post('/classes/:id/students',              addStudentToClass)
router.delete('/classes/:id/students/:studentId', removeStudentFromClass)

// Responsáveis
router.get('/responsibles',                    getAllResponsibles)
router.get('/responsibles/:id',                getResponsibleById)
router.post('/responsibles',                   createResponsible)
router.put('/responsibles/:id',                updateResponsible)
router.delete('/responsibles/:id',             deleteResponsible)
router.patch('/responsibles/:id/toggle',       toggleResponsibleActive)
router.get('/responsibles/:id/students',       getStudentsByResponsibleId)

// CRM
router.get('/crm/leads',                         getLeads)
router.post('/crm/leads',                        createLead)
router.put('/crm/leads/:id',                     updateLead)
router.delete('/crm/leads/:id',                  deleteLead)
router.get('/crm/leads/:id/activities',          getActivities)
router.post('/crm/leads/:id/activities',         createActivity)
router.patch('/crm/activities/:actId/toggle',    toggleActivity)
router.post('/crm/archive-enrolled',             archiveEnrolled)
router.post('/crm/archive-lost',                 archiveLost)
router.get('/crm/feed',                          getRecentFeed)

export default router
