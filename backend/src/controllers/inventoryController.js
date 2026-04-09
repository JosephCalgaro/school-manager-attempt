import pool from '../database/connection.js'
/**
 * Common locals used across controllers:
 * - sid: school id for the current request (from `req.schoolId`)
 * - req.userId: id of the authenticated user
 * - req.userRole / req.isTemp: auth metadata
 * - t: short name for wildcard search values (`%term%`) when used
 * - countQ / query: SQL query strings (countQ typically holds COUNT(*) SQL)
 * - params: array of SQL parameter values
 * - conn: DB connection from `pool.getConnection()` when using transactions
 */

// ─── Migration ────────────────────────────────────────────────────────────────

async function ensureInventoryTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_items (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      school_id    INT NOT NULL DEFAULT 1,
      name         VARCHAR(150) NOT NULL,
      category     ENUM('MATERIAL','EQUIPAMENTO','LIVRO') NOT NULL DEFAULT 'MATERIAL',
      unit         VARCHAR(30)  NOT NULL DEFAULT 'unidade',
      quantity     INT          NOT NULL DEFAULT 0,
      min_quantity INT          NOT NULL DEFAULT 0,
      notes        TEXT         NULL,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_inv_category (category),
      INDEX idx_inv_school (school_id)
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      item_id     INT  NOT NULL,
      type        ENUM('ENTRADA','SAIDA') NOT NULL,
      quantity    INT  NOT NULL,
      notes       TEXT NULL,
      created_by  INT  NULL,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_inv_mov_item (item_id),
      FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
    )
  `)
}

// ─── Items ────────────────────────────────────────────────────────────────────

/**
 * getItems - retorna todos os itens do inventário
 *
 * Locals:
 * - sid: school id
 * - rows: query result rows
 */
export async function getItems(req, res) {
  const sid = req.schoolId
  try {
    await ensureInventoryTables()
    const [rows] = await pool.query(`
      SELECT i.*,
        (SELECT COUNT(*) FROM inventory_movements m WHERE m.item_id = i.id) AS total_movements,
        (SELECT created_at FROM inventory_movements m WHERE m.item_id = i.id ORDER BY created_at DESC LIMIT 1) AS last_movement_at
      FROM inventory_items i
      WHERE i.school_id = ?
      ORDER BY i.category, i.name
    `, [sid])
    res.json(rows)
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao buscar itens' }) }
}

/**
 * createItem - cria um novo item de inventário
 *
 * Locals:
 * - sid: school id
 * - name, category, unit, quantity, min_quantity, notes: body fields
 * - r: insert result
 * - rows: created item rows
 */
export async function createItem(req, res) {
  const sid = req.schoolId
  try {
    await ensureInventoryTables()
    const { name, category, unit, quantity, min_quantity, notes } = req.body || {}
    if (!name?.trim()) return res.status(400).json({ error: 'Nome é obrigatório' })
    const [r] = await pool.query(
      `INSERT INTO inventory_items (school_id, name, category, unit, quantity, min_quantity, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [sid, name.trim(), category || 'MATERIAL', unit || 'unidade',
       Number(quantity) || 0, Number(min_quantity) || 0, notes || null]
    )
    const [rows] = await pool.query('SELECT * FROM inventory_items WHERE id = ?', [r.insertId])
    res.status(201).json(rows[0])
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao criar item' }) }
}

/**
 * updateItem - atualiza um item existente
 *
 * Locals:
 * - id: item id (from params)
 * - sid: school id
 * - allowed: list of updatable fields
 * - fields, values: update building arrays
 * - rows: query result rows
 */
export async function updateItem(req, res) {
  const id = Number(req.params.id); const sid = req.schoolId
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID inválido' })
  try {
    const allowed = ['name', 'category', 'unit', 'min_quantity', 'notes']
    const fields = []; const values = []
    for (const key of allowed) {
      if (req.body[key] !== undefined) { fields.push(`${key} = ?`); values.push(req.body[key] || null) }
    }
    if (!fields.length) return res.status(400).json({ error: 'Nenhum campo para atualizar' })
    await pool.query(`UPDATE inventory_items SET ${fields.join(', ')} WHERE id = ? AND school_id = ?`, [...values, id, sid])
    const [rows] = await pool.query('SELECT * FROM inventory_items WHERE id = ?', [id])
    if (!rows.length) return res.status(404).json({ error: 'Item não encontrado' })
    res.json(rows[0])
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao atualizar item' }) }
}

/**
 * deleteItem - remove um item do inventário
 *
 * Locals:
 * - id: item id (from params)
 * - sid: school id
 * - r: delete result
 */
export async function deleteItem(req, res) {
  const id = Number(req.params.id); const sid = req.schoolId
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID inválido' })
  try {
    const [r] = await pool.query('DELETE FROM inventory_items WHERE id = ? AND school_id = ?', [id, sid])
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Item não encontrado' })
    res.json({ message: 'Item removido' })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao remover item' }) }
}

// ─── Movements ────────────────────────────────────────────────────────────────

/**
 * getMovements - retorna movimentações de um item
 *
 * Locals:
 * - itemId: item id (from params)
 * - rows: query result rows
 */
export async function getMovements(req, res) {
  const itemId = Number(req.params.id)
  if (!Number.isInteger(itemId)) return res.status(400).json({ error: 'ID inválido' })
  try {
    const [rows] = await pool.query(`
      SELECT m.*, u.full_name AS created_by_name
      FROM inventory_movements m
      JOIN inventory_items i ON i.id = m.item_id
      LEFT JOIN users u ON u.id = m.created_by
      WHERE m.item_id = ? AND i.school_id = ?
      ORDER BY m.created_at DESC
      LIMIT 100
    `, [itemId, req.schoolId])
    res.json(rows)
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao buscar movimentações' }) }
}

/**
 * registerMovement - registra entrada/saída de estoque
 *
 * Locals:
 * - itemId: item id (from params)
 * - sid: school id
 * - type, quantity, notes: body fields
 * - qty: normalized quantity number
 * - conn: DB connection for transaction
 * - item: locked item row
 * - delta, r, mov, updatedItem: intermediate results
 */
export async function registerMovement(req, res) {
  const itemId = Number(req.params.id)
  if (!Number.isInteger(itemId)) return res.status(400).json({ error: 'ID inválido' })
  const sid = req.schoolId
  try {
    const { type, quantity, notes } = req.body || {}
    if (!type || !['ENTRADA', 'SAIDA'].includes(type))
      return res.status(400).json({ error: 'Tipo deve ser ENTRADA ou SAIDA' })
    const qty = Number(quantity)
    if (!qty || qty <= 0) return res.status(400).json({ error: 'Quantidade deve ser maior que zero' })

    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      // FOR UPDATE garante exclusão mútua — elimina race condition
      const [[item]] = await conn.query(
        'SELECT quantity FROM inventory_items WHERE id = ? AND school_id = ? FOR UPDATE',
        [itemId, sid]
      )
      if (!item) { await conn.rollback(); return res.status(404).json({ error: 'Item não encontrado' }) }

      if (type === 'SAIDA') {
        if (item.quantity < qty) {
          await conn.rollback()
          return res.status(400).json({ error: `Estoque insuficiente (disponível: ${item.quantity})` })
        }
      }

      const delta = type === 'ENTRADA' ? qty : -qty
      await conn.query('UPDATE inventory_items SET quantity = quantity + ? WHERE id = ? AND school_id = ?', [delta, itemId, sid])
      const [r] = await conn.query(
        `INSERT INTO inventory_movements (item_id, type, quantity, notes, created_by) VALUES (?, ?, ?, ?, ?)`,
        [itemId, type, qty, notes || null, req.userId]
      )

      await conn.commit()

      const [[mov]] = await pool.query(
        `SELECT m.*, u.full_name AS created_by_name FROM inventory_movements m
         LEFT JOIN users u ON u.id = m.created_by WHERE m.id = ?`, [r.insertId]
      )
      const [[updatedItem]] = await pool.query('SELECT * FROM inventory_items WHERE id = ?', [itemId])
      res.status(201).json({ movement: mov, item: updatedItem })
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao registrar movimentação' }) }
}
