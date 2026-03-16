import { useCallback, useEffect, useState } from 'react'
import { LuSearch, LuX, LuPlus, LuUserPlus, LuEye, LuPowerOff, LuPower, LuTriangleAlert } from 'react-icons/lu'
import { useAuth } from '../../hooks/useAuth'

interface Student {
  id: number; full_name: string; cpf: string; email: string
  phone?: string | null; birth_date: string; created_at: string
  is_active: number; deactivation_reason?: string | null; city?: string | null
}
interface Responsible {
  full_name: string; cpf: string; rg: string; birth_date: string
  address: string; email: string; phone: string; password: string
}
interface StudentForm {
  full_name: string; cpf: string; rg: string; birth_date: string
  address: string; city: string; email: string; phone: string; due_day: string
  password: string; deactivation_reason?: string; responsible: Responsible | null
}
interface AttendanceStats {
  total: number; present: number; absent: number; percentage: string
}
interface AttendanceData {
  attendance: { id: number; date: string; present: boolean; class_name: string }[]
  statistics: AttendanceStats
}
interface Assignment {
  id: number; title: string; type: string; max_score: number | null
  due_date: string; class_name: string; score: number | null
}

const emptyForm = (): StudentForm => ({
  full_name: '', cpf: '', rg: '', birth_date: '', address: '', city: '',
  email: '', phone: '', due_day: '', password: '', deactivation_reason: '', responsible: null,
})
const emptyResp = (): Responsible => ({
  full_name: '', cpf: '', rg: '', birth_date: '', address: '', email: '', phone: '', password: '',
})

type SField = { key: keyof Omit<StudentForm, 'responsible' | 'password'>; label: string; type?: string }
type RField = { key: keyof Responsible; label: string; type?: string }

const S_FIELDS: SField[] = [
  { key: 'full_name', label: 'Nome completo *' },
  { key: 'email', label: 'Email *' },
  { key: 'cpf', label: 'CPF *' },
  { key: 'rg', label: 'RG' },
  { key: 'birth_date', label: 'Nascimento', type: 'date' },
  { key: 'phone', label: 'Telefone' },
  { key: 'city', label: 'Cidade' },
  { key: 'address', label: 'Endereço' },
  { key: 'due_day', label: 'Dia de vencimento', type: 'number' },
]
const R_FIELDS: RField[] = [
  { key: 'full_name', label: 'Nome completo *' },
  { key: 'email', label: 'Email *' },
  { key: 'cpf', label: 'CPF' },
  { key: 'rg', label: 'RG' },
  { key: 'birth_date', label: 'Nascimento', type: 'date' },
  { key: 'phone', label: 'Telefone' },
  { key: 'address', label: 'Endereço' },
  { key: 'password', label: 'Senha de acesso', type: 'password' },
]

const DEACTIVATION_REASONS = [
  'Financeiro',
  'Mudança de cidade',
  'Conclusão do curso',
  'Insatisfação com o ensino',
  'Problemas pessoais',
  'Outro',
]

function DeactivateModal({ studentName, onClose, onConfirm }: {
  studentName: string
  onClose: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState(DEACTIVATION_REASONS[0])
  const [custom, setCustom] = useState('')
  const finalReason = reason === 'Outro' ? (custom.trim() || 'Outro') : reason

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 shadow-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <LuTriangleAlert className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Desativar aluno</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[220px]">{studentName}</p>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Motivo do cancelamento</label>
          <select value={reason} onChange={e => setReason(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/30">
            {DEACTIVATION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        {reason === 'Outro' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Descreva o motivo</label>
            <input value={custom} onChange={e => setCustom(e.target.value)} placeholder="Ex: Viagem ao exterior..."
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">Cancelar</button>
          <button onClick={() => onConfirm(finalReason)} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Confirmar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal de detalhes (presença, atividades, notas) ─────────────────────────
function StudentDetailsModal({ studentId, studentName, onClose, authFetch }: {
  studentId: number; studentName: string; onClose: () => void
  authFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>
}) {
  const [tab, setTab] = useState<'attendance' | 'assignments'>('attendance')
  const [attendance, setAttendance] = useState<AttendanceData | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [attRes, assRes] = await Promise.all([
          authFetch(`/secretary/students/${studentId}/attendance`),
          authFetch(`/secretary/students/${studentId}/assignments`),
        ])
        if (attRes.ok) setAttendance(await attRes.json())
        if (assRes.ok) setAssignments(await assRes.json())
      } finally { setLoading(false) }
    }
    load()
  }, [studentId, authFetch])

  const graded   = assignments.filter(a => a.score !== null)
  const pending  = assignments.filter(a => a.score === null)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 sticky top-0 bg-white dark:bg-gray-900">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{studentName}</h2>
          <button onClick={onClose}><LuX className="h-5 w-5 text-gray-400" /></button>
        </div>

        <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 px-6">
          {(['attendance', 'assignments'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition ${tab === t
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
              {t === 'attendance' ? 'Frequência' : 'Atividades & Notas'}
            </button>
          ))}
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-8"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand-500" /></div>
          ) : tab === 'attendance' && attendance ? (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Total', value: attendance.statistics.total, color: 'bg-blue-50 dark:bg-blue-900/20' },
                  { label: 'Presentes', value: attendance.statistics.present, color: 'bg-green-50 dark:bg-green-900/20' },
                  { label: 'Ausentes', value: attendance.statistics.absent, color: 'bg-red-50 dark:bg-red-900/20' },
                  { label: 'Frequência', value: attendance.statistics.percentage, color: 'bg-purple-50 dark:bg-purple-900/20' },
                ].map(card => (
                  <div key={card.label} className={`rounded-xl p-3 text-center ${card.color}`}>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{card.label}</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{card.value}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-1 max-h-52 overflow-y-auto">
                {attendance.attendance.slice(0, 30).map(a => (
                  <div key={a.id} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800">
                    <span className="text-gray-700 dark:text-gray-300">{new Date(a.date).toLocaleDateString('pt-BR')} · {a.class_name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${a.present
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                      {a.present ? 'Presente' : 'Ausente'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : tab === 'assignments' ? (
            <div className="space-y-4">
              {assignments.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Nenhuma atividade encontrada.</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-orange-50 dark:bg-orange-900/20 p-3 text-center">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Pendentes</p>
                      <p className="text-xl font-bold text-orange-600 dark:text-orange-400 mt-1">{pending.length}</p>
                    </div>
                    <div className="rounded-xl bg-green-50 dark:bg-green-900/20 p-3 text-center">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Com nota</p>
                      <p className="text-xl font-bold text-green-600 dark:text-green-400 mt-1">{graded.length}</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                        <tr>
                          {['Atividade', 'Turma', 'Tipo', 'Nota', 'Máx.'].map(h => (
                            <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-400">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {assignments.map(a => (
                          <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                            <td className="px-3 py-2 font-medium text-gray-800 dark:text-white">{a.title}</td>
                            <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{a.class_name}</td>
                            <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{a.type}</td>
                            <td className="px-3 py-2">
                              {a.score !== null
                                ? <span className="font-semibold text-brand-600 dark:text-brand-400">{a.score}</span>
                                : <span className="text-gray-400 text-xs">Sem nota</span>}
                            </td>
                            <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{a.max_score ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ─── Field input helper ───────────────────────────────────────────────────────
function Field({ label, value, onChange, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
      />
    </div>
  )
}

// ─── Modal de cadastro / edição ───────────────────────────────────────────────
function StudentModal({ initial, onClose, onSaved, authFetch }: {
  initial?: { id: number; form: StudentForm } | null
  onClose: () => void
  onSaved: () => void
  authFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>
}) {
  const [form, setForm] = useState<StudentForm>(initial?.form ?? emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isEdit = Boolean(initial?.id)

  const setStudent = (key: keyof Omit<StudentForm, 'responsible'>, value: string) =>
    setForm(p => ({ ...p, [key]: value }))

  const setResp = (key: keyof Responsible, value: string) =>
    setForm(p => p.responsible ? { ...p, responsible: { ...p.responsible, [key]: value } } : p)

  const submit = async () => {
    setError(null)
    if (!form.full_name || !form.email || !form.cpf) {
      return setError('Nome, email e CPF são obrigatórios')
    }
    if (!isEdit && !form.password) return setError('Senha é obrigatória para novo aluno')
    setSaving(true)
    try {
      const url = isEdit ? `/secretary/students/${initial!.id}` : '/secretary/students'
      const method = isEdit ? 'PUT' : 'POST'
      const payload = { ...form, due_day: form.due_day ? Number(form.due_day) : undefined, password: form.password || undefined }
      const res = await authFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.message || 'Erro ao salvar') }
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 sticky top-0 bg-white dark:bg-gray-900">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEdit ? 'Editar Aluno' : 'Novo Aluno'}
          </h2>
          <button onClick={onClose}><LuX className="h-5 w-5 text-gray-400" /></button>
        </div>

        <div className="p-6 space-y-6">
          {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-400">{error}</p>}

          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Dados do Aluno</h3>
            <div className="grid grid-cols-2 gap-3">
              {S_FIELDS.map(f => (
                <Field key={f.key} label={f.label} type={f.type} value={form[f.key] ?? ''} onChange={v => setStudent(f.key, v)} />
              ))}
              <div className={isEdit ? 'col-span-2' : 'col-span-2'}>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  {isEdit ? 'Nova senha (deixe vazio para não alterar)' : 'Senha *'}
                </label>
                <input type="password" value={form.password} onChange={e => setStudent('password', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
              </div>
              {/* Motivo de cancelamento — só na edição */}
              {isEdit && (
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Motivo do cancelamento</label>
                  <select value={form.deactivation_reason || ''} onChange={e => setForm(p => ({ ...p, deactivation_reason: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                    <option value="">— Sem motivo —</option>
                    {['Financeiro','Mudança de cidade','Conclusão do curso','Insatisfação com o ensino','Problemas pessoais','Outro'].map(r =>
                      <option key={r} value={r}>{r}</option>
                    )}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Responsável</h3>
              {!form.responsible
                ? <button onClick={() => setForm(p => ({ ...p, responsible: emptyResp() }))}
                    className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:underline">
                    <LuUserPlus className="h-3.5 w-3.5" /> Adicionar responsável
                  </button>
                : <button onClick={() => setForm(p => ({ ...p, responsible: null }))}
                    className="text-xs text-red-500 hover:underline">Remover responsável</button>
              }
            </div>
            {form.responsible && (
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                {R_FIELDS.map(f => (
                  <Field key={f.key} label={f.label} type={f.type} value={form.responsible![f.key] ?? ''} onChange={v => setResp(f.key, v)} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">
            Cancelar
          </button>
          <button onClick={submit} disabled={saving} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
            {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Cadastrar aluno'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SecretaryStudents() {
  const { authFetch } = useAuth()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [limit] = useState(10)
  const [modal, setModal] = useState<null | 'new' | { id: number; form: StudentForm }>(null)
  const [detailsId, setDetailsId] = useState<number | null>(null)
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active')
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<Student | null>(null)

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        limit: limit.toString(), offset: (page * limit).toString(),
        ...(search && { search }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
      })
      const res = await authFetch(`/secretary/students?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setStudents(data.data); setTotal(data.total)
    } catch { /* handled silently */ }
    finally { setLoading(false) }
  }, [search, statusFilter, page, limit, authFetch])

  useEffect(() => { fetchStudents() }, [fetchStudents])

  const handleToggle = async (s: Student, deactivation_reason?: string) => {
    setTogglingId(s.id)
    try {
      await authFetch(`/secretary/students/${s.id}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deactivation_reason: deactivation_reason || null }),
      })
      await fetchStudents()
    } finally { setTogglingId(null) }
  }

  const openEdit = async (id: number) => {
    const res = await authFetch(`/secretary/students/${id}`)
    if (!res.ok) return
    const d = await res.json()
    const form: StudentForm = {
      full_name: d.full_name || '', cpf: d.cpf || '', rg: d.rg || '',
      birth_date: d.birth_date ? String(d.birth_date).slice(0, 10) : '',
      address: d.address || '', city: d.city || '', email: d.email || '', phone: d.phone || '',
      due_day: d.due_day ? String(d.due_day) : '', password: '',
      deactivation_reason: d.deactivation_reason || '',
      responsible: d.responsible ? {
        full_name: d.responsible.full_name || '', cpf: d.responsible.cpf || '',
        rg: d.responsible.rg || '',
        birth_date: d.responsible.birth_date ? String(d.responsible.birth_date).slice(0, 10) : '',
        address: d.responsible.address || '', email: d.responsible.email || '',
        phone: d.responsible.phone || '', password: '',
      } : null,
    }
    setModal({ id, form })
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Alunos</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Total: {total} aluno{total !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setModal('new')}
          className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
          <LuPlus className="h-4 w-4" /> Novo Aluno
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
        ) : students.length === 0 ? (
          <p className="p-10 text-center text-sm text-gray-400">Nenhum aluno encontrado.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-700">
                  <tr>
                    {['Nome', 'Status', 'Email', 'Telefone', 'CPF'].map(h => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-gray-300">{h}</th>
                    ))}
                    {statusFilter !== 'active' && (
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-gray-300">Motivo cancel.</th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-gray-300">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {students.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{s.full_name}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          s.is_active ? 'bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${s.is_active ? 'bg-success-500' : 'bg-gray-400'}`} />
                          {s.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{s.email}</td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{s.phone || '-'}</td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{s.cpf}</td>
                      {statusFilter !== 'active' && (
                        <td className="px-6 py-4">
                          {s.deactivation_reason
                            ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-400">{s.deactivation_reason}</span>
                            : <span className="text-gray-400 text-xs">—</span>}
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button onClick={() => setDetailsId(s.id)}
                            className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 text-sm">
                            <LuEye className="h-4 w-4" /> Ver
                          </button>
                          <button onClick={() => openEdit(s.id)} className="text-brand-600 dark:text-brand-400 hover:underline font-medium text-sm">Editar</button>
                          <button onClick={() => s.is_active ? setDeactivateTarget(s) : handleToggle(s)} disabled={togglingId === s.id}
                            className={`flex items-center gap-1 text-sm font-medium disabled:opacity-50 ${
                              s.is_active ? 'text-error-600 hover:text-error-700 dark:text-error-400' : 'text-success-600 hover:text-success-700 dark:text-success-400'
                            }`}>
                            {s.is_active ? <><LuPowerOff className="h-3.5 w-3.5" /> Desativar</> : <><LuPower className="h-3.5 w-3.5" /> Reativar</>}
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

      {deactivateTarget && (
        <DeactivateModal
          studentName={deactivateTarget.full_name}
          onClose={() => setDeactivateTarget(null)}
          onConfirm={(reason) => { handleToggle(deactivateTarget, reason); setDeactivateTarget(null) }}
        />
      )}

      {modal && (
        <StudentModal
          initial={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchStudents() }}
          authFetch={authFetch}
        />
      )}

      {detailsId && (
        <StudentDetailsModal
          studentId={detailsId}
          studentName={students.find(s => s.id === detailsId)?.full_name ?? ''}
          onClose={() => setDetailsId(null)}
          authFetch={authFetch}
        />
      )}
    </div>
  )
}
