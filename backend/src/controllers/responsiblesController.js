import pool from '../database/connection.js';
import { validateResponsiblePayload, validateResponsibleUpdatePayload } from '../utils/validator.js';

// GET /responsibles
export async function getAllResponsibles(req, res) {
    try {
        const [rows] = await pool.query(
            'SELECT id, full_name AS fullName, email, phone FROM responsibles'
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao listar responsáveis' });
    }
}


// POST /responsibles
export async function createResponsible(req, res) {
    const errors = validateResponsiblePayload(req.body);
    if (errors.length > 0) {
        return res.status(400).json({ errors });
    }

    const data = req.body;
    const conn = await pool.getConnection(); // ✅ conn criado corretamente

    try {
        await conn.beginTransaction();

        const [result] = await conn.query(
            'INSERT INTO responsibles (full_name, cpf, rg, birth_date, address, email, phone) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [data.fullName, data.cpf.replace(/\D/g, ''), data.rg, data.birthDate, data.address, data.email, data.phone || null] // ✅ CPF sanitizado
        );

        await conn.commit(); //commit adicionado

        res.status(201).json({ message: 'Responsável criado com sucesso', responsibleId: result.insertId });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'CPF ou email já cadastrado para outro responsável' });
        }
        res.status(500).json({ error: 'Erro ao criar responsável' });
    } finally {
        conn.release(); //libera a conexão
    }
}

//GET /responsibles/:id - busca um responsável por ID
export async function getResponsibleById(req, res) {
    const responsibleId = req.params.id;
    try {
        const [rows] = await pool.query(
        'SELECT id, full_name AS fullName, cpf, rg, birth_date AS birthDate, address, email, phone FROM responsibles WHERE id = ?',
        [responsibleId]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Responsável não encontrado' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar responsável' });
    }
}

// PUT /responsibles/:id
export async function updateResponsible(req, res) {
    const errors = validateResponsibleUpdatePayload(req.body);
    if (errors.length > 0) {
        return res.status(400).json({ errors });
    }

    const data = req.body;
    const conn = await pool.getConnection(); // ✅ conn criado corretamente

    try {
        await conn.beginTransaction();

        const [result] = await conn.query(
            'UPDATE responsibles SET full_name = ?, cpf = ?, rg = ?, birth_date = ?, address = ?, email = ?, phone = ? WHERE id = ?',
            [data.fullName, data.cpf.replace(/\D/g, ''), data.rg, data.birthDate, data.address, data.email, data.phone || null, req.params.id] // ✅ CPF sanitizado
        );

        if (result.affectedRows === 0) {
            await conn.rollback();
            return res.status(404).json({ error: 'Responsável não encontrado' });
        }

        await conn.commit();
        res.json({ message: 'Responsável atualizado com sucesso' });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'CPF ou email já cadastrado para outro responsável' });
        }
        res.status(500).json({ error: 'Erro ao atualizar responsável' });
    } finally {
        conn.release(); //sempre libera a conexão
    }
}

// DELETE /responsibles/:id
export async function deleteResponsible(req, res) {
    try {
        const [result] = await pool.query(
            'DELETE FROM responsibles WHERE id = ?',
            [req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Responsável não encontrado' });
        }

        res.json({ message: 'Responsável removido com sucesso' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao remover responsável' });
    }
}

// GET /responsibles/:id/students
export async function getStudentsByResponsibleId(req, res) {
    try {
        const [rows] = await pool.query(
            `SELECT id, full_name AS fullName, cpf, email, birth_date AS birthDate
            FROM students
            WHERE responsible_id = ?`,
            [req.params.id]
        )

        res.json(rows)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Erro ao buscar alunos do responsável' })
    }
}
