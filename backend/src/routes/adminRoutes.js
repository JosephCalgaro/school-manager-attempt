import express from 'express';
const router = express.Router();
import * as adminController from '../controllers/adminController.js';
import {
  createClassAssignment,
  deleteClassAssignment,
  getTeacherClassById,
  getTeacherClasses,
  registerClassAttendance,
  upsertAssignmentCompletions,
  upsertStudentNotes,
  updateClassAssignment
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
router.get('/students', authenticate, isAdmin, adminController.getAllStudents);
router.get('/students/:id', authenticate, isAdmin, adminController.getStudentDetails);
router.put('/students/:id', authenticate, isAdmin, adminController.updateStudentDetails);

// Listagem de Usuários
router.get('/users', authenticate, isAdmin, adminController.getAllUsers);
router.get('/users/:id', authenticate, isAdmin, adminController.getUserDetails);

// Turmas de um aluno
router.get('/students/:id/classes', authenticate, isAdmin, adminController.getStudentClasses);

// Frequência de um aluno
router.get('/students/:id/attendance', authenticate, isAdmin, adminController.getStudentAttendance);

// Atividades e notas de um aluno
router.get('/students/:id/assignments', authenticate, isAdmin, adminController.getStudentAssignments);

// Gestão de turmas/atividades/notas no painel admin
router.get('/classes', authenticate, isAdmin, getTeacherClasses);
router.get('/classes/:id', authenticate, isAdmin, getTeacherClassById);
router.post('/classes/:id/attendance', authenticate, isAdmin, registerClassAttendance);
router.post('/classes/:id/notes', authenticate, isAdmin, upsertStudentNotes);
router.post('/classes/:id/assignments', authenticate, isAdmin, createClassAssignment);
router.put('/classes/:id/assignments/:assignmentId', authenticate, isAdmin, updateClassAssignment);
router.post('/classes/:id/assignments/:assignmentId/completions', authenticate, isAdmin, upsertAssignmentCompletions);
router.delete('/classes/:id/assignments/:assignmentId', authenticate, isAdmin, deleteClassAssignment);

export default router;
