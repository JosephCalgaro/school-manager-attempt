import { useEffect, useState } from 'react'
import {
  LuBookOpen,
  LuClock3,
  LuCalendarDays,
  LuCircleCheck,
  LuTriangleAlert,
  LuUser,
  LuChevronDown,
  LuChevronUp,
  LuFileText,
  LuCircleCheckBig,
  LuClipboardList,
} from 'react-icons/lu'
import { useAuth } from '../../hooks/useAuth'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StudentClass {
  id: number
  name: string
  schedule: string | null
  teacher_name: string
}

interface Assignment {
  id: number
  title: string
  type: string
  max_score: number | null
  due_date: string
  description: string | null
  class_name: string
  score: number | null
}

interface ClassAssignment {
  id: number
  title: string
  type: string
  max_score: number | null
  due_date: string
  description: string | null
  score: number | null
}

interface ClassDetails {
  id: number
  name: string
  schedule: string | null
  teacher_name: string
  teacher_email: string | null
  assignments: ClassAssignment[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function daysUntil(dateStr: string): number {
  const due = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((due.getTime() - today.getTime()) / 86400000)
}

const TYPE_LABEL: Record<string, string> = {
  WORK: 'Trabalho',
  EXAM: 'Prova',
  PROJECT: 'Projeto',
  QUIZ: 'Quiz',
  HOMEWORK: 'Lição de Casa',
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function DueBadge({ days, score, maxScore }: { days: number; score: number | null; maxScore: number | null }) {
  if (score !== null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-400">
        <LuCircleCheckBig className="h-3 w-3" />
        {score}{maxScore != null ? `/${maxScore}` : ''}
      </span>
    )
  }
  if (days < 0) return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
      Sem nota
    </span>
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

function ClassCard({
  cls,
  authFetch,
}: {
  cls: StudentClass
  authFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>
}) {
  const [open, setOpen] = useState(false)
  const [details, setDetails] = useState<ClassDetails | null>(null)
  const [loading, setLoading] = useState(false)

  const toggle = async () => {
    if (!open && !details) {
      setLoading(true)
      try {
        const res = await authFetch(`/student/classes/${cls.id}`)
        if (res.ok) setDetails(await res.json())
      } finally {
        setLoading(false)
      }
    }
    setOpen((v) => !v)
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden shadow-sm">
      {/* Header sempre visível */}
      <button
        onClick={toggle}
        className="w-full flex items-start justify-between gap-4 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-500/15">
            <LuBookOpen className="h-4 w-4 text-brand-600 dark:text-brand-400" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white leading-tight">{cls.name}</p>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
              {cls.schedule && (
                <span className="flex items-center gap-1">
                  <LuClock3 className="h-3 w-3" /> {cls.schedule}
                </span>
              )}
              <span className="flex items-center gap-1">
                <LuUser className="h-3 w-3" /> {cls.teacher_name}
              </span>
            </div>
          </div>
        </div>
        {open
          ? <LuChevronUp className="h-4 w-4 shrink-0 text-gray-400 mt-1" />
          : <LuChevronDown className="h-4 w-4 shrink-0 text-gray-400 mt-1" />}
      </button>

      {/* Painel expandido */}
      {open && (
        <div className="border-t border-gray-100 dark:border-gray-700 px-4 pb-4 pt-3">
          {loading ? (
            <div className="flex justify-center py-4">
              <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-brand-500" />
            </div>
          ) : !details ? (
            <p className="text-sm text-gray-400">Erro ao carregar detalhes.</p>
          ) : (
            <>
              {details.teacher_email && (
                <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                  Professor: <span className="font-medium text-gray-700 dark:text-gray-300">{details.teacher_name}</span>
                  {' · '}
                  <a href={`mailto:${details.teacher_email}`} className="text-brand-600 dark:text-brand-400 hover:underline">
                    {details.teacher_email}
                  </a>
                </p>
              )}

              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Atividades da turma
              </p>

              {details.assignments.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500">Nenhuma atividade nesta turma.</p>
              ) : (
                <div className="space-y-2">
                  {details.assignments.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-start justify-between gap-3 rounded-lg bg-gray-50 dark:bg-gray-900 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{a.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {TYPE_LABEL[a.type] ?? a.type} · Entrega: {formatDate(a.due_date)}
                        </p>
                        {a.description && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-2">{a.description}</p>
                        )}
                      </div>
                      <DueBadge days={daysUntil(a.due_date)} score={a.score} maxScore={a.max_score} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function StudentDashboard() {
  const { user, authFetch } = useAuth()

  const [classes, setClasses] = useState<StudentClass[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      try {
        setLoading(true)
        setError(null)

        const [classRes, assignRes] = await Promise.all([
          authFetch('/student/classes'),
          authFetch('/student/assignments'),
        ])

        if (classRes.ok) setClasses(await classRes.json())
        if (assignRes.ok) setAssignments(await assignRes.json())
      } catch (err) {
          console.error('Erro ao carregar painel do aluno:', err)
          setError('Não foi possível carregar os dados do painel.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user, authFetch])

  const pending = assignments.filter((a) => a.score === null && daysUntil(a.due_date) >= 0)
  const urgent  = pending.filter((a) => daysUntil(a.due_date) <= 3)
  const graded  = assignments.filter((a) => a.score !== null)

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-brand-500" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Carregando...</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="m-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
      {error}
    </div>
  )

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Olá, {user?.fullName?.split(' ')[0]} 👋
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Bem-vindo ao seu painel. Aqui estão suas turmas e atividades.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border-l-4 border-l-brand-500 bg-white p-5 shadow-sm dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Turmas</p>
              <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">{classes.length}</p>
            </div>
            <div className="rounded-full bg-brand-50 p-3 dark:bg-brand-500/15">
              <LuBookOpen className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border-l-4 border-l-orange-500 bg-white p-5 shadow-sm dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pendentes</p>
              <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">{pending.length}</p>
            </div>
            <div className="rounded-full bg-orange-100 p-3 dark:bg-orange-900/30">
              <LuClipboardList className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border-l-4 border-l-green-500 bg-white p-5 shadow-sm dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Com Nota</p>
              <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">{graded.length}</p>
            </div>
            <div className="rounded-full bg-green-100 p-3 dark:bg-green-900/30">
              <LuCircleCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Minhas Turmas */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <LuBookOpen className="h-4 w-4" /> Minhas Turmas
          </h2>
          {classes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center dark:border-gray-700">
              <p className="text-sm text-gray-400">Você não está matriculado em nenhuma turma.</p>
            </div>
          ) : (
            classes.map((cls) => (
              <ClassCard key={cls.id} cls={cls} authFetch={authFetch} />
            ))
          )}
        </div>

        {/* Atividades Pendentes */}
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <LuFileText className="h-4 w-4" /> Atividades Pendentes
          </h2>

          {pending.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center dark:border-gray-700">
              <LuCircleCheck className="mx-auto mb-2 h-8 w-8 text-green-400" />
              <p className="text-sm text-gray-400">Nenhuma atividade pendente!</p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 shadow-sm divide-y divide-gray-100 dark:divide-gray-700">
              {pending
                .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
                .map((a) => {
                  const days = daysUntil(a.due_date)
                  return (
                    <div key={a.id} className="flex items-start justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{a.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {a.class_name} · {TYPE_LABEL[a.type] ?? a.type}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          {formatDate(a.due_date)}
                        </p>
                      </div>
                      <DueBadge days={days} score={null} maxScore={a.max_score} />
                    </div>
                  )
                })}
            </div>
          )}

          {/* Urgentes */}
          {urgent.length > 0 && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-orange-700 dark:text-orange-400 mb-2">
                <LuTriangleAlert className="h-3.5 w-3.5" />
                {urgent.length} atividade{urgent.length > 1 ? 's' : ''} vencem em até 3 dias!
              </p>
              {urgent.map((a) => (
                <p key={a.id} className="text-xs text-orange-600 dark:text-orange-400 truncate">
                  · {a.title} ({a.class_name})
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}