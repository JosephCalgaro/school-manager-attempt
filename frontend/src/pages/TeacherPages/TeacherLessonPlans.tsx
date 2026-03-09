import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'

type Template = {
  id: number
  teacher_id: number
  teacher_name?: string
  title: string
  description: string | null
  created_at: string
  updated_at: string
}

type Props = { apiBase?: string }

const inputCls =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200'

export default function TeacherLessonPlans({ apiBase = '/teacher' }: Props) {
  const { authFetch } = useAuth()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc]   = useState('')
  const [saving, setSaving]     = useState(false)

  const [editId, setEditId]       = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc]   = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await authFetch(`${apiBase}/lesson-plans`)
      if (res.ok) setTemplates(await res.json())
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, []) // eslint-disable-line

  const handleCreate = async () => {
    if (!newTitle.trim()) return setError('Título é obrigatório')
    setSaving(true); setMessage(null); setError(null)
    try {
      const res = await authFetch(`${apiBase}/lesson-plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim(), description: newDesc || null }),
      })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.error || 'Erro') }
      setNewTitle(''); setNewDesc('')
      setMessage('Plano criado!')
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro') }
    finally { setSaving(false) }
  }

  const openEdit = (t: Template) => {
    setEditId(t.id); setEditTitle(t.title); setEditDesc(t.description ?? '')
  }

  const handleUpdate = async () => {
    if (!editId) return
    setSavingEdit(true); setMessage(null); setError(null)
    try {
      const res = await authFetch(`${apiBase}/lesson-plans/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle.trim(), description: editDesc || null }),
      })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.error || 'Erro') }
      setEditId(null); setMessage('Plano atualizado!')
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro') }
    finally { setSavingEdit(false) }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('Remover este plano? Ele será desvinculado de todas as turmas.')) return
    setDeletingId(id)
    try {
      const res = await authFetch(`${apiBase}/lesson-plans/${id}`, { method: 'DELETE' })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.error || 'Erro') }
      setMessage('Plano removido.')
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro') }
    finally { setDeletingId(null) }
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Planos de Aula</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Crie e gerencie seus planos. Depois vincule-os a turmas específicas na aba "Planejamento" de cada turma.
        </p>
      </header>

      {message && <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">{message}</div>}
      {error   && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Lista */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 space-y-3">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Meus Planos <span className="ml-1 text-xs font-normal text-gray-400">({templates.length})</span>
          </h2>
          {loading ? (
            <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-b-2 border-brand-500"/></div>
          ) : templates.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum plano criado ainda.</p>
          ) : templates.map(t => (
            <div key={t.id} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              {editId === t.id ? (
                <div className="space-y-2">
                  <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className={inputCls} placeholder="Título" />
                  <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} className={inputCls} placeholder="Descrição / conteúdo" />
                  <div className="flex gap-2">
                    <button onClick={handleUpdate} disabled={savingEdit}
                      className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-60">
                      {savingEdit ? 'Salvando...' : 'Salvar'}
                    </button>
                    <button onClick={() => setEditId(null)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-300">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="font-medium text-gray-900 dark:text-white">{t.title}</p>
                  {t.description && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{t.description}</p>}
                  {t.teacher_name && <p className="mt-1 text-xs text-gray-400">Professor: {t.teacher_name}</p>}
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => openEdit(t)}
                      className="rounded-md border border-brand-300 px-2.5 py-1 text-xs text-brand-700 hover:bg-brand-50 dark:border-brand-700 dark:text-brand-300">
                      Editar
                    </button>
                    <button onClick={() => handleDelete(t.id)} disabled={deletingId === t.id}
                      className="rounded-md border border-red-300 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:text-red-400">
                      {deletingId === t.id ? 'Removendo...' : 'Remover'}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Novo plano */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 space-y-3">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Novo Plano</h2>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Título *</label>
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
              placeholder="Ex: Introdução à Fotossíntese" className={`mt-1 ${inputCls}`} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Conteúdo / descrição</label>
            <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)}
              rows={5} placeholder="Descreva os objetivos, tópicos, metodologia..." className={`mt-1 ${inputCls}`} />
          </div>
          <button onClick={handleCreate} disabled={saving}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
            {saving ? 'Salvando...' : 'Criar plano'}
          </button>
        </div>
      </div>
    </div>
  )
}
