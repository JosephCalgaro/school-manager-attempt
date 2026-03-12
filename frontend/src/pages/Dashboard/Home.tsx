import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { LuUsers, LuBookOpen, LuCalendarDays, LuGraduationCap, LuClipboardList, LuTrendingUp } from 'react-icons/lu'
import { useAuth } from '../../hooks/useAuth'
import PageMeta from '../../components/common/PageMeta'

type Stats = {
  totalStudents: number
  totalClasses: number
  totalUsers?: number
  upcomingAssignments?: number
}

type RecentClass = {
  id: number
  name: string
  schedule: string | null
  totalStudents: number
  attendanceRate: number
}

function StatCard({
  icon, label, value, sub, color,
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  sub?: string
  color: string
}) {
  return (
    <div className={`rounded-xl border-l-4 bg-white p-5 shadow-sm dark:bg-gray-800 ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
          <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
        </div>
        <div className="text-gray-400 dark:text-gray-500">{icon}</div>
      </div>
    </div>
  )
}

export default function Home() {
  const { user, authFetch } = useAuth()
  const navigate = useNavigate()
  const role = user?.role?.toUpperCase()
  const isAdmin = role === 'ADMIN'

  const [stats, setStats] = useState<Stats | null>(null)
  const [classes, setClasses] = useState<RecentClass[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const apiBase = isAdmin ? '/admin' : '/teacher'
    const load = async () => {
      try {
        const [statsRes, classRes] = await Promise.all([
          authFetch(`${apiBase}/stats`),
          authFetch(`${apiBase}/classes`),
        ])
        if (statsRes.ok) setStats(await statsRes.json())
        if (classRes.ok) {
          const data = await classRes.json()
          setClasses(Array.isArray(data) ? data.slice(0, 5) : [])
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user, authFetch])

  const detailBase = isAdmin ? '/admin/classes' : '/teacher/classes'

  return (
    <>
      <PageMeta title="Início | Escola" description="Painel principal do sistema escolar" />
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Olá, {user?.fullName?.split(' ')[0]} 👋
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {isAdmin ? 'Visão geral da escola' : 'Visão geral das suas turmas'}
          </p>
        </div>

        {/* Stats */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[1,2,3].map(i => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard icon={<LuGraduationCap className="h-8 w-8" />} label="Alunos" value={stats?.totalStudents ?? 0} color="border-l-brand-500" />
            <StatCard icon={<LuBookOpen className="h-8 w-8" />} label="Turmas" value={stats?.totalClasses ?? 0} color="border-l-teal-500" />
            {isAdmin
              ? <StatCard icon={<LuUsers className="h-8 w-8" />} label="Usuários" value={stats?.totalUsers ?? 0} color="border-l-purple-500" />
              : <StatCard icon={<LuClipboardList className="h-8 w-8" />} label="Atividades Próximas" value={stats?.upcomingAssignments ?? 0} sub="nos próximos dias" color="border-l-orange-500" />
            }
          </div>
        )}

        {/* Turmas Recentes */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
              <LuBookOpen className="h-4 w-4" /> Turmas Recentes
            </h2>
            <button
              onClick={() => navigate(isAdmin ? '/admin/classes' : '/teacher')}
              className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
            >
              Ver todas →
            </button>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />)}
            </div>
          ) : classes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center dark:border-gray-700">
              <p className="text-sm text-gray-400">Nenhuma turma cadastrada ainda.</p>
              <button
                onClick={() => navigate(isAdmin ? '/admin/classes' : '/teacher')}
                className="mt-2 text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                Criar primeira turma →
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
              {classes.map(cls => (
                <button
                  key={cls.id}
                  onClick={() => navigate(`${detailBase}/${cls.id}`)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-white">{cls.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {cls.schedule || 'Sem horário'} · {cls.totalStudents} aluno{cls.totalStudents !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {cls.attendanceRate > 0 && (
                      <span className={`flex items-center gap-1 text-xs font-medium ${
                        cls.attendanceRate >= 75
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-500 dark:text-red-400'
                      }`}>
                        <LuTrendingUp className="h-3 w-3" />
                        {cls.attendanceRate}%
                      </span>
                    )}
                    <span className="text-gray-300 dark:text-gray-600">›</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Atalhos */}
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <LuCalendarDays className="h-4 w-4" /> Atalhos
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
            { label: isAdmin ? 'Gerenciar Alunos' : 'Meus Alunos', icon: <LuUsers className="h-5 w-5" />, path: isAdmin ? '/admin/students' : '/teacher/students' },
              { label: 'Turmas', icon: <LuBookOpen className="h-5 w-5" />, path: isAdmin ? '/admin/classes' : '/teacher' },
              { label: 'Calendário', icon: <LuCalendarDays className="h-5 w-5" />, path: '/calendar' },
              ...(isAdmin ? [{ label: 'Usuários', icon: <LuGraduationCap className="h-5 w-5" />, path: '/admin/users' }] : []),
            ].map(item => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white p-4 text-sm font-medium text-gray-700 hover:border-brand-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-brand-700 transition"
              >
                <span className="text-gray-400 dark:text-gray-500">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
