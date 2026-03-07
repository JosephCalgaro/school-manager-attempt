// Importa o pool de conexões com o MySQL (permite fazer queries no banco)
import pool from '../database/connection.js'

// Importa funções de validação:
// validateStudentPayload → verifica se todos os campos do aluno estão corretos
// isMinor → verifica se o aluno é menor de idade pela data de nascimento
import { validateStudentPayload } from '../utils/validator.js'
import { isMinor } from '../utils/validator.js'
import bcrypt from 'bcryptjs'

// ==============================
// CRIAR ALUNO (POST /students)
// ==============================
// Função chamada quando o frontend envia uma requisição POST para cadastrar um novo aluno.
// Recebe os dados do aluno no corpo da requisição (req.body), valida, e salva no banco.
export async function createStudent(req, res) {
    // req.body contém os dados JSON enviados pelo frontend
    // Ex: { fullName: "João", cpf: "12345678901", email: "joao@email.com", ... }
    const data = req.body

    // Roda todas as validações (nome obrigatório, CPF válido, email válido, etc.)
    // Se tiver algum erro, retorna a lista de mensagens pro frontend mostrar
    const errors = validateStudentPayload(data)
    if (errors.length > 0) {
        // Status 400 = "Bad Request" → o cliente enviou dados inválidos
        return res.status(400).json({ errors })
    }

    // Pega uma conexão individual do pool
    // Precisamos de uma conexão dedicada porque vamos usar TRANSAÇÃO
    const conn = await pool.getConnection()

    try {
        // TRANSAÇÃO = garante que todas as operações acontecem juntas.
        // Se algo der errado no meio, NADA é salvo (tudo é desfeito com rollback).
        // Ex: se criar o responsável mas falhar ao criar o aluno,
        // o responsável também não fica salvo. Evita dados "pela metade".
        await conn.beginTransaction()

        // Começa sem responsável (null = não tem)
        let responsibleId = null

        // Se o aluno for menor de idade, precisa cadastrar um responsável
        if (isMinor(data.birthDate)) {
            const r = data.responsible

            // Busca no banco se já existe um responsável com esse CPF
            // .replace(/\D/g, '') → remove pontos e traços do CPF, deixando só números
            // Os "?" na query são placeholders seguros (previnem SQL Injection)
            const [existing] = await conn.query(
                'SELECT id FROM responsibles WHERE cpf = ?',
                [r.cpf.replace(/\D/g, '')]
            )

            // Se encontrou o responsável no banco, usa o ID dele
            if (existing.length > 0) {
                responsibleId = existing[0].id
            } else {
                // Se não encontrou, cria um novo responsável no banco
                const [result] = await conn.query(
                    `INSERT INTO responsibles (full_name, cpf, rg, birth_date, address, email, phone)
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [r.fullName, r.cpf.replace(/\D/g, ''), r.rg, r.birthDate, r.address, r.email, r.phone || null]
                )
                // result.insertId = o ID que o MySQL gerou automaticamente
                responsibleId = result.insertId
            }
        }

        // Cria o aluno no banco de dados
        // Cria o aluno no banco de dados
        // responsible_id será null (se maior de idade) ou o ID do responsável (se menor)
        // password_hash: se enviado, faz o hash; caso contrário deixa NULL
        const passwordHash = data.password
            ? await bcrypt.hash(data.password, 10)
            : null

        const [result] = await conn.query(
            `INSERT INTO students (full_name, cpf, rg, birth_date, address, email, phone, due_day, responsible_id, password_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                data.fullName,
                data.cpf.replace(/\D/g, ""),
                data.rg,
                data.birthDate,
                data.address,
                data.email,
                data.phone || null,
                data.dueDay,
                responsibleId,
                passwordHash
            ]
        )

        // Tudo deu certo → confirma a transação (salva tudo no banco de vez)
        await conn.commit()

        // Status 201 = "Created" → recurso criado com sucesso
        res.status(201).json({
            message: 'Aluno cadastrado com sucesso',
            studentId: result.insertId
        })
    } catch (error) {
        // Algo deu errado → desfaz TUDO que foi feito nessa transação
        await conn.rollback()
        console.error(error)

        // ER_DUP_ENTRY = tentou inserir CPF ou email que já existe (colunas UNIQUE)
        if (error.code === 'ER_DUP_ENTRY') {
            // Status 409 = "Conflict" → conflito com dados já existentes
            return res.status(409).json({ error: 'CPF ou email já cadastrado' })
        }

        // Status 500 = "Internal Server Error" → erro inesperado
        res.status(500).json({ error: 'Erro ao cadastrar aluno' })
    } finally {
        // SEMPRE libera a conexão de volta pro pool, independente de sucesso ou erro
        // Se não fizer isso, as conexões esgotam e o servidor trava
        conn.release()
    }
}

// ==============================
// LISTAR TODOS OS ALUNOS (GET /students)
// ==============================
// Retorna a lista completa de alunos. O frontend usa pra mostrar a tabela de alunos.
export async function getAllStudents(req, res) {
    try {
        // LEFT JOIN = pega todos os alunos, MESMO os que não têm responsável.
        // Se tiver responsável, traz o nome dele como "responsible_name".
        // Se não tiver, responsible_name vem como null.
        // ORDER BY = ordena alfabeticamente pelo nome
        const [rows] = await pool.query(
            `SELECT s.*, r.full_name AS responsible_name
            FROM students s
            LEFT JOIN responsibles r ON s.responsible_id = r.id
            ORDER BY s.full_name`
        )

        // Remove password_hash antes de retornar
        res.json(rows.map(({ password_hash, ...s }) => s))
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: 'Erro ao buscar alunos' })
    }
}

// ==============================
// BUSCAR ALUNO POR ID (GET /students/:id)
// ==============================
// Retorna os dados completos de UM aluno específico.
// O ":id" na URL vira req.params.id (ex: GET /students/5 → req.params.id = 5)
// Útil para a tela de "detalhes" ou "editar aluno" no frontend.
export async function getStudentById(req, res) {
    try {
        // Traz o aluno + TODOS os dados do responsável (diferente do getAll que só traz o nome)
        const [rows] = await pool.query(
            `SELECT s.*, r.full_name AS responsible_name, r.cpf AS responsible_cpf,
                    r.rg AS responsible_rg, r.email AS responsible_email, r.phone AS responsible_phone,
                    r.address AS responsible_address
            FROM students s
            LEFT JOIN responsibles r ON s.responsible_id = r.id
            WHERE s.id = ?`,
            [req.params.id]
        )

        // Se não encontrou nenhum aluno com esse ID
        if (rows.length === 0) {
            // Status 404 = "Not Found" → recurso não existe
            return res.status(404).json({ error: 'Aluno não encontrado' })
        }

        // rows[0] = primeiro (e único) resultado, já que ID é único
        const { password_hash, ...safeStudent } = rows[0]; res.json(safeStudent)
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: 'Erro ao buscar aluno' })
    }
}

// ==============================
// ATUALIZAR ALUNO (PUT /students/:id)
// ==============================
// Atualiza os dados de um aluno existente.
// O frontend envia os dados novos no body e o ID na URL.
// Mesma lógica do createStudent, mas usa UPDATE ao invés de INSERT.
export async function updateStudent(req, res) {
    const data = req.body

    // Mesma validação do create
    const errors = validateStudentPayload(data)
    if (errors.length > 0) {
        return res.status(400).json({ errors })
    }

    const conn = await pool.getConnection()

    try {
        await conn.beginTransaction()

        // Verifica se o aluno existe antes de tentar atualizar
        const [existing] = await conn.query(
            'SELECT id FROM students WHERE id = ?',
            [req.params.id]
        )

        if (existing.length === 0) {
            await conn.rollback()
            return res.status(404).json({ error: 'Aluno não encontrado' })
        }

        let responsibleId = null

        // Mesma lógica de responsável do create
        if (isMinor(data.birthDate)) {
            const r = data.responsible

            const [existingResp] = await conn.query(
                'SELECT id FROM responsibles WHERE cpf = ?',
                [r.cpf.replace(/\D/g, '')]
            )

            if (existingResp.length > 0) {
                responsibleId = existingResp[0].id
                // Se o responsável já existe, atualiza os dados dele também
                await conn.query(
                    `UPDATE responsibles SET full_name = ?, rg = ?, birth_date = ?, address = ?, email = ?, phone = ?
                    WHERE id = ?`,
                    [r.fullName, r.rg, r.birthDate, r.address, r.email, r.phone || null, responsibleId]
                )
            } else {
                // Se não existe, cria um novo
                const [result] = await conn.query(
                    `INSERT INTO responsibles (full_name, cpf, rg, birth_date, address, email, phone)
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [r.fullName, r.cpf.replace(/\D/g, ''), r.rg, r.birthDate, r.address, r.email, r.phone || null]
                )
                responsibleId = result.insertId
            }
        }

        // UPDATE = atualiza os dados no banco
        // password_hash: atualiza somente se uma nova senha for enviada
        let updateQuery = `UPDATE students SET full_name = ?, cpf = ?, rg = ?, birth_date = ?, address = ?,
            email = ?, phone = ?, due_day = ?, responsible_id = ?`
        const updateParams = [
            data.fullName,
            data.cpf.replace(/\D/g, ""),
            data.rg,
            data.birthDate,
            data.address,
            data.email,
            data.phone || null,
            data.dueDay,
            responsibleId
        ]

        if (data.password) {
            const newHash = await bcrypt.hash(data.password, 10)
            updateQuery += `, password_hash = ?`
            updateParams.push(newHash)
        }

        updateQuery += ` WHERE id = ?`
        updateParams.push(req.params.id)

        await conn.query(updateQuery, updateParams)

        await conn.commit()
        res.json({ message: 'Aluno atualizado com sucesso' })
    } catch (error) {
        await conn.rollback()
        console.error(error)

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'CPF ou email já cadastrado' })
        }

        res.status(500).json({ error: 'Erro ao atualizar aluno' })
    } finally {
        conn.release()
    }
}

// ==============================
// DELETAR ALUNO (DELETE /students/:id)
// ==============================
// Remove um aluno do banco pelo ID. Essa operação é permanente!
export async function deleteStudent(req, res) {
    try {
        // DELETE FROM = remove o registro do banco
        const [result] = await pool.query(
            'DELETE FROM students WHERE id = ?',
            [req.params.id]
        )

        // affectedRows = quantas linhas foram removidas
        // Se for 0, não existia aluno com esse ID
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Aluno não encontrado' })
        }

        res.json({ message: 'Aluno removido com sucesso' })
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: 'Erro ao remover aluno' })
    }
}
