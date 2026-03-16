import { useEffect, useState, useCallback } from 'react'
import {
  LuPlus, LuX, LuPencil, LuTrash2, LuPackage,
  LuMonitor, LuBookOpen, LuArrowDown, LuArrowUp,
  LuHistory, LuTriangleAlert
} from 'react-icons/lu'
import { useAuth } from '../../hooks/useAuth'
import PageMeta from '../../components/common/PageMeta'

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = 'MATERIAL' | 'EQUIPAMENTO' | 'LIVRO'

type Item = {
  id: number; name: string; category: Category
  unit: string; quantity: number; min_quantity: number
  notes: string | null; total_movements: number
  last_movement_at: string | null; created_at: string
}

type Movement = {
  id: number; item_id: number; type: 'ENTRADA' | 'SAIDA'
  quantity: number; notes: string | null
  created_by_name: string | null; created_at: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const CATEGORIES: { key: Category; label: string; icon: React.ReactNode; color: string; bg: string }[] = [
  { key: 'MATERIAL',    label: 'Material',    icon: <LuPackage  className="h-4 w-4" />, color: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800' },
  { key: 'EQUIPAMENTO', label: 'Equipamento', icon: <LuMonitor  className="h-4 w-4" />, color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800' },
  { key: 'LIVRO',       label: 'Livro',       icon: <LuBookOpen className="h-4 w-4" />, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800' },
]

const inputCls = 'w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/30'

const fmtDate = (d: string) =>
  new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

// ─── Item Form Modal ──────────────────────────────────────────────────────────

function ItemFormModal({ item, onClose, onSaved, authFetch }: {
  item?: Item
  onClose: () => void
  onSaved: (i: Item) => void
  authFetch: (i: RequestInfo, init?: RequestInit) => Promise<Response>
}) {
  const isEdit = !!item
  const [form, setForm] = useState({
    name: item?.name || '',
    category: item?.category || 'MATERIAL' as Category,
    unit: item?.unit || 'unidade',
    min_quantity: String(item?.min_quantity ?? 0),
    notes: item?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async () => {
    if (!form.name.trim()) return setError('Nome é obrigatório')
    setSaving(true); setError(null)
    const url    = isEdit ? `/admin/inventory/items/${item!.id}` : '/admin/inventory/items'
    const method = isEdit ? 'PUT' : 'POST'
    const res = await authFetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, min_quantity: Number(form.min_quantity) }),
    })
    if (res.ok) { onSaved(await res.json()); onClose() }
    else { const b = await res.json().catch(() => {}); setError(b?.error || 'Erro ao salvar') }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{isEdit ? 'Editar item' : 'Novo item'}</h2>
          <button onClick={onClose}><LuX className="h-5 w-5 text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-3">
          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-400">{error}</div>}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Nome *</label>
            <input value={form.name} onChange={set('name')} className={inputCls} placeholder="Ex: Resma de papel A4" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Categoria</label>
              <select value={form.category} onChange={set('category')} className={inputCls}>
                {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Unidade</label>
              <input value={form.unit} onChange={set('unit')} className={inputCls} placeholder="unidade, caixa, kg..." />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Quantidade mínima (alerta)</label>
            <input type="number" min="0" value={form.min_quantity} onChange={set('min_quantity')} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Observações</label>
            <textarea value={form.notes} onChange={set('notes')} rows={2} className={`${inputCls} resize-none`} />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
          <button onClick={onClose} className="rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300">Cancelar</button>
          <button onClick={submit} disabled={saving} className="rounded-xl bg-brand-500 px-5 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
            {saving ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Movement Modal ───────────────────────────────────────────────────────────

function MovementModal({ item, onClose, onMoved, authFetch }: {
  item: Item
  onClose: () => void
  onMoved: (updatedItem: Item) => void
  authFetch: (i: RequestInfo, init?: RequestInit) => Promise<Response>
}) {
  const [type, setType]       = useState<'ENTRADA' | 'SAIDA'>('ENTRADA')
  const [quantity, setQty]    = useState('1')
  const [notes, setNotes]     = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [history, setHistory] = useState<Movement[]>([])
  const [loadingH, setLoadingH] = useState(true)

  useEffect(() => {
    authFetch(`/admin/inventory/items/${item.id}/movements`)
      .then(r => r.json()).then(setHistory).finally(() => setLoadingH(false))
  }, [item.id, authFetch])

  const submit = async () => {
    const qty = Number(quantity)
    if (!qty || qty <= 0) return setError('Quantidade deve ser maior que zero')
    setSaving(true); setError(null)
    const res = await authFetch(`/admin/inventory/items/${item.id}/movements`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, quantity: qty, notes: notes || null }),
    })
    if (res.ok) {
      const { item: updated, movement: mov } = await res.json()
      setHistory(h => [mov, ...h])
      setQty('1'); setNotes('')
      onMoved(updated)
    } else {
      const b = await res.json().catch(() => {})
      setError(b?.error || 'Erro ao registrar')
    }
    setSaving(false)
  }

  const catCfg = CATEGORIES.find(c => c.key === item.category)!

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/50 p-4" onClick={onClose}>
      <div className="h-full w-full max-w-md overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 px-5 py-4 flex items-start justify-between shrink-0">
          <div>
            <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium mb-1 ${catCfg.bg} ${catCfg.color}`}>
              {catCfg.icon}{catCfg.label}
            </div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{item.name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Estoque atual: <span className={`font-bold ${item.quantity <= item.min_quantity ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                {item.quantity} {item.unit}
              </span>
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <LuX className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Register movement */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Registrar movimentação</p>
            {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-400">{error}</div>}
            <div className="flex gap-2">
              {(['ENTRADA', 'SAIDA'] as const).map(t => (
                <button key={t} onClick={() => setType(t)}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition-colors ${
                    type === t
                      ? t === 'ENTRADA'
                        ? 'bg-green-50 border-green-300 text-green-700 dark:bg-green-950/30 dark:border-green-700 dark:text-green-400'
                        : 'bg-red-50 border-red-300 text-red-700 dark:bg-red-950/30 dark:border-red-700 dark:text-red-400'
                      : 'border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400'
                  }`}>
                  {t === 'ENTRADA' ? <LuArrowDown className="h-4 w-4" /> : <LuArrowUp className="h-4 w-4" />}
                  {t === 'ENTRADA' ? 'Entrada' : 'Saída'}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Quantidade</label>
                <input type="number" min="1" value={quantity} onChange={e => setQty(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Observação</label>
                <input value={notes} onChange={e => setNotes(e.target.value)} className={inputCls} placeholder="Opcional" />
              </div>
            </div>
            <button onClick={submit} disabled={saving}
              className={`w-full rounded-xl py-2.5 text-sm font-medium text-white disabled:opacity-50 transition-colors ${
                type === 'ENTRADA' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
              }`}>
              {saving ? 'Registrando...' : `Registrar ${type === 'ENTRADA' ? 'Entrada' : 'Saída'}`}
            </button>
          </div>

          {/* History */}
          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
              <LuHistory className="h-4 w-4" /> Histórico
            </p>
            {loadingH ? (
              <div className="flex justify-center py-6"><div className="h-5 w-5 animate-spin rounded-full border-b-2 border-brand-500" /></div>
            ) : history.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-4">Nenhuma movimentação registrada.</p>
            ) : (
              <div className="space-y-2">
                {history.map(mov => (
                  <div key={mov.id} className="flex items-start gap-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-3">
                    <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white text-xs ${
                      mov.type === 'ENTRADA' ? 'bg-green-500' : 'bg-red-500'
                    }`}>
                      {mov.type === 'ENTRADA' ? <LuArrowDown className="h-3 w-3" /> : <LuArrowUp className="h-3 w-3" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm font-semibold ${mov.type === 'ENTRADA' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                          {mov.type === 'ENTRADA' ? '+' : '−'}{mov.quantity} {item.unit}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{fmtDate(mov.created_at)}</span>
                      </div>
                      {mov.notes && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{mov.notes}</p>}
                      {mov.created_by_name && <p className="text-xs text-gray-400 dark:text-gray-500">por {mov.created_by_name}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Item Card ────────────────────────────────────────────────────────────────

function ItemCard({ item, onEdit, onMove, onDelete }: {
  item: Item
  onEdit: (i: Item) => void
  onMove: (i: Item) => void
  onDelete: (id: number) => void
}) {
  const catCfg  = CATEGORIES.find(c => c.key === item.category)!
  const isLow   = item.quantity <= item.min_quantity && item.min_quantity > 0
  const isEmpty = item.quantity === 0

  return (
    <div className={`rounded-2xl border bg-white dark:bg-gray-900 p-4 space-y-3 transition-shadow hover:shadow-md ${
      isEmpty ? 'border-red-200 dark:border-red-800' : isLow ? 'border-amber-200 dark:border-amber-800' : 'border-gray-200 dark:border-gray-700'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium mb-1.5 ${catCfg.bg} ${catCfg.color}`}>
            {catCfg.icon}{catCfg.label}
          </div>
          <p className="font-semibold text-sm text-gray-900 dark:text-white leading-tight">{item.name}</p>
          {item.notes && <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{item.notes}</p>}
        </div>
        {(isEmpty || isLow) && (
          <LuTriangleAlert className={`h-4 w-4 shrink-0 mt-0.5 ${isEmpty ? 'text-red-500' : 'text-amber-500'}`} />
        )}
      </div>

      {/* Quantity display */}
      <div className={`rounded-xl px-3 py-2.5 text-center ${
        isEmpty ? 'bg-red-50 dark:bg-red-950/20' : isLow ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-gray-50 dark:bg-gray-800/60'
      }`}>
        <p className={`text-2xl font-bold ${isEmpty ? 'text-red-600 dark:text-red-400' : isLow ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>
          {item.quantity}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">{item.unit}</p>
        {item.min_quantity > 0 && (
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">mín: {item.min_quantity}</p>
        )}
      </div>

      {item.last_movement_at && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Última mov: {fmtDate(item.last_movement_at)}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-1.5 pt-1 border-t border-gray-100 dark:border-gray-800">
        <button onClick={() => onMove(item)}
          className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-brand-500 py-1.5 text-xs font-medium text-white hover:bg-brand-600">
          <LuHistory className="h-3 w-3" /> Movimentar
        </button>
        <button onClick={() => onEdit(item)}
          className="rounded-lg border border-gray-200 dark:border-gray-700 p-1.5 text-gray-500 hover:text-brand-600 hover:border-brand-300 dark:hover:text-brand-400 transition-colors">
          <LuPencil className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => { if (window.confirm(`Remover "${item.name}"?`)) onDelete(item.id) }}
          className="rounded-lg border border-gray-200 dark:border-gray-700 p-1.5 text-gray-500 hover:text-red-500 hover:border-red-300 transition-colors">
          <LuTrash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminInventory() {
  const { authFetch } = useAuth()
  const [items, setItems]         = useState<Item[]>([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState<Category | 'ALL'>('ALL')
  const [search, setSearch]       = useState('')
  const [formItem, setFormItem]   = useState<Item | 'new' | null>(null)
  const [moveItem, setMoveItem]   = useState<Item | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await authFetch('/admin/inventory/items')
    if (res.ok) setItems(await res.json())
    setLoading(false)
  }, [authFetch])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: number) => {
    const res = await authFetch(`/admin/inventory/items/${id}`, { method: 'DELETE' })
    if (res.ok) setItems(is => is.filter(i => i.id !== id))
  }

  const handleSaved = (saved: Item) => {
    setItems(is => {
      const exists = is.find(i => i.id === saved.id)
      return exists ? is.map(i => i.id === saved.id ? saved : i) : [saved, ...is]
    })
  }

  const handleMoved = (updated: Item) =>
    setItems(is => is.map(i => i.id === updated.id ? { ...i, ...updated } : i))

  // Filtered list
  const visible = items.filter(i => {
    const matchCat    = filter === 'ALL' || i.category === filter
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  // Metrics
  const lowStock = items.filter(i => i.quantity <= i.min_quantity && i.min_quantity > 0)
  const total    = items.length

  return (
    <>
      <PageMeta title="Estoque | Admin" description="Controle de estoque" />
      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Estoque</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Gerencie materiais, equipamentos e livros.</p>
          </div>
          <button onClick={() => setFormItem('new')}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 shadow-sm">
            <LuPlus className="h-4 w-4" /> Novo Item
          </button>
        </div>

        {/* Low stock alert */}
        {lowStock.length > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20 px-4 py-3">
            <LuTriangleAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              <span className="font-semibold">{lowStock.length} item{lowStock.length > 1 ? 'ns' : ''}</span> abaixo do estoque mínimo:{' '}
              {lowStock.slice(0, 3).map(i => i.name).join(', ')}{lowStock.length > 3 ? '...' : '.'}
            </p>
          </div>
        )}

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total de itens</p>
            <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">{total}</p>
          </div>
          {CATEGORIES.map(cat => {
            const cnt = items.filter(i => i.category === cat.key).length
            return (
              <div key={cat.key} className={`rounded-xl border p-4 ${cat.bg}`}>
                <p className="text-xs text-gray-500 dark:text-gray-400">{cat.label}s</p>
                <p className={`text-2xl font-bold mt-1 ${cat.color}`}>{cnt}</p>
              </div>
            )
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar item..."
            className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 w-48" />
          <button onClick={() => setFilter('ALL')}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${filter === 'ALL' ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 border-transparent' : 'border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400'}`}>
            Todos ({items.length})
          </button>
          {CATEGORIES.map(cat => (
            <button key={cat.key} onClick={() => setFilter(cat.key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${filter === cat.key ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 border-transparent' : 'border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400'}`}>
              {cat.icon}{cat.label} ({items.filter(i => i.category === cat.key).length})
            </button>
          ))}
          {lowStock.length > 0 && (
            <button onClick={() => { setFilter('ALL'); setSearch('') }}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
              <LuTriangleAlert className="h-3 w-3" /> {lowStock.length} com estoque baixo
            </button>
          )}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand-500" />
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400 dark:text-gray-500">
            <LuPackage className="h-10 w-10" />
            <p className="text-sm">{search || filter !== 'ALL' ? 'Nenhum item encontrado.' : 'Nenhum item cadastrado ainda.'}</p>
            {!search && filter === 'ALL' && (
              <button onClick={() => setFormItem('new')} className="text-sm text-brand-500 hover:underline">Cadastrar primeiro item</button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map(item => (
              <ItemCard key={item.id} item={item}
                onEdit={setFormItem}
                onMove={setMoveItem}
                onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {formItem && (
        <ItemFormModal
          item={formItem === 'new' ? undefined : formItem}
          onClose={() => setFormItem(null)}
          onSaved={handleSaved}
          authFetch={authFetch} />
      )}
      {moveItem && (
        <MovementModal
          item={moveItem}
          onClose={() => setMoveItem(null)}
          onMoved={i => { handleMoved(i); setMoveItem(i) }}
          authFetch={authFetch} />
      )}
    </>
  )
}
