import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { LuGraduationCap, LuUserPlus, LuCalendarDays, LuUsers, LuBookOpen } from 'react-icons/lu'
import { useAuth } from '../../hooks/useAuth'
import PageMeta from '../../components/common/PageMeta'

type Stats = { totalStudents: number; newThisMonth: number; currentMonth: string }

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: number | string; sub?: string; color: string
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

type RecentStudent = { id: number; full_name: string; email: string; created_at: string }

export default function SecretaryHome() {
  const { user, authFetch } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats]     = useState<Stats | null>(null)
  const [recent, setRecent]   = useState<RecentStudent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, studentsRes] = await Promise.all([
          authFetch('/secretary/stats'),
          authFetch('/secretary/students?limit=5&offset=0'),
        ])
        if (statsRes.ok)    setStats(await statsRes.json())
        if (studentsRes.ok) setRecent((await studentsRes.json()).data ?? [])
      } catch (e) {
        console.error(e)
      } finally { setLoading(false) }
    }
    load()
  }, [authFetch])

  return (
    <>
      <PageMeta title="Início | Secretaria" description="Painel da secretaria" />
      <div className="space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Olá, {user?.full_name?.split(' ')[0]} 👋
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Painel da secretaria
          </p>
        </div>

        {/* Stats */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[1,2,3].map(i => <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatCard icon={<LuGraduationCap className="h-8 w-8" />}
              label="Total de Alunos" value={stats?.totalStudents ?? 0}
              color="border-l-brand-500" />
            <StatCard icon={<LuUserPlus className="h-8 w-8" />}
              label={`Novos em ${stats?.currentMonth ?? 'este mês'}`} value={stats?.newThisMonth ?? 0}
              sub="matrículas do mês atual" color="border-l-teal-500" />
          </div>
        )}

        {/* Alunos recentes */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
              <LuUsers className="h-4 w-4" /> Alunos Recentes
            </h2>
            <button onClick={() => navigate('/secretary/students')}
              className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
              Ver todos →
            </button>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />)}
            </div>
          ) : recent.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center dark:border-gray-700">
              <p className="text-sm text-gray-400">Nenhum aluno cadastrado ainda.</p>
              <button onClick={() => navigate('/secretary/students')}
                className="mt-2 text-sm font-medium text-brand-600 hover:text-brand-700">
                Cadastrar primeiro aluno →
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
              {recent.map(s => (
                <div key={s.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-white">{s.full_name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{s.email}</p>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {new Date(s.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Atalhos */}
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <LuCalendarDays className="h-4 w-4" /> Atalhos
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: 'Gerenciar Alunos', icon: <LuUsers className="h-5 w-5" />,       path: '/secretary/students' },
              { label: 'Turmas',           icon: <LuBookOpen className="h-5 w-5" />,     path: '/secretary/classes' },
              { label: 'Calendário',       icon: <LuCalendarDays className="h-5 w-5" />, path: '/calendar' },
            ].map(item => (
              <button key={item.path} onClick={() => navigate(item.path)}
                className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white p-4 text-sm font-medium text-gray-700 hover:border-brand-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-brand-700 transition">
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
