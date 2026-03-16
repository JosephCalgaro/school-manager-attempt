import { useEffect, useState } from 'react'
import {
  LuGraduationCap, LuBookOpen, LuCalendarDays, LuClock3,
  LuUser, LuFileText, LuCircleCheck, LuTriangleAlert,
  LuClipboardList, LuChevronDown, LuChevronUp,
} from 'react-icons/lu'
import { useAuth } from '../../hooks/useAuth'
import PageMeta from '../../components/common/PageMeta'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Student {
  id: number
  full_name: string
  email: string
  phone: string | null
  cpf: string
  rg: string | null
  birth_date: string | null
  address: string | null
  due_day: number | null
}

interface ResponsibleClass {
  id: number
  name: string
  schedule: string | null
  teacher_name: string
}

interface Assignment {
  id: number
  title: string
  description: string | null
  type: string | null
  max_score: number | null
  due_date: string
  class_name: string
  student_id: number
  student_name: string
  score: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string | null) {
  if (!iso) return '—'
  const dateOnly = iso.slice(0, 10) // garante "YYYY-MM-DD" mesmo se vier com timezone
  return new Date(dateOnly + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function daysUntil(dateStr: string) {
  const dateOnly = dateStr.slice(0, 10) // garante "YYYY-MM-DD"
  const due = new Date(dateOnly + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.ceil((due.getTime() - today.getTime()) / 86400000)
}

// ─── DueBadge ─────────────────────────────────────────────────────────────────

function DueBadge({ days }: { days: number }) {
  if (days < 0) return (
    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">Encerrada</span>
  )
  if (days === 0) return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-400">
      <LuTriangleAlert className="h-3 w-3" /> Hoje!
    </span>
  )
  if (days <= 3) return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/40 dark:text-orange-400">
      <LuClock3 className="h-3 w-3" /> {days}d
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
      <LuCalendarDays className="h-3 w-3" /> {days}d
    </span>
  )
}

// ─── StudentCard ──────────────────────────────────────────────────────────────

function StudentCard({ student }: { student: Student }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-4 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-500/15">
            <LuGraduationCap className="h-4 w-4 text-brand-600 dark:text-brand-400" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white leading-tight">{student.full_name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{student.email}</p>
          </div>
        </div>
        {open ? <LuChevronUp className="h-4 w-4 shrink-0 text-gray-400" /> : <LuChevronDown className="h-4 w-4 shrink-0 text-gray-400" />}
      </button>
      {open && (
        <div className="border-t border-gray-100 dark:border-gray-700 px-4 pb-4 pt-3">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {[
              { label: 'Telefone',            value: student.phone },
              { label: 'CPF',                 value: student.cpf },
              { label: 'RG',                  value: student.rg },
              { label: 'Data de nascimento',  value: fmt(student.birth_date) },
              { label: 'Endereço',            value: student.address },
              { label: 'Dia de vencimento',   value: student.due_day ? `Dia ${student.due_day}` : null },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                <p className="font-medium text-gray-800 dark:text-white">{value || '—'}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── ClassCard ────────────────────────────────────────────────────────────────

function ClassCard({ cls }: { cls: ResponsibleClass }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 shadow-sm">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-500/15">
        <LuBookOpen className="h-4 w-4 text-teal-600 dark:text-teal-400" />
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-gray-900 dark:text-white leading-tight truncate">{cls.name}</p>
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-gray-500 dark:text-gray-400">
          {cls.schedule && <span className="flex items-center gap-1"><LuClock3 className="h-3 w-3" /> {cls.schedule}</span>}
          <span className="flex items-center gap-1"><LuUser className="h-3 w-3" /> {cls.teacher_name}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: number; color: string
}) {
  return (
    <div className={`rounded-xl border-l-4 bg-white p-5 shadow-sm dark:bg-gray-800 ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
          <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
        <div className="text-gray-400 dark:text-gray-500">{icon}</div>
      </div>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1,2,3].map(i => <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />)}
      </div>
      <div className="space-y-3">
        {[1,2].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />)}
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function ResponsibleDashboard() {
  const { user, authFetch } = useAuth()

  const [students,    setStudents]    = useState<Student[]>([])
  const [classes,     setClasses]     = useState<ResponsibleClass[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const [sRes, cRes, aRes] = await Promise.all([
          authFetch('/responsible/students'),
          authFetch('/responsible/classes'),
          authFetch('/responsible/assignments'),
        ])
        // 200 = dados, 404 = lista vazia (legado), qualquer outro = erro
        if (sRes.ok) setStudents(await sRes.json())
        else if (sRes.status !== 404) throw new Error('Erro ao carregar alunos')
        if (cRes.ok) setClasses(await cRes.json())
        else if (cRes.status !== 404) throw new Error('Erro ao carregar turmas')
        if (aRes.ok) setAssignments(await aRes.json())
        else if (aRes.status !== 404) throw new Error('Erro ao carregar atividades')
      } catch (err) {
        console.error(err)
        setError('Não foi possível carregar os dados do painel.')
      } finally { setLoading(false) }
    }
    load()
  }, [user, authFetch])

  if (loading) return <Skeleton />
  if (error) return (
    <div className="m-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">{error}</div>
  )

  const today     = assignments.filter(a => daysUntil(a.due_date) >= 0)
  const urgent    = today.filter(a => daysUntil(a.due_date) <= 3)
  // deduplicar por assignment id para o alerta de urgência (pode haver 1 linha por aluno)
  const urgentUniq = urgent.filter((a, i, arr) => arr.findIndex(x => x.id === a.id) === i)
  const upcoming  = [...today].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())

  return (
    <>
      <PageMeta title="Painel do Responsável" description="Acompanhe as turmas e atividades do seu aluno" />
      <div className="space-y-8 p-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Olá, {user?.full_name?.split(' ')[0]} 👋
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Acompanhe as turmas e atividades do seu aluno.
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            icon={<LuGraduationCap className="h-8 w-8" />}
            label="Alunos" value={students.length}
            color="border-l-brand-500"
          />
          <StatCard
            icon={<LuBookOpen className="h-8 w-8" />}
            label="Turmas" value={classes.length}
            color="border-l-teal-500"
          />
          <StatCard
            icon={<LuClipboardList className="h-8 w-8" />}
            label="Atividades Abertas" value={new Set(today.map(a => a.id)).size}
            color="border-l-orange-500"
          />
        </div>

        {/* Alerta de urgentes */}
        {urgentUniq.length > 0 && (
          <div className="rounded-xl border border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30 px-4 py-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-orange-700 dark:text-orange-400 mb-2">
              <LuTriangleAlert className="h-4 w-4" />
              {urgentUniq.length} atividade{urgentUniq.length > 1 ? 's' : ''} vencem em até 3 dias!
            </p>
            {urgentUniq.map(a => (
              <p key={`${a.id}-${a.student_id}`} className="text-xs text-orange-600 dark:text-orange-400 truncate">
                · {a.title} — {a.class_name} ({fmt(a.due_date)})
              </p>
            ))}
          </div>
        )}

        {/* Grid principal */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">

          {/* Meus Alunos */}
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
              <LuGraduationCap className="h-4 w-4" /> Meus Alunos
            </h2>
            {students.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center dark:border-gray-700">
                <p className="text-sm text-gray-400">Nenhum aluno vinculado.</p>
              </div>
            ) : students.map(s => <StudentCard key={s.id} student={s} />)}
          </section>

          {/* Turmas */}
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
              <LuBookOpen className="h-4 w-4" /> Turmas Matriculadas
            </h2>
            {classes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center dark:border-gray-700">
                <p className="text-sm text-gray-400">Nenhuma turma encontrada.</p>
              </div>
            ) : classes.map(c => <ClassCard key={c.id} cls={c} />)}
          </section>
        </div>

        {/* Atividades */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <LuFileText className="h-4 w-4" /> Próximas Atividades
          </h2>

          {upcoming.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center dark:border-gray-700">
              <LuCircleCheck className="mx-auto mb-2 h-8 w-8 text-green-400" />
              <p className="text-sm text-gray-400">Nenhuma atividade aberta no momento.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800 shadow-sm">
              {upcoming.map(a => {
                const days = daysUntil(a.due_date)
                return (
                  <div key={`${a.id}-${a.student_id}`} className="flex items-start justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{a.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {a.class_name}
                        {a.type && <> · {a.type}</>}
                        {' · '}<span className="font-medium text-gray-600 dark:text-gray-300">{a.student_name}</span>
                      </p>
                      {a.description && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-1">{a.description}</p>
                      )}
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Entrega: {fmt(a.due_date)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <DueBadge days={days} />
                      {a.score !== null && (
                        <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                          {a.score}{a.max_score != null ? `/${a.max_score}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

      </div>
    </>
  )
}
