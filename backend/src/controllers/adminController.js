import bcrypt from 'bcryptjs';
import pool from '../database/connection.js';

// (is_active columns are ensured at startup by migrations.js)

// ============ CONTADORES ============
export const getStats = async (req, res) => {
  try {
    const [[{ totalStudents }]] = await pool.query('SELECT COUNT(*) as totalStudents FROM students')
    const [[{ totalUsers }]]    = await pool.query('SELECT COUNT(*) as totalUsers FROM users')
    const [[{ totalClasses }]]  = await pool.query('SELECT COUNT(*) as totalClasses FROM classes')
    const [usersByRole]         = await pool.query('SELECT role, COUNT(*) as count FROM users GROUP BY role')

    res.json({ totalStudents, totalUsers, totalClasses, usersByRole })
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ message: 'Erro ao buscar estatísticas' });
  }
};

// ============ ALUNOS ============
export const getAllStudents = async (req, res) => {
  try {
    const { search, status, limit = 10, offset = 0 } = req.query;
    const conditions = []
    const params = []

    if (search) {
      conditions.push('(full_name LIKE ? OR email LIKE ? OR cpf LIKE ?)')
      const t = `%${search}%`; params.push(t, t, t)
    }
    if (status === 'active')   conditions.push('is_active = 1')
    if (status === 'inactive') conditions.push('is_active = 0')

    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : ''
    const query = `SELECT id, full_name, cpf, email, phone, birth_date, is_active, created_at FROM students${where} ORDER BY is_active DESC, full_name LIMIT ? OFFSET ?`
    const [students] = await pool.query(query, [...params, parseInt(limit), parseInt(offset)])

    const countQ = `SELECT COUNT(*) as total FROM students${where}`
    const [countResult] = await pool.query(countQ, params)

    res.json({ data: students, total: countResult[0].total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (error) {
    console.error('Erro ao listar alunos:', error);
    res.status(500).json({ message: 'Erro ao listar alunos' });
  }
};

export const toggleStudentActive = async (req, res) => {
  const { id } = req.params
  try {
    const [[s]] = await pool.query('SELECT is_active FROM students WHERE id = ?', [id])
    if (!s) return res.status(404).json({ message: 'Aluno não encontrado' })
    const newStatus = s.is_active ? 0 : 1
    await pool.query('UPDATE students SET is_active = ? WHERE id = ?', [newStatus, id])
    res.json({ is_active: newStatus, message: newStatus ? 'Aluno reativado' : 'Aluno desativado' })
  } catch (error) {
    console.error('Erro ao alterar status do aluno:', error)
    res.status(500).json({ message: 'Erro ao alterar status do aluno' })
  }
}

export const getStudentDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const [students] = await pool.query('SELECT * FROM students WHERE id = ?', [id]);
    if (students.length === 0) return res.status(404).json({ message: 'Aluno não encontrado' });
    const student = students[0];
    delete student.password_hash; // nunca expor o hash
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
    password,
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

    // Atualiza senha apenas se uma nova for enviada
    // (o hash é calculado de forma assíncrona com bcrypt)
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      studentFields.push('password_hash = ?');
      studentValues.push(hash);
    }

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
      `SELECT a.id, a.title, a.type, a.max_score, a.due_date, a.description, c.name as class_name, g.score FROM assignments a INNER JOIN classes c ON a.class_id = c.id INNER JOIN class_students cs ON c.id = cs.class_id LEFT JOIN grades g ON a.id = g.assignments_id AND g.student_id = ? WHERE cs.student_id = ? ORDER BY a.due_date DESC`,
      [id, id]
    );
    res.json(assignments);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar atividades do aluno' });
  }
};

export const createStudent = async (req, res) => {
  const {
    full_name, cpf, rg, birth_date, address, email, phone, due_day, password, responsible
  } = req.body || {};

  if (!full_name || !cpf || !email || !password) {
    return res.status(400).json({ message: 'Nome, CPF, email e senha são obrigatórios' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const password_hash = await bcrypt.hash(password, 10);

    let responsible_id = null;
    if (responsible?.full_name && responsible?.email) {
      // Se o responsável tiver senha, gera o hash; senão fica NULL (sem acesso ao sistema)
      const resp_hash = responsible.password
        ? await (await import('bcryptjs')).default.hash(responsible.password, 10)
        : null
      const [respResult] = await conn.query(
        `INSERT INTO responsibles (full_name, cpf, rg, birth_date, address, email, phone, password_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          responsible.full_name,
          responsible.cpf ? String(responsible.cpf).replace(/\D/g, '') : null,
          responsible.rg || null,
          responsible.birth_date || null,
          responsible.address || null,
          responsible.email,
          responsible.phone || null,
          resp_hash,
        ]
      );
      responsible_id = respResult.insertId;
    }

    const [result] = await conn.query(
      `INSERT INTO students (full_name, cpf, rg, birth_date, address, email, phone, due_day, password_hash, responsible_id, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        full_name,
        String(cpf).replace(/\D/g, ''),
        rg || null,
        birth_date || null,
        address || null,
        email,
        phone || null,
        due_day || null,
        password_hash,
        responsible_id,
      ]
    );

    await conn.commit();
    res.status(201).json({ id: result.insertId, message: 'Aluno cadastrado com sucesso' });
  } catch (error) {
    await conn.rollback();
    if (error?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'CPF ou email já cadastrado' });
    }
    console.error('Erro ao criar aluno:', error);
    res.status(500).json({ message: 'Erro ao criar aluno' });
  } finally {
    conn.release();
  }
};

// ============ USUÁRIOS ============
export const getAllUsers = async (req, res) => {
  try {
    const { search, role, status, limit = 10, offset = 0 } = req.query;
    let params = [];
    let conditions = [];
    if (search) { conditions.push('(full_name LIKE ? OR email LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
    if (role)   { conditions.push('role = ?'); params.push(role); }
    if (status === 'active')   conditions.push('is_active = 1')
    if (status === 'inactive') conditions.push('is_active = 0')
    const where = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : ''
    const query = `SELECT id, full_name, email, phone, role, is_active, created_at FROM users${where} ORDER BY is_active DESC, full_name LIMIT ? OFFSET ?`
    params.push(parseInt(limit), parseInt(offset));
    const [users] = await pool.query(query, params);
    const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM users${where}`, params.slice(0, -2));
    res.json({ data: users, total: countResult[0].total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao listar usuários' });
  }
};

export const toggleUserActive = async (req, res) => {
  const { id } = req.params
  try {
    const [[u]] = await pool.query('SELECT is_active FROM users WHERE id = ?', [id])
    if (!u) return res.status(404).json({ message: 'Usuário não encontrado' })
    const newStatus = u.is_active ? 0 : 1
    await pool.query('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, id])
    res.json({ is_active: newStatus, message: newStatus ? 'Usuário reativado' : 'Usuário desativado' })
  } catch (error) {
    console.error('Erro ao alterar status do usuário:', error)
    res.status(500).json({ message: 'Erro ao alterar status do usuário' })
  }
}

export const getUserDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const [users] = await pool.query(
      'SELECT id, full_name, email, phone, cpf, rg, birth_date, role, is_active, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );
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
export const createUser = async (req, res) => {
  const { full_name, email, phone, cpf, rg, birth_date, role, password } = req.body || {};
  const VALID_ROLES = ['ADMIN', 'TEACHER', 'SECRETARY'];

  if (!full_name || !email || !role || !password)
    return res.status(400).json({ message: 'Nome, email, função e senha são obrigatórios' });
  if (!VALID_ROLES.includes(role))
    return res.status(400).json({ message: 'Função inválida' });

  try {
    const password_hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      `INSERT INTO users (full_name, email, phone, cpf, rg, birth_date, role, password_hash, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [full_name, email, phone || null, cpf || null, rg || null, birth_date || null, role, password_hash]
    );
    res.status(201).json({ id: result.insertId, message: 'Usuário criado com sucesso' });
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ message: 'Email ou CPF já cadastrado' });
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({ message: 'Erro ao criar usuário' });
  }
};

export const updateUser = async (req, res) => {
  const { id } = req.params;
  const { full_name, email, phone, cpf, rg, birth_date, role, password, is_active } = req.body || {};
  const VALID_ROLES = ['ADMIN', 'TEACHER', 'SECRETARY'];

  if (role && !VALID_ROLES.includes(role))
    return res.status(400).json({ message: 'Função inválida' });

  try {
    const fields = [];
    const values = [];
    if (full_name  !== undefined) { fields.push('full_name = ?');  values.push(full_name); }
    if (email      !== undefined) { fields.push('email = ?');      values.push(email); }
    if (phone      !== undefined) { fields.push('phone = ?');      values.push(phone || null); }
    if (cpf        !== undefined) { fields.push('cpf = ?');        values.push(cpf || null); }
    if (rg         !== undefined) { fields.push('rg = ?');         values.push(rg || null); }
    if (birth_date !== undefined) { fields.push('birth_date = ?'); values.push(birth_date || null); }
    if (role       !== undefined) { fields.push('role = ?');       values.push(role); }
    if (is_active  !== undefined) { fields.push('is_active = ?');  values.push(is_active ? 1 : 0); }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      fields.push('password_hash = ?'); values.push(hash);
    }
    if (!fields.length) return res.status(400).json({ message: 'Nenhum campo para atualizar' });

    values.push(id);
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ message: 'Usuário atualizado com sucesso' });
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ message: 'Email ou CPF já cadastrado' });
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({ message: 'Erro ao atualizar usuário' });
  }
};

export const getSecretaryStats = async (req, res) => {
  try {
    const [[{ totalStudents }]] = await pool.query('SELECT COUNT(*) as totalStudents FROM students')
    const [[{ newThisMonth }]] = await pool.query(
      `SELECT COUNT(*) as newThisMonth FROM students
       WHERE MONTH(created_at) = MONTH(CURRENT_DATE())
         AND YEAR(created_at) = YEAR(CURRENT_DATE())`
    )
    const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
    const currentMonth = months[new Date().getMonth()]
    res.json({ totalStudents, newThisMonth, currentMonth })
  } catch (error) {
    console.error('Erro ao buscar stats secretaria:', error)
    res.status(500).json({ message: 'Erro ao buscar estatísticas' })
  }
}

// ============ TURMAS (secretary / admin) ============
export const getAllClasses = async (req, res) => {
  try {
    const { search, status } = req.query   // status: 'active' | 'inactive' | undefined (= all)
    let query = `
      SELECT c.id, c.name, c.schedule, c.classroom, c.is_active,
          u.full_name AS teacher_name,
          COUNT(cs.student_id) AS total_students
      FROM classes c
      LEFT JOIN users u ON u.id = c.teacher_id
      LEFT JOIN class_students cs ON cs.class_id = c.id
    `
    const conditions = []
    const params = []
    if (search)           { conditions.push('c.name LIKE ?');   params.push(`%${search}%`) }
    if (status === 'active')   conditions.push('c.is_active = 1')
    if (status === 'inactive') conditions.push('c.is_active = 0')
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ')
    query += ' GROUP BY c.id ORDER BY c.is_active DESC, c.name'
    const [classes] = await pool.query(query, params)
    res.json(classes)
  } catch (error) {
    console.error('Erro ao listar turmas:', error)
    res.status(500).json({ message: 'Erro ao listar turmas' })
  }
}

export const createClass = async (req, res) => {
  const { name, schedule, teacher_id, classroom, students } = req.body || {}
  if (!name) return res.status(400).json({ message: 'Nome da turma é obrigatório' })
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [result] = await conn.query(
      'INSERT INTO classes (name, schedule, teacher_id, classroom, is_active) VALUES (?, ?, ?, ?, 1)',
      [name, schedule || null, teacher_id || null, classroom || null]
    )
    const classId = result.insertId
    if (Array.isArray(students) && students.length > 0) {
      const rows = students.map(sid => [classId, sid])
      await conn.query('INSERT IGNORE INTO class_students (class_id, student_id) VALUES ?', [rows])
    }
    await conn.commit()
    res.status(201).json({ id: classId, message: 'Turma criada com sucesso' })
  } catch (error) {
    await conn.rollback()
    console.error('Erro ao criar turma:', error)
    res.status(500).json({ message: 'Erro ao criar turma' })
  } finally {
    conn.release()
  }
}

export const updateClass = async (req, res) => {
  const { id } = req.params
  const { name, schedule, teacher_id, classroom, is_active, students } = req.body || {}
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // Atualiza campos da turma se houver algum
    const fields = []; const values = []
    if (name       !== undefined) { fields.push('name = ?');       values.push(name) }
    if (schedule   !== undefined) { fields.push('schedule = ?');   values.push(schedule || null) }
    if (teacher_id !== undefined) { fields.push('teacher_id = ?'); values.push(teacher_id || null) }
    if (classroom  !== undefined) { fields.push('classroom = ?');  values.push(classroom || null) }
    if (is_active  !== undefined) { fields.push('is_active = ?');  values.push(is_active ? 1 : 0) }
    if (fields.length > 0) {
      await conn.query(`UPDATE classes SET ${fields.join(', ')} WHERE id = ?`, [...values, id])
    }

    // Sincroniza alunos se o array foi enviado
    if (Array.isArray(students)) {
      await conn.query('DELETE FROM class_students WHERE class_id = ?', [id])
      if (students.length > 0) {
        const rows = students.map(sid => [id, sid])
        await conn.query('INSERT IGNORE INTO class_students (class_id, student_id) VALUES ?', [rows])
      }
    }

    await conn.commit()
    res.json({ message: 'Turma atualizada com sucesso' })
  } catch (error) {
    await conn.rollback()
    console.error('Erro ao atualizar turma:', error)
    res.status(500).json({ message: 'Erro ao atualizar turma' })
  } finally {
    conn.release()
  }
}

export const toggleClassActive = async (req, res) => {
  const { id } = req.params
  try {
    const [[cls]] = await pool.query('SELECT is_active FROM classes WHERE id = ?', [id])
    if (!cls) return res.status(404).json({ message: 'Turma não encontrada' })
    const newStatus = cls.is_active ? 0 : 1
    await pool.query('UPDATE classes SET is_active = ? WHERE id = ?', [newStatus, id])
    res.json({ is_active: newStatus, message: newStatus ? 'Turma reativada' : 'Turma desativada' })
  } catch (error) {
    console.error('Erro ao alterar status da turma:', error)
    res.status(500).json({ message: 'Erro ao alterar status da turma' })
  }
}

export const getClassStudentsList = async (req, res) => {
  const { id } = req.params
  try {
    const [students] = await pool.query(
      `SELECT s.id, s.full_name, s.email, s.cpf
      FROM students s
      JOIN class_students cs ON cs.student_id = s.id
      WHERE cs.class_id = ?
      ORDER BY s.full_name`,
      [id]
    )
    res.json(students)
  } catch (error) {
    res.status(500).json({ message: 'Erro ao listar alunos da turma' })
  }
}

export const addStudentToClass = async (req, res) => {
  const { id } = req.params
  const { student_id } = req.body || {}
  if (!student_id) return res.status(400).json({ message: 'student_id é obrigatório' })
  try {
    await pool.query(
      'INSERT IGNORE INTO class_students (class_id, student_id) VALUES (?, ?)',
      [id, student_id]
    )
    res.json({ message: 'Aluno adicionado à turma' })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao adicionar aluno' })
  }
}

export const removeStudentFromClass = async (req, res) => {
  const { id, studentId } = req.params
  try {
    await pool.query(
      'DELETE FROM class_students WHERE class_id = ? AND student_id = ?',
      [id, studentId]
    )
    res.json({ message: 'Aluno removido da turma' })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao remover aluno' })
  }
}
