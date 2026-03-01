import express from 'express';
const router = express.Router();
import * as adminController from '../controllers/adminController.js';
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

// Listagem de Usuários
router.get('/users', authenticate, isAdmin, adminController.getAllUsers);
router.get('/users/:id', authenticate, isAdmin, adminController.getUserDetails);

// Turmas de um aluno
router.get('/students/:id/classes', authenticate, isAdmin, adminController.getStudentClasses);

// Frequência de um aluno
router.get('/students/:id/attendance', authenticate, isAdmin, adminController.getStudentAttendance);

// Atividades e notas de um aluno
router.get('/students/:id/assignments', authenticate, isAdmin, adminController.getStudentAssignments);

export default router;
