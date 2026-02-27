import pool from '../database/connection.js'
import { validateAssignmentPayload, validateAssignmentUpdatePayload } from '../utils/validator.js'

// GET /assignments - listar todas as tarefas com nome da turma
export async function getAssignments(req, res) {
try {
    const [rows] = await pool.query(
    `SELECT a.id, a.title, a.type, a.max_score, a.due_date, a.description, a.class_id,
            c.name AS class_name
    FROM assignments a
    JOIN classes c ON a.class_id = c.id
    ORDER BY a.due_date`
    )
    res.json(rows)
} catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao buscar tarefas' })
}
}

// POST /assignments - criar nova tarefa
export async function createAssignment(req, res) {
const errors = validateAssignmentPayload(req.body)
if (errors.length > 0) {
    return res.status(400).json({ errors })
}

const { title, type, maxScore, dueDate, description, classId } = req.body
const conn = await pool.getConnection()
    try {
        const [result] = await conn.query(
        `INSERT INTO assignments (title, type, max_score, due_date, description, class_id)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [title, type || 'HOMEWORK', maxScore || null, dueDate, description || null, classId]
        )
        res.status(201).json({ id: result.insertId })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Erro ao criar tarefa' })
    } finally {
        conn.release()
    }
    
}

// GET /assignments/:id - lista tarefa por id, incluindo nome da turma
export async function getAssignmentById(req, res) {
const assignmentId = req.params.id
    try {
        const [rows] = await pool.query(
        `SELECT a.id, a.title, a.type, a.max_score, a.due_date, a.description, a.class_id,
        c.name AS class_name
        FROM assignments a
        JOIN classes c ON a.class_id = c.id
        WHERE a.id = ?`,
        [assignmentId]
        )
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Tarefa não encontrada' })
        }
        res.json(rows[0])
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Erro ao buscar tarefa' })
    }
}

export async function updateAssignment(req, res) {
const assignmentId = req.params.id
const errors = validateAssignmentUpdatePayload(req.body)
if (errors.length > 0) {
    return res.status(400).json({ errors })
}

const { title, type, maxScore, dueDate, description, classId } = req.body
const fields = []
const values = []

if (title) { fields.push('title = ?'); values.push(title) }
if (type) { fields.push('type = ?'); values.push(type) }
if (maxScore) { fields.push('max_score = ?'); values.push(maxScore) }
if (dueDate) { fields.push('due_date = ?'); values.push(dueDate) }
if (description) { fields.push('description = ?'); values.push(description) }
if (classId) { fields.push('class_id = ?'); values.push(classId) }

if (fields.length === 0) {
    return res.status(400).json({ error: 'Nenhum campo para atualizar' })
}

const conn = await pool.getConnection()
try {
    const [result] = await conn.query(
    `UPDATE assignments SET ${fields.join(', ')} WHERE id = ?`,
    [...values, assignmentId]
    )
    if (result.affectedRows === 0) {
    return res.status(404).json({ error: 'Tarefa não encontrada' })
    }
    res.json({ message: 'Tarefa atualizada com sucesso' })
} catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao atualizar tarefa' })
} finally {
    conn.release()
}
}

// DELETE /assignments/:id - remover tarefa por id
export async function deleteAssignment(req, res) {
const assignmentId = req.params.id
    try {
        const [result] = await pool.query(
        `DELETE FROM assignments WHERE id = ?`,
        [assignmentId]
        )
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Tarefa não encontrada' })
        }
        res.json({ message: 'Tarefa removida com sucesso' })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Erro ao remover tarefa' })
    }
}

