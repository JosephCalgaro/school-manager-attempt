import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { LuBookOpen, LuClock3, LuSearch, LuUsers } from 'react-icons/lu'
import { useAuth } from '../../hooks/useAuth'

type TeacherClass = {
  id: number
  name: string
  schedule: string | null
  totalStudents: number
}

type TeacherDashboardProps = {
  apiBase?: string
  detailBasePath?: string
  allowedRoles?: string[]
  title?: string
}

export default function TeacherDashboard({
  apiBase = '/teacher',
  detailBasePath = '/teacher/classes',
  allowedRoles = ['TEACHER'],
  title = 'Minhas Turmas'
}: TeacherDashboardProps) {
  const { user, authFetch } = useAuth()
  const navigate = useNavigate()

  const [classes, setClasses] = useState<TeacherClass[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const role = user?.role?.toUpperCase()
    if (user && (!role || !allowedRoles.includes(role))) {
      navigate('/')
      return
    }
    if (!user) return

    const fetchClasses = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await authFetch(`${apiBase}/classes`)
        if (!response.ok) throw new Error('Não foi possível carregar as turmas')
        const data = await response.json()
        setClasses(Array.isArray(data) ? data : [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar turmas')
      } finally {
        setLoading(false)
      }
    }

    fetchClasses()
  }, [allowedRoles, apiBase, authFetch, navigate, user])

  const filteredClasses = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    if (!normalized) return classes
    return classes.filter((cls) => cls.name.toLowerCase().includes(normalized))
  }, [classes, search])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">Carregando turmas...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{title}</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Selecione uma turma para gerenciar alunos, presença, atividades e notas.
        </p>
      </div>

      <div className="relative">
        <LuSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar turma por nome..."
          className="h-11 w-full rounded-xl border border-gray-300 bg-white pl-10 pr-4 text-sm text-blue-700 outline-none ring-brand-500 placeholder:text-blue-400 focus:ring-2 dark:border-gray-700 dark:bg-gray-900 dark:text-blue-400 dark:placeholder:text-blue-500"
        />
      </div>

      {filteredClasses.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
          Nenhuma turma encontrada.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredClasses.map((cls) => (
            <button
              key={cls.id}
              onClick={() => navigate(`${detailBasePath}/${cls.id}`)}
              className="group rounded-2xl border border-gray-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand-700"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                  <LuBookOpen className="h-3.5 w-3.5" />
                  Turma
                </span>
              </div>

              <h2 className="text-lg font-semibold text-gray-900 group-hover:text-brand-700 dark:text-white dark:group-hover:text-brand-300">
                {cls.name}
              </h2>

              <div className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <p className="flex items-center gap-2">
                  <LuClock3 className="h-4 w-4" />
                  {cls.schedule || 'Horário não informado'}
                </p>
                <p className="flex items-center gap-2">
                  <LuUsers className="h-4 w-4" />
                  {cls.totalStudents} alunos
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
