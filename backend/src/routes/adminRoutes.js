import express from 'express';
const router = express.Router();
import * as adminController from '../controllers/adminController.js';
import {
  getAllResponsibles, getResponsibleById,
  createResponsible, updateResponsible, deleteResponsible,
  getStudentsByResponsibleId, toggleResponsibleActive,
} from '../controllers/responsiblesController.js'
import {
  createClassAssignment,
  deleteClassAssignment,
  getTeacherClassById,
  getTeacherClasses,
  registerClassAttendance,
  upsertAssignmentCompletions,
  upsertStudentNotes,
  updateClassAssignment,
  getMyTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getLessonPlans,
  createLessonPlan,
  updateLessonPlan,
  deleteLessonPlan,
} from '../controllers/teacherController.js';
import { authenticate } from '../middlewares/auth.js';

// Middleware para verificar se é admin
const isAdmin = (req, res, next) => {
  if (req.userRole !== 'ADMIN') {
    return res.status(403).json({ message: 'Acesso negado. Apenas administradores.' });
  }
  next();
};

// Contadores
router.get('/stats', authenticate, isAdmin, adminController.getStats);

// Listagem de Alunos
router.get('/students',                 authenticate, isAdmin, adminController.getAllStudents);
router.post('/students',                authenticate, isAdmin, adminController.createStudent);
router.get('/students/:id',             authenticate, isAdmin, adminController.getStudentDetails);
router.put('/students/:id',             authenticate, isAdmin, adminController.updateStudentDetails);
router.patch('/students/:id/toggle',    authenticate, isAdmin, adminController.toggleStudentActive);

// Listagem de Usuários
router.get('/users',                    authenticate, isAdmin, adminController.getAllUsers);
router.get('/users/:id',                authenticate, isAdmin, adminController.getUserDetails);
router.post('/users',                   authenticate, isAdmin, adminController.createUser);
router.put('/users/:id',                authenticate, isAdmin, adminController.updateUser);
router.patch('/users/:id/toggle',       authenticate, isAdmin, adminController.toggleUserActive);

// Turmas de um aluno
router.get('/students/:id/classes', authenticate, isAdmin, adminController.getStudentClasses);

// Frequência de um aluno
router.get('/students/:id/attendance', authenticate, isAdmin, adminController.getStudentAttendance);

// Atividades e notas de um aluno
router.get('/students/:id/assignments', authenticate, isAdmin, adminController.getStudentAssignments);

// Gestão de turmas/atividades/notas no painel admin
router.get('/classes', authenticate, isAdmin, getTeacherClasses);
router.get('/classes/:id', authenticate, isAdmin, getTeacherClassById);
router.patch('/classes/:id/toggle', authenticate, isAdmin, adminController.toggleClassActive);
router.post('/classes/:id/attendance', authenticate, isAdmin, registerClassAttendance);
router.post('/classes/:id/notes', authenticate, isAdmin, upsertStudentNotes);
router.post('/classes/:id/assignments', authenticate, isAdmin, createClassAssignment);
router.put('/classes/:id/assignments/:assignmentId', authenticate, isAdmin, updateClassAssignment);
router.post('/classes/:id/assignments/:assignmentId/completions', authenticate, isAdmin, upsertAssignmentCompletions);
router.delete('/classes/:id/assignments/:assignmentId', authenticate, isAdmin, deleteClassAssignment);

// Responsáveis
router.get('/responsibles',              authenticate, isAdmin, getAllResponsibles)
router.get('/responsibles/:id',          authenticate, isAdmin, getResponsibleById)
router.post('/responsibles',             authenticate, isAdmin, createResponsible)
router.put('/responsibles/:id',          authenticate, isAdmin, updateResponsible)
router.delete('/responsibles/:id',       authenticate, isAdmin, deleteResponsible)
router.patch('/responsibles/:id/toggle', authenticate, isAdmin, toggleResponsibleActive)
router.get('/responsibles/:id/students', authenticate, isAdmin, getStudentsByResponsibleId)

// Planejamento de aula (admin)
router.get('/lesson-plans',               authenticate, isAdmin, getMyTemplates)
router.post('/lesson-plans',              authenticate, isAdmin, createTemplate)
router.put('/lesson-plans/:templateId',   authenticate, isAdmin, updateTemplate)
router.delete('/lesson-plans/:templateId',authenticate, isAdmin, deleteTemplate)
router.get('/classes/:id/lesson-plans',            authenticate, isAdmin, getLessonPlans)
router.post('/classes/:id/lesson-plans',           authenticate, isAdmin, createLessonPlan)
router.put('/classes/:id/lesson-plans/:planId',    authenticate, isAdmin, updateLessonPlan)
router.delete('/classes/:id/lesson-plans/:planId', authenticate, isAdmin, deleteLessonPlan)

export default router;
