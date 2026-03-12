import express from 'express'
import * as adminController from '../controllers/adminController.js'
import {
  getAllResponsibles, getResponsibleById,
  createResponsible, updateResponsible, deleteResponsible,
  getStudentsByResponsibleId, toggleResponsibleActive,
} from '../controllers/responsiblesController.js'
import {
  createClassAssignment, deleteClassAssignment,
  getTeacherClassById, getTeacherClasses,
  registerClassAttendance, upsertAssignmentCompletions,
  upsertStudentNotes, updateClassAssignment,
  getMyTemplates, createTemplate, updateTemplate, deleteTemplate,
  getLessonPlans, createLessonPlan, updateLessonPlan, deleteLessonPlan,
} from '../controllers/teacherController.js'
import {
  getLeads, createLead, updateLead, deleteLead,
  getActivities, createActivity, toggleActivity, archiveEnrolled, archiveLost,
} from '../controllers/crmController.js'

const router = express.Router()

// Nota: authenticate já é aplicado no app.js antes deste router.
// Este middleware garante apenas que o role seja ADMIN.
const isAdmin = (req, res, next) => {
  if (req.userRole !== 'ADMIN') {
    return res.status(403).json({ message: 'Acesso negado. Apenas administradores.' })
  }
  next()
}

router.use(isAdmin)

// Contadores
router.get('/stats', adminController.getStats)

// Alunos
router.get('/students',                 adminController.getAllStudents)
router.post('/students',                adminController.createStudent)
router.get('/students/:id',             adminController.getStudentDetails)
router.put('/students/:id',             adminController.updateStudentDetails)
router.patch('/students/:id/toggle',    adminController.toggleStudentActive)
router.get('/students/:id/classes',     adminController.getStudentClasses)
router.get('/students/:id/attendance',  adminController.getStudentAttendance)
router.get('/students/:id/assignments', adminController.getStudentAssignments)

// Usuários
router.get('/users',              adminController.getAllUsers)
router.get('/users/:id',          adminController.getUserDetails)
router.post('/users',             adminController.createUser)
router.put('/users/:id',          adminController.updateUser)
router.patch('/users/:id/toggle', adminController.toggleUserActive)

// Turmas
router.get('/classes',                                            getTeacherClasses)
router.post('/classes',                                           adminController.createClass)
router.get('/classes/:id',                                        getTeacherClassById)
router.put('/classes/:id',                                        adminController.updateClass)
router.patch('/classes/:id/toggle',                               adminController.toggleClassActive)
router.post('/classes/:id/attendance',                            registerClassAttendance)
router.post('/classes/:id/notes',                                 upsertStudentNotes)
router.post('/classes/:id/assignments',                           createClassAssignment)
router.put('/classes/:id/assignments/:assignmentId',              updateClassAssignment)
router.post('/classes/:id/assignments/:assignmentId/completions', upsertAssignmentCompletions)
router.delete('/classes/:id/assignments/:assignmentId',           deleteClassAssignment)

// Responsáveis
router.get('/responsibles',               getAllResponsibles)
router.get('/responsibles/:id',           getResponsibleById)
router.post('/responsibles',              createResponsible)
router.put('/responsibles/:id',           updateResponsible)
router.delete('/responsibles/:id',        deleteResponsible)
router.patch('/responsibles/:id/toggle',  toggleResponsibleActive)
router.get('/responsibles/:id/students',  getStudentsByResponsibleId)

// Planejamento de aula
router.get('/lesson-plans',                        getMyTemplates)
router.post('/lesson-plans',                       createTemplate)
router.put('/lesson-plans/:templateId',            updateTemplate)
router.delete('/lesson-plans/:templateId',         deleteTemplate)
router.get('/classes/:id/lesson-plans',            getLessonPlans)
router.post('/classes/:id/lesson-plans',           createLessonPlan)
router.put('/classes/:id/lesson-plans/:planId',    updateLessonPlan)
router.delete('/classes/:id/lesson-plans/:planId', deleteLessonPlan)

// CRM
router.get('/crm/leads',                      getLeads)
router.post('/crm/leads',                     createLead)
router.put('/crm/leads/:id',                  updateLead)
router.delete('/crm/leads/:id',               deleteLead)
router.get('/crm/leads/:id/activities',       getActivities)
router.post('/crm/leads/:id/activities',      createActivity)
router.patch('/crm/activities/:actId/toggle', toggleActivity)
router.post('/crm/archive-enrolled',          archiveEnrolled)
router.post('/crm/archive-lost',              archiveLost)

export default router
