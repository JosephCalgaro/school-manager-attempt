import { useCallback, useEffect, useState } from 'react'
import { LuSearch, LuUsers, LuBookOpen } from 'react-icons/lu'
import { useAuth } from '../../hooks/useAuth'

type StudentRow = {
  id: number
  full_name: string
  email: string
  phone: string | null
  class_id: number
  class_name: string
}

export default function TeacherStudents() {
  const { authFetch } = useAuth()
  const [students, setStudents] = useState<StudentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('')

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true)
      const res = await authFetch('/teacher/students')
      if (!res.ok) throw new Error('Erro ao buscar alunos')
      setStudents(await res.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [authFetch])

  useEffect(() => { fetchStudents() }, [fetchStudents])

  const classNames = [...new Set(students.map((s) => s.class_name))].sort()

  const filtered = students.filter((s) => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      s.full_name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q)
    const matchClass = !classFilter || s.class_name === classFilter
    return matchSearch && matchClass
  })

  // Group by student id to show all classes per student
  const grouped = filtered.reduce<Record<number, StudentRow & { classes: string[] }>>((acc, s) => {
    if (!acc[s.id]) {
      acc[s.id] = { ...s, classes: [s.class_name] }
    } else {
      acc[s.id].classes.push(s.class_name)
    }
    return acc
  }, {})

  const rows = Object.values(grouped)
  const uniqueStudents = [...new Set(students.map((s) => s.id))].length

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Meus Alunos</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {uniqueStudents} aluno{uniqueStudents !== 1 ? 's' : ''} vinculado{uniqueStudents !== 1 ? 's' : ''} às suas turmas
        </p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="relative">
          <LuSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou email..."
            className="h-11 w-full rounded-xl border border-gray-300 bg-white pl-10 pr-4 text-sm outline-none focus:ring-2 ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="h-11 rounded-xl border border-gray-300 bg-white px-4 text-sm outline-none focus:ring-2 ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        >
          <option value="">Todas as turmas</option>
          {classNames.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex justify-center p-10">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand-500" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <LuUsers className="h-8 w-8 text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum aluno encontrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-gray-300">Nome</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-gray-300">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-gray-300">Telefone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-gray-300">Turmas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {rows.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{s.full_name}</td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{s.email}</td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{s.phone || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {s.classes.map((c) => (
                          <span
                            key={c}
                            className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                          >
                            <LuBookOpen className="h-3 w-3" />
                            {c}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
