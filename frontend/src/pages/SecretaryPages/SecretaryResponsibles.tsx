import { useCallback, useEffect, useState } from 'react'
import { LuSearch, LuX, LuPlus, LuEye, LuUsers, LuPowerOff, LuPower } from 'react-icons/lu'
import { useAuth } from '../../hooks/useAuth'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Responsible {
  id: number; full_name: string; cpf: string; rg: string | null
  birth_date: string | null; address: string | null
  email: string; phone: string | null; created_at: string; is_active: number
}
interface ResponsibleStudent {
  id: number; full_name: string; cpf: string; email: string; phone: string | null
}
interface ResponsibleForm {
  full_name: string; cpf: string; rg: string; birth_date: string
  address: string; email: string; phone: string; password: string
}

const emptyForm = (): ResponsibleForm => ({
  full_name: '', cpf: '', rg: '', birth_date: '',
  address: '', email: '', phone: '', password: '',
})

type FField = { key: keyof ResponsibleForm; label: string; type?: string; span?: number }
const FIELDS: FField[] = [
  { key: 'full_name',  label: 'Nome completo *', span: 2 },
  { key: 'email',      label: 'Email *' },
  { key: 'phone',      label: 'Telefone' },
  { key: 'cpf',        label: 'CPF *' },
  { key: 'rg',         label: 'RG' },
  { key: 'birth_date', label: 'Data de nascimento', type: 'date' },
  { key: 'address',    label: 'Endereço', span: 2 },
]

// ─── Field helper ─────────────────────────────────────────────────────────────
function Field({ label, value, onChange, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
    </div>
  )
}

// ─── Modal ver alunos do responsável ─────────────────────────────────────────
function StudentsModal({ responsibleId, responsibleName, onClose, authFetch, apiBase }: {
  responsibleId: number; responsibleName: string; onClose: () => void
  authFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  apiBase: string
}) {
  const [students, setStudents] = useState<ResponsibleStudent[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    authFetch(`${apiBase}/responsibles/${responsibleId}/students`)
      .then(r => r.ok ? r.json() : [])
      .then(setStudents)
      .finally(() => setLoading(false))
  }, [responsibleId, authFetch, apiBase])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-900 shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-white dark:bg-gray-900">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Alunos de {responsibleName}
          </h2>
          <button onClick={onClose}><LuX className="h-5 w-5 text-gray-400" /></button>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-8"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand-500" /></div>
          ) : students.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 p-8 text-center">
              <LuUsers className="mx-auto mb-2 h-8 w-8 text-gray-300 dark:text-gray-600" />
              <p className="text-sm text-gray-400">Nenhum aluno vinculado a este responsável.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              {students.map(s => (
                <div key={s.id} className="px-4 py-3">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{s.full_name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.email} · CPF: {s.cpf}</p>
                  {s.phone && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{s.phone}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Modal criar / editar ─────────────────────────────────────────────────────
function ResponsibleModal({ initial, onClose, onSaved, authFetch, apiBase }: {
  initial?: Responsible | null; onClose: () => void; onSaved: () => void
  authFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  apiBase: string
}) {
  const isEdit = Boolean(initial?.id)
  const [form, setForm] = useState<ResponsibleForm>(
    initial ? {
      full_name: initial.full_name, email: initial.email,
      cpf: initial.cpf, rg: initial.rg ?? '',
      birth_date: initial.birth_date ? String(initial.birth_date).slice(0, 10) : '',
      address: initial.address ?? '', phone: initial.phone ?? '', password: '',
    } : emptyForm()
  )
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const set = (k: keyof ResponsibleForm, v: string) => setForm(p => ({ ...p, [k]: v }))

  const submit = async () => {
    setError(null)
    if (!form.full_name || !form.email || !form.cpf) return setError('Nome, email e CPF são obrigatórios')
    if (!isEdit && !form.password) return setError('Senha é obrigatória para novo responsável')
    setSaving(true)
    try {
      const url    = isEdit ? `${apiBase}/responsibles/${initial!.id}` : `${apiBase}/responsibles`
      const method = isEdit ? 'PUT' : 'POST'
      const payload = { ...form, password: form.password || undefined }
      const res = await authFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error || 'Erro ao salvar') }
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-900 shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-white dark:bg-gray-900">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEdit ? 'Editar Responsável' : 'Novo Responsável'}
          </h2>
          <button onClick={onClose}><LuX className="h-5 w-5 text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-400">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            {FIELDS.map(f => (
              <div key={f.key} className={f.span === 2 ? 'col-span-2' : ''}>
                <Field label={f.label} type={f.type} value={form[f.key]} onChange={v => set(f.key, v)} />
              </div>
            ))}
            <div className="col-span-2">
              <Field
                label={isEdit ? 'Nova senha (deixe vazio para não alterar)' : 'Senha *'}
                type="password" value={form.password} onChange={v => set('password', v)}
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300">Cancelar</button>
          <button onClick={submit} disabled={saving} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
            {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Cadastrar responsável'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page (reutilizável para secretary e admin) ──────────────────────────
export default function SecretaryResponsibles({ apiBase = '/secretary' }: { apiBase?: string }) {
  const { authFetch } = useAuth()
  const [responsibles, setResponsibles] = useState<Responsible[]>([])
  const [loading,  setLoading]   = useState(true)
  const [search,   setSearch]    = useState('')
  const [page,     setPage]      = useState(0)
  const [total,    setTotal]     = useState(0)
  const [limit]                  = useState(10)
  const [modal,    setModal]     = useState<null | 'new' | Responsible>(null)
  const [studentsModal, setStudentsModal] = useState<Responsible | null>(null)
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active')
  const [togglingId, setTogglingId] = useState<number | null>(null)

  const fetchResponsibles = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        limit: limit.toString(), offset: (page * limit).toString(),
        ...(search && { search }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
      })
      const res = await authFetch(`${apiBase}/responsibles?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setResponsibles(data.data); setTotal(data.total)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [search, statusFilter, page, limit, authFetch, apiBase])

  useEffect(() => { fetchResponsibles() }, [fetchResponsibles])

  const openEdit = async (id: number) => {
    const res = await authFetch(`${apiBase}/responsibles/${id}`)
    if (res.ok) setModal(await res.json())
  }

  const handleToggle = async (r: Responsible) => {
    setTogglingId(r.id)
    try {
      await authFetch(`${apiBase}/responsibles/${r.id}/toggle`, { method: 'PATCH' })
      await fetchResponsibles()
    } finally { setTogglingId(null) }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Responsáveis</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Total: {total} responsável{total !== 1 ? 'is' : ''}</p>
        </div>
        <button onClick={() => setModal('new')}
          className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
          <LuPlus className="h-4 w-4" /> Novo Responsável
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <LuSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="Buscar por nome, email ou CPF..."
            className="h-11 w-full rounded-xl border border-gray-300 bg-white pl-10 pr-4 text-sm outline-none focus:ring-2 ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-1">
          {(['active', 'inactive', 'all'] as const).map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(0); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === s ? 'bg-brand-500 text-white' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
              }`}>
              {s === 'active' ? 'Ativos' : s === 'inactive' ? 'Inativos' : 'Todos'}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex justify-center p-10"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand-500" /></div>
        ) : responsibles.length === 0 ? (
          <p className="p-10 text-center text-sm text-gray-400">Nenhum responsável encontrado.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-700">
                  <tr>
                    {['Nome', 'Status', 'Email', 'Telefone', 'CPF', 'Cadastro', 'Ações'].map(h => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-gray-300">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {responsibles.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{r.full_name}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          r.is_active ? 'bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${r.is_active ? 'bg-success-500' : 'bg-gray-400'}`} />
                          {r.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{r.email}</td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{r.phone || '-'}</td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{r.cpf}</td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                        {new Date(r.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button onClick={() => setStudentsModal(r)}
                            className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 text-sm">
                            <LuEye className="h-4 w-4" /> Alunos
                          </button>
                          <button onClick={() => openEdit(r.id)}
                            className="text-brand-600 dark:text-brand-400 hover:underline font-medium text-sm">
                            Editar
                          </button>
                          <button onClick={() => handleToggle(r)} disabled={togglingId === r.id}
                            className={`flex items-center gap-1 text-sm font-medium disabled:opacity-50 ${
                              r.is_active ? 'text-error-600 hover:text-error-700 dark:text-error-400' : 'text-success-600 hover:text-success-700 dark:text-success-400'
                            }`}>
                            {r.is_active ? <><LuPowerOff className="h-3.5 w-3.5" /> Desativar</> : <><LuPower className="h-3.5 w-3.5" /> Reativar</>}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 px-6 py-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {total === 0 ? '0 resultados' : `${page * limit + 1}–${Math.min((page + 1) * limit, total)} de ${total}`}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-50 dark:border-gray-600">Anterior</button>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-50 dark:border-gray-600">Próximo</button>
              </div>
            </div>
          </>
        )}
      </div>

      {modal && (
        <ResponsibleModal
          initial={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchResponsibles() }}
          authFetch={authFetch}
          apiBase={apiBase}
        />
      )}

      {studentsModal && (
        <StudentsModal
          responsibleId={studentsModal.id}
          responsibleName={studentsModal.full_name}
          onClose={() => setStudentsModal(null)}
          authFetch={authFetch}
          apiBase={apiBase}
        />
      )}
    </div>
  )
}
