import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  LuBookOpen, LuClock3, LuSearch, LuUsers,
  LuPlus, LuPencil, LuX, LuCheck, LuChevronDown,
  LuPowerOff, LuPower
} from 'react-icons/lu'
import { useAuth } from '../../hooks/useAuth'

// ─── Types ────────────────────────────────────────────────────────────────────

type TeacherClass = {
  id: number
  name: string
  schedule: string | null
  classroom: string | null
  totalStudents: number
  is_active?: number
}

type Student = { id: number; full_name: string; email: string }
type Teacher = { id: number; full_name: string; email: string }

type ClassForm = {
  name: string
  teacherId: string
  schedule: string
  classroom: string
  students: number[]
}

type TeacherDashboardProps = {
  apiBase?: string
  detailBasePath?: string
  allowedRoles?: string[]
  title?: string
  isAdmin?: boolean
}

// ─── Student multi-select ─────────────────────────────────────────────────────

function StudentMultiSelect({
  all,
  selected,
  onChange,
}: {
  all: Student[]
  selected: number[]
  onChange: (ids: number[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = all.filter((s) =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  )

  const toggle = (id: number) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }

  const selectedNames = all.filter((s) => selected.includes(s.id)).map((s) => s.full_name)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 text-left"
      >
        <span className="truncate text-gray-700 dark:text-gray-300">
          {selected.length === 0
            ? 'Selecionar alunos...'
            : `${selected.length} aluno(s) selecionado(s)`}
        </span>
        <LuChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
      </button>

      {selected.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {selectedNames.map((name, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
            >
              {name}
              <button
                type="button"
                onClick={() => toggle(all.find((s) => s.full_name === name)!.id)}
              >
                <LuX className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar aluno..."
              className="w-full rounded border border-gray-200 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="p-3 text-sm text-gray-400">Nenhum aluno encontrado</p>
            ) : (
              filtered.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggle(s.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
                >
                  <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    selected.includes(s.id)
                      ? 'border-brand-500 bg-brand-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}>
                    {selected.includes(s.id) && <LuCheck className="h-3 w-3 text-white" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 dark:text-gray-200 truncate">{s.full_name}</p>
                    <p className="text-xs text-gray-400 truncate">{s.email}</p>
                  </div>
                </button>
              ))
            )}
          </div>
          <div className="border-t border-gray-100 dark:border-gray-700 p-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full rounded-lg bg-brand-500 py-1.5 text-sm font-medium text-white hover:bg-brand-600"
            >
              Confirmar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Teacher single-select ────────────────────────────────────────────────────

function TeacherSelect({
  teachers,
  value,
  onChange,
}: {
  teachers: Teacher[]
  value: string
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const selected = teachers.find((t) => String(t.id) === value)
  const filtered = teachers.filter((t) =>
    (t.full_name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 text-left"
      >
        <span className={selected ? 'text-gray-800 dark:text-white' : 'text-gray-400 dark:text-gray-500'}>
          {selected ? selected.full_name : 'Selecionar professor...'}
        </span>
        <LuChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar professor..."
              className="w-full rounded border border-gray-200 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="p-3 text-sm text-gray-400">Nenhum professor encontrado</p>
            ) : (
              filtered.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { onChange(String(t.id)); setOpen(false); setSearch('') }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
                >
                  <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    String(t.id) === value
                      ? 'border-brand-500 bg-brand-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}>
                    {String(t.id) === value && <div className="h-2 w-2 rounded-full bg-white" />}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800 dark:text-gray-200">{t.full_name}</p>
                    <p className="text-xs text-gray-400">{t.email}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Class Modal ──────────────────────────────────────────────────────────────

function ClassModal({
  editing,
  isAdmin,
  apiBase,
  currentUserId,
  onClose,
  onSaved,
  authFetch,
}: {
  editing: TeacherClass | null
  isAdmin: boolean
  apiBase: string
  currentUserId: number
  onClose: () => void
  onSaved: () => void
  authFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>
}) {
  const [form, setForm] = useState<ClassForm>({
    name: editing?.name ?? '',
    teacherId: isAdmin ? '' : String(currentUserId),
    schedule: editing?.schedule ?? '',
    classroom: editing?.classroom ?? '',
    students: [],
  })
  const [students, setStudents] = useState<Student[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoadingData(true)

        // Busca todos os alunos ativos (resposta paginada: { data: [...] })
        const sRes = await authFetch(`${apiBase}/students?limit=500&status=active`)
        if (sRes.ok) {
          const sData = await sRes.json()
          setStudents(Array.isArray(sData) ? sData : (sData.data ?? []))
        }

        // Busca professores (apenas admin)
        if (isAdmin) {
          const uRes = await authFetch(`${apiBase}/users?role=TEACHER&limit=100`)
          if (uRes.ok) {
            const uData = await uRes.json()
            const userList: { id: number; full_name: string; email: string; role: string }[] =
              Array.isArray(uData) ? uData : (uData.data ?? [])
            setTeachers(
              userList
                .filter((u) => u.role === 'TEACHER')
                .map((u) => ({ id: u.id, full_name: u.full_name ?? '', email: u.email }))
            )
          }
        }

        // Se editando, carrega alunos atuais da turma
        if (editing) {
          const cRes = await authFetch(`${apiBase}/classes/${editing.id}`)
          if (cRes.ok) {
            const data = await cRes.json()
            setForm((prev) => ({
              ...prev,
              students: (data.students ?? []).map((s: { id: number }) => s.id),
              schedule: data.schedule ?? prev.schedule,
              classroom: data.classroom ?? '',
              teacherId: isAdmin ? String(data.teacher_id ?? '') : prev.teacherId,
            }))
          }
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoadingData(false)
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id, isAdmin, apiBase])

  const submit = async () => {
    if (!form.name.trim()) return setError('Nome da turma é obrigatório')
    if (isAdmin && !form.teacherId) return setError('Selecione um professor')
    if (form.students.length === 0) return setError('Adicione pelo menos um aluno')

    setSaving(true)
    setError(null)
    try {
      // Payload alinhado com adminController.createClass / updateClass
      const payload = {
        name: form.name.trim(),
        teacher_id: form.teacherId ? Number(form.teacherId) : undefined,
        schedule: form.schedule.trim() || null,
        classroom: form.classroom.trim() || null,
        students: form.students,
      }

      const url    = editing ? `${apiBase}/classes/${editing.id}` : `${apiBase}/classes`
      const method = editing ? 'PUT' : 'POST'

      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.message || err?.error || err?.errors?.[0] || 'Erro ao salvar turma')
      }

      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar turma')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {editing ? 'Editar Turma' : 'Nova Turma'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <LuX className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {loadingData ? (
            <div className="flex justify-center py-6">
              <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-brand-500" />
            </div>
          ) : (
            <>
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-400">
                  {error}
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Nome da turma <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Turma de Violão Avançado"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Horário
                </label>
                <input
                  value={form.schedule}
                  onChange={(e) => setForm((p) => ({ ...p, schedule: e.target.value }))}
                  placeholder="Ex: Seg/Qua 19h–20h30"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Sala
                </label>
                <input
                  value={form.classroom}
                  onChange={(e) => setForm((p) => ({ ...p, classroom: e.target.value }))}
                  placeholder="Ex: Sala 3, Lab de Informática"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              {isAdmin && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Professor <span className="text-red-500">*</span>
                  </label>
                  <TeacherSelect
                    teachers={teachers}
                    value={form.teacherId}
                    onChange={(id) => setForm((p) => ({ ...p, teacherId: id }))}
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Alunos <span className="text-red-500">*</span>
                </label>
                <StudentMultiSelect
                  all={students}
                  selected={form.students}
                  onChange={(ids) => setForm((p) => ({ ...p, students: ids }))}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving || loadingData}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {saving ? 'Salvando...' : editing ? 'Salvar Alterações' : 'Criar Turma'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TeacherDashboard({
  apiBase = '/teacher',
  detailBasePath = '/teacher/classes',
  allowedRoles = ['TEACHER'],
  title = 'Minhas Turmas',
  isAdmin = false,
}: TeacherDashboardProps) {
  const { user, authFetch } = useAuth()
  const navigate = useNavigate()

  const [classes, setClasses] = useState<TeacherClass[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingClass, setEditingClass] = useState<TeacherClass | null>(null)
  const [togglingId, setTogglingId] = useState<number | null>(null)

  const fetchClasses = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await authFetch(`${apiBase}/classes`)
      if (!res.ok) throw new Error('Não foi possível carregar as turmas')
      const data = await res.json()
      setClasses(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar turmas')
    } finally {
      setLoading(false)
    }
  }, [apiBase, authFetch])

  const allowedRolesRef = useRef(allowedRoles)

  useEffect(() => {
    const role = user?.role?.toUpperCase()
    if (user && (!role || !allowedRolesRef.current.includes(role))) {
      navigate('/')
      return
    }
    if (!user) return
    fetchClasses()
  }, [user, fetchClasses, navigate])

  const toggleClass = async (cls: TeacherClass & { is_active?: number }) => {
    const isActive = cls.is_active !== 0
    const msg = isActive
      ? 'Desativar esta turma? Ela ficará oculta para professores e alunos.'
      : 'Reativar esta turma?'
    if (!confirm(msg)) return
    setTogglingId(cls.id)
    try {
      const res = await authFetch(`${apiBase}/classes/${cls.id}/toggle`, { method: 'PATCH' })
      if (!res.ok) throw new Error('Erro ao alterar status da turma')
      await fetchClasses()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao alterar status da turma')
    } finally {
      setTogglingId(null)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return classes
    return classes.filter((c) => c.name.toLowerCase().includes(q))
  }, [classes, search])

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <p className="text-sm text-gray-500 dark:text-gray-400">Carregando turmas...</p>
    </div>
  )

  if (error) return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
      {error}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{title}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {classes.length} turma{classes.length !== 1 ? 's' : ''} cadastrada{classes.length !== 1 ? 's' : ''}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setEditingClass(null); setModalOpen(true) }}
            className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
          >
            <LuPlus className="h-4 w-4" />
            Nova Turma
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <LuSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar turma por nome..."
          className="h-11 w-full rounded-xl border border-gray-300 bg-white pl-10 pr-4 text-sm outline-none focus:ring-2 ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        />
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-900">
          <LuBookOpen className="mx-auto mb-3 h-8 w-8 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {search ? 'Nenhuma turma encontrada para essa busca.' : 'Nenhuma turma cadastrada ainda.'}
          </p>
          {!search && isAdmin && (
            <button
              onClick={() => { setEditingClass(null); setModalOpen(true) }}
              className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
            >
              Criar primeira turma →
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((cls) => (
            <div
              key={cls.id}
              className="group relative rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900 hover:border-brand-300 hover:shadow-md dark:hover:border-brand-700 transition"
            >
              {/* Action buttons — admin only */}
              {isAdmin && (
                <div className="absolute right-3 top-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingClass(cls); setModalOpen(true) }}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                  title="Editar turma"
                >
                  <LuPencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleClass(cls) }}
                  disabled={togglingId === cls.id}
                  className={`rounded-lg p-1.5 disabled:opacity-50 transition-colors ${
                    cls.is_active !== 0
                      ? 'text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400'
                      : 'text-gray-400 hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-900/30 dark:hover:text-green-400'
                  }`}
                  title={cls.is_active !== 0 ? 'Desativar turma' : 'Reativar turma'}
                >
                  {cls.is_active !== 0
                    ? <LuPowerOff className="h-3.5 w-3.5" />
                    : <LuPower className="h-3.5 w-3.5" />
                  }
                </button>
              </div>
              )}

              {/* Card content — clickable */}
              <button
                className="w-full text-left"
                onClick={() => navigate(`${detailBasePath}/${cls.id}`)}
              >
                <div className="mb-4">
                  <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                    <LuBookOpen className="h-3.5 w-3.5" />
                    Turma
                  </span>
                </div>

                <h2 className="text-lg font-semibold text-gray-900 group-hover:text-brand-700 dark:text-white dark:group-hover:text-brand-300 pr-16">
                  {cls.name}
                </h2>

                <div className="mt-4 space-y-2 text-sm text-gray-500 dark:text-gray-400">
                  <p className="flex items-center gap-2">
                    <LuClock3 className="h-4 w-4 shrink-0" />
                    {cls.schedule || 'Horário não informado'}
                  </p>
                  {cls.classroom && (
                    <p className="flex items-center gap-2">
                      <LuBookOpen className="h-4 w-4 shrink-0" />
                      {cls.classroom}
                    </p>
                  )}
                  <p className="flex items-center gap-2">
                    <LuUsers className="h-4 w-4 shrink-0" />
                    {cls.totalStudents} aluno{cls.totalStudents !== 1 ? 's' : ''}
                  </p>
                </div>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <ClassModal
          editing={editingClass}
          isAdmin={isAdmin}
          apiBase={apiBase}
          currentUserId={user?.id ?? 0}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); fetchClasses() }}
          authFetch={authFetch}
        />
      )}
    </div>
  )
}