import pool from '../database/connection.js';

// ============ CONTADORES ============
export const getStats = async (req, res) => {
  try {
    const [studentsCount] = await pool.query('SELECT COUNT(*) as total FROM students');
    const [usersCount] = await pool.query('SELECT COUNT(*) as total FROM users');
    const [usersByRole] = await pool.query('SELECT role, COUNT(*) as count FROM users GROUP BY role');

    res.json({
      totalStudents: studentsCount[0].total,
      totalUsers: usersCount[0].total,
      usersByRole: usersByRole
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ message: 'Erro ao buscar estatísticas' });
  }
};

// ============ ALUNOS ============
export const getAllStudents = async (req, res) => {
  try {
    const { search, limit = 10, offset = 0 } = req.query;
    let query = 'SELECT id, full_name, cpf, email, phone, birth_date, created_at FROM students';
    let params = [];

    if (search) {
      query += ' WHERE full_name LIKE ? OR email LIKE ? OR cpf LIKE ?';
      const searchTerm = `%${search}%`;
      params = [searchTerm, searchTerm, searchTerm];
    }

    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [students] = await pool.query(query, params);
    let countQuery = 'SELECT COUNT(*) as total FROM students';
    let countParams = [];
    if (search) {
      countQuery += ' WHERE full_name LIKE ? OR email LIKE ? OR cpf LIKE ?';
      countParams = [ `%${search}%`, `%${search}%`, `%${search}%` ];
    }
    const [countResult] = await pool.query(countQuery, countParams);

    res.json({ data: students, total: countResult[0].total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (error) {
    console.error('Erro ao listar alunos:', error);
    res.status(500).json({ message: 'Erro ao listar alunos' });
  }
};

export const getStudentDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const [students] = await pool.query('SELECT * FROM students WHERE id = ?', [id]);
    if (students.length === 0) return res.status(404).json({ message: 'Aluno não encontrado' });
    const student = students[0];
    let responsible = null;
    if (student.responsible_id) {
      const [responsibles] = await pool.query('SELECT * FROM responsibles WHERE id = ?', [student.responsible_id]);
      responsible = responsibles[0] || null;
    }
    res.json({ ...student, responsible });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar detalhes do aluno' });
  }
};

export const updateStudentDetails = async (req, res) => {
  const { id } = req.params;
  const {
    full_name,
    cpf,
    rg,
    birth_date,
    address,
    email,
    phone,
    due_day,
    responsible
  } = req.body || {};

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [students] = await conn.query('SELECT * FROM students WHERE id = ?', [id]);
    if (students.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Aluno não encontrado' });
    }
    const current = students[0];

    const studentFields = [];
    const studentValues = [];
    if (full_name !== undefined) { studentFields.push('full_name = ?'); studentValues.push(full_name); }
    if (cpf !== undefined) { studentFields.push('cpf = ?'); studentValues.push(String(cpf).replace(/\D/g, '')); }
    if (rg !== undefined) { studentFields.push('rg = ?'); studentValues.push(rg); }
    if (birth_date !== undefined) { studentFields.push('birth_date = ?'); studentValues.push(birth_date); }
    if (address !== undefined) { studentFields.push('address = ?'); studentValues.push(address); }
    if (email !== undefined) { studentFields.push('email = ?'); studentValues.push(email); }
    if (phone !== undefined) { studentFields.push('phone = ?'); studentValues.push(phone || null); }
    if (due_day !== undefined) { studentFields.push('due_day = ?'); studentValues.push(due_day); }

    if (studentFields.length > 0) {
      await conn.query(
        `UPDATE students SET ${studentFields.join(', ')} WHERE id = ?`,
        [...studentValues, id]
      );
    }

    if (responsible && current.responsible_id) {
      const responsibleFields = [];
      const responsibleValues = [];
      if (responsible.full_name !== undefined) { responsibleFields.push('full_name = ?'); responsibleValues.push(responsible.full_name); }
      if (responsible.cpf !== undefined) { responsibleFields.push('cpf = ?'); responsibleValues.push(String(responsible.cpf).replace(/\D/g, '')); }
      if (responsible.rg !== undefined) { responsibleFields.push('rg = ?'); responsibleValues.push(responsible.rg); }
      if (responsible.birth_date !== undefined) { responsibleFields.push('birth_date = ?'); responsibleValues.push(responsible.birth_date); }
      if (responsible.address !== undefined) { responsibleFields.push('address = ?'); responsibleValues.push(responsible.address); }
      if (responsible.email !== undefined) { responsibleFields.push('email = ?'); responsibleValues.push(responsible.email); }
      if (responsible.phone !== undefined) { responsibleFields.push('phone = ?'); responsibleValues.push(responsible.phone || null); }

      if (responsibleFields.length > 0) {
        await conn.query(
          `UPDATE responsibles SET ${responsibleFields.join(', ')} WHERE id = ?`,
          [...responsibleValues, current.responsible_id]
        );
      }
    }

    await conn.commit();
    res.json({ message: 'Aluno atualizado com sucesso' });
  } catch (error) {
    await conn.rollback();
    if (error?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'CPF ou email já cadastrado' });
    }
    console.error('Erro ao atualizar aluno:', error);
    res.status(500).json({ message: 'Erro ao atualizar aluno' });
  } finally {
    conn.release();
  }
};

export const getStudentClasses = async (req, res) => {
  try {
    const { id } = req.params;
    const [classes] = await pool.query(
      `SELECT c.id, c.name, c.schedule, u.full_name as teacher_name FROM classes c INNER JOIN class_students cs ON c.id = cs.class_id LEFT JOIN users u ON c.teacher_id = u.id WHERE cs.student_id = ?`,
      [id]
    );
    res.json(classes);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar turmas do aluno' });
  }
};

export const getStudentAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { classId } = req.query;
    let query = `SELECT a.id, a.date, a.present, c.name as class_name FROM attendance a INNER JOIN classes c ON a.class_id = c.id WHERE a.student_id = ?`;
    let params = [id];
    if (classId) { query += ' AND a.class_id = ?'; params.push(classId); }
    query += ' ORDER BY a.date DESC';
    const [attendance] = await pool.query(query, params);
    const total = attendance.length;
    const present = attendance.filter(a => a.present).length;
    const percentage = total > 0 ? ((present / total) * 100).toFixed(2) : 0;
    res.json({ attendance, statistics: { total, present, absent: total - present, percentage: `${percentage}%` } });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar frequência do aluno' });
  }
};

export const getStudentAssignments = async (req, res) => {
  try {
    const { id } = req.params;
    const [assignments] = await pool.query(
      `SELECT a.id, a.title, a.type, a.max_score, a.due_date, a.description, c.name as class_name, g.score FROM assignments a INNER JOIN classes c ON a.class_id = c.id INNER JOIN class_students cs ON c.id = cs.class_id LEFT JOIN grades g ON a.id = g.assignment_id AND g.student_id = ? WHERE cs.student_id = ? ORDER BY a.due_date DESC`,
      [id, id]
    );
    res.json(assignments);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar atividades do aluno' });
  }
};

// ============ USUÁRIOS ============
export const getAllUsers = async (req, res) => {
  try {
    const { search, role, limit = 10, offset = 0 } = req.query;
    let query = 'SELECT id, full_name, email, phone, role, is_active, created_at FROM users';
    let params = [];
    let conditions = [];
    if (search) { conditions.push('(full_name LIKE ? OR email LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
    if (role) { conditions.push('role = ?'); params.push(role); }
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    const [users] = await pool.query(query, params);
    let countQuery = 'SELECT COUNT(*) as total FROM users';
    if (conditions.length > 0) countQuery += ' WHERE ' + conditions.join(' AND ');
    const [countResult] = await pool.query(countQuery, params.slice(0, -2));
    res.json({ data: users, total: countResult[0].total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao listar usuários' });
  }
};

export const getUserDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const [users] = await pool.query('SELECT id, full_name, email, phone, role, is_active, created_at, updated_at FROM users WHERE id = ?', [id]);
    if (users.length === 0) return res.status(404).json({ message: 'Usuário não encontrado' });
    const user = users[0];
    let classes = [];
    if (user.role === 'TEACHER') {
      const [teacherClasses] = await pool.query('SELECT id, name, schedule FROM classes WHERE teacher_id = ?', [id]);
      classes = teacherClasses;
    }
    res.json({ ...user, classes });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar detalhes do usuário' });
  }
};
