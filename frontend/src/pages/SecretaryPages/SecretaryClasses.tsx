import { useCallback, useEffect, useState } from 'react'
import { LuSearch, LuX, LuPlus, LuUsers, LuPencil, LuUserMinus } from 'react-icons/lu'
import { useAuth } from '../../hooks/useAuth'

interface Class { id: number; name: string; schedule: string | null; teacher_name: string | null; total_students: number }
interface ClassForm { name: string; schedule: string }
interface Student { id: number; full_name: string; email: string; cpf: string }

const emptyForm = (): ClassForm => ({ name: '', schedule: '' })

// ─── Modal criar / editar turma ──────────────────────────────────────────────
function ClassModal({ initial, onClose, onSaved, authFetch }: {
  initial?: Class | null; onClose: () => void; onSaved: () => void
  authFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>
}) {
  const isEdit = Boolean(initial?.id)
  const [form, setForm] = useState<ClassForm>(
    initial ? { name: initial.name, schedule: initial.schedule ?? '' } : emptyForm()
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    if (!form.name.trim()) return setError('Nome da turma é obrigatório')
    setSaving(true)
    try {
      const url    = isEdit ? `/secretary/classes/${initial!.id}` : '/secretary/classes'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await authFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.message || 'Erro ao salvar') }
      onSaved()
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao salvar') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{isEdit ? 'Editar Turma' : 'Nova Turma'}</h2>
          <button onClick={onClose}><LuX className="h-5 w-5 text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-400">{error}</p>}
          {[
            { key: 'name' as const, label: 'Nome da turma *' },
            { key: 'schedule' as const, label: 'Horário (ex: Seg/Qua 19h)' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{f.label}</label>
              <input value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300">Cancelar</button>
          <button onClick={submit} disabled={saving} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
            {saving ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar turma'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal gerenciar alunos da turma ─────────────────────────────────────────
function ClassStudentsModal({ cls, onClose, authFetch }: {
  cls: Class; onClose: () => void
  authFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>
}) {
  const [enrolled, setEnrolled]   = useState<Student[]>([])
  const [available, setAvailable] = useState<Student[]>([])
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(true)
  const [busy, setBusy]           = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [enrolledRes, allRes] = await Promise.all([
        authFetch(`/secretary/classes/${cls.id}/students`),
        authFetch(`/secretary/students?limit=200&offset=0`),
      ])
      const enrolledData: Student[] = enrolledRes.ok ? await enrolledRes.json() : []
      const allData: Student[]      = allRes.ok ? (await allRes.json()).data ?? [] : []
      const enrolledIds = new Set(enrolledData.map(s => s.id))
      setEnrolled(enrolledData)
      setAvailable(allData.filter(s => !enrolledIds.has(s.id)))
    } finally { setLoading(false) }
  }, [cls.id, authFetch])

  useEffect(() => { load() }, [load])

  const add = async (studentId: number) => {
    setBusy(studentId)
    await authFetch(`/secretary/classes/${cls.id}/students`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: studentId }),
    })
    await load(); setBusy(null)
  }

  const remove = async (studentId: number) => {
    setBusy(studentId)
    await authFetch(`/secretary/classes/${cls.id}/students/${studentId}`, { method: 'DELETE' })
    await load(); setBusy(null)
  }

  const filteredAvailable = available.filter(s =>
    !search || s.full_name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-gray-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Alunos — {cls.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{enrolled.length} aluno{enrolled.length !== 1 ? 's' : ''} matriculado{enrolled.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose}><LuX className="h-5 w-5 text-gray-400" /></button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand-500" /></div>
        ) : (
          <div className="flex flex-1 overflow-hidden divide-x divide-gray-200 dark:divide-gray-700">
            {/* Matriculados */}
            <div className="flex-1 flex flex-col overflow-hidden p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">Matriculados</h3>
              <div className="flex-1 overflow-y-auto space-y-1">
                {enrolled.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">Nenhum aluno matriculado</p>
                ) : enrolled.map(s => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-white">{s.full_name}</p>
                      <p className="text-xs text-gray-400">{s.email}</p>
                    </div>
                    <button onClick={() => remove(s.id)} disabled={busy === s.id}
                      className="text-red-400 hover:text-red-600 disabled:opacity-40 ml-2">
                      <LuUserMinus className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Disponíveis */}
            <div className="flex-1 flex flex-col overflow-hidden p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">Adicionar aluno</h3>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
                className="mb-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
              <div className="flex-1 overflow-y-auto space-y-1">
                {filteredAvailable.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">Nenhum aluno disponível</p>
                ) : filteredAvailable.map(s => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-white">{s.full_name}</p>
                      <p className="text-xs text-gray-400">{s.email}</p>
                    </div>
                    <button onClick={() => add(s.id)} disabled={busy === s.id}
                      className="rounded-full bg-brand-500 p-1 text-white hover:bg-brand-600 disabled:opacity-40 ml-2">
                      <LuPlus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SecretaryClasses() {
  const { authFetch } = useAuth()
  const [classes, setClasses]   = useState<Class[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [classModal, setClassModal] = useState<null | 'new' | Class>(null)
  const [studentsModal, setStudentsModal] = useState<Class | null>(null)

  const fetchClasses = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams(search ? { search } : {})
      const res = await authFetch(`/secretary/classes?${params}`)
      if (res.ok) setClasses(await res.json())
    } finally { setLoading(false) }
  }, [search, authFetch])

  useEffect(() => { fetchClasses() }, [fetchClasses])

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Turmas</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{classes.length} turma{classes.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setClassModal('new')}
          className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
          <LuPlus className="h-4 w-4" /> Nova Turma
        </button>
      </div>

      <div className="relative">
        <LuSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome..."
          className="h-11 w-full rounded-xl border border-gray-300 bg-white pl-10 pr-4 text-sm outline-none focus:ring-2 ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex justify-center p-10"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand-500" /></div>
        ) : classes.length === 0 ? (
          <p className="p-10 text-center text-sm text-gray-400">Nenhuma turma encontrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-700">
                <tr>
                  {['Nome', 'Horário', 'Professor', 'Alunos', 'Ações'].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-gray-300">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {classes.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{c.name}</td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{c.schedule || '—'}</td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{c.teacher_name || '—'}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 dark:bg-brand-900/20 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:text-brand-400">
                        <LuUsers className="h-3 w-3" /> {c.total_students}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <button onClick={() => setStudentsModal(c)}
                          className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400">
                          <LuUsers className="h-4 w-4" /> Alunos
                        </button>
                        <button onClick={() => setClassModal(c)}
                          className="flex items-center gap-1 text-sm text-brand-600 dark:text-brand-400 hover:underline font-medium">
                          <LuPencil className="h-3.5 w-3.5" /> Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {classModal && (
        <ClassModal
          initial={classModal === 'new' ? null : classModal}
          onClose={() => setClassModal(null)}
          onSaved={() => { setClassModal(null); fetchClasses() }}
          authFetch={authFetch}
        />
      )}

      {studentsModal && (
        <ClassStudentsModal
          cls={studentsModal}
          onClose={() => { setStudentsModal(null); fetchClasses() }}
          authFetch={authFetch}
        />
      )}
    </div>
  )
}
