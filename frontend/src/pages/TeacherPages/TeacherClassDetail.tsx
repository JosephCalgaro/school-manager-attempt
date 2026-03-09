import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { LuClock3, LuDoorOpen, LuArrowLeft } from 'react-icons/lu'
import { useNavigate } from 'react-router'
import { useAuth } from '../../hooks/useAuth'

type AssignmentFile = {
  id: number
  originalName: string
  url: string
}

type Assignment = {
  id: number
  title: string
  type: string | null
  dueDate: string
  description: string | null
  maxScore: number | null
  files?: AssignmentFile[]
  completion: {
    byStudent: Record<number, boolean>
    completedCount: number
    totalStudents: number
    allCompleted: boolean
    pendingCount: number
  }
}

type Student = {
  id: number
  fullName: string
  email: string | null
  attendanceRate: number
  note1: number | null
  note2: number | null
  note3: number | null
  average: number | null
}

type LessonPlan = {
  id: number
  class_id: number
  title: string
  description: string | null
  planned_date: string
  status: 'PLANNED' | 'DONE' | 'CANCELLED'
  completion_notes: string | null
  created_at: string
}

type ClassDetail = {
  id: number
  name: string
  schedule: string | null
  classroom: string | null
  totalStudents: number
  attendanceRate: number
  students: Student[]
  assignments: Assignment[]
}

type TabKey = 'students' | 'attendance' | 'assignments' | 'grades' | 'lesson-plans'

const TAB_ITEMS: Array<{ key: TabKey; label: string }> = [
  { key: 'students',     label: 'Alunos' },
  { key: 'attendance',   label: 'Presença' },
  { key: 'assignments',  label: 'Atividades' },
  { key: 'grades',       label: 'Notas' },
  { key: 'lesson-plans', label: 'Planejamento' },
]

type UploadPayload = {
  name: string
  mimeType: string
  contentBase64: string
}

const inputCls =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30'

async function fileToPayload(file: File): Promise<UploadPayload> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const content = result.includes(',') ? result.split(',')[1] : result
      resolve(content)
    }
    reader.onerror = () => reject(new Error(`Falha ao ler arquivo ${file.name}`))
    reader.readAsDataURL(file)
  })
  return { name: file.name, mimeType: file.type || 'application/octet-stream', contentBase64: base64 }
}

type TeacherClassDetailProps = {
  apiBase?: string
}

export default function TeacherClassDetail({ apiBase = '/teacher' }: TeacherClassDetailProps) {
  const { id } = useParams()
  const classId = Number(id)
  const { authFetch } = useAuth()
  const navigate = useNavigate()

  const [tab, setTab] = useState<TabKey>('students')
  const [data, setData] = useState<ClassDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10))
  const [attendanceMap, setAttendanceMap] = useState<Record<number, boolean>>({})
  const [savingAttendance, setSavingAttendance] = useState(false)

  const [newAssignment, setNewAssignment] = useState({
    title: '',
    dueDate: new Date().toISOString().slice(0, 10),
    type: 'WORK',
    maxScore: '',
    description: ''
  })
  const [newAssignmentFiles, setNewAssignmentFiles] = useState<File[]>([])
  const [savingAssignment, setSavingAssignment] = useState(false)

  const [editingAssignmentId, setEditingAssignmentId] = useState<number | null>(null)
  const [editAssignment, setEditAssignment] = useState({
    title: '',
    dueDate: '',
    type: 'WORK',
    maxScore: '',
    description: ''
  })
  const [editAssignmentFiles, setEditAssignmentFiles] = useState<File[]>([])
  const [savingAssignmentEdit, setSavingAssignmentEdit] = useState(false)
  const [deletingAssignmentId, setDeletingAssignmentId] = useState<number | null>(null)

  const [completionDrafts, setCompletionDrafts] = useState<Record<number, Record<number, boolean>>>({})
  const [savingCompletionByAssignment, setSavingCompletionByAssignment] = useState<Record<number, boolean>>({})

  const [noteDrafts, setNoteDrafts] = useState<Record<number, { note1: string; note2: string; note3: string }>>({})
  const [savingNotes, setSavingNotes] = useState(false)

  // ── Lesson plans ─────────────────────────────────────────────────────────────
  const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([])
  const [templates, setTemplates] = useState<{ id: number; title: string; description: string | null }[]>([])
  const [loadingPlans, setLoadingPlans] = useState(false)
  const [linkTemplateId, setLinkTemplateId] = useState<string>('')
  const [linkDate, setLinkDate] = useState(new Date().toISOString().slice(0, 10))
  const [savingLink, setSavingLink] = useState(false)
  const [doneModal, setDoneModal] = useState<LessonPlan | null>(null)
  const [doneNotes, setDoneNotes] = useState('')
  const [savingDone, setSavingDone] = useState(false)

  const loadClassDetail = async () => {
    if (!Number.isInteger(classId)) {
      setError('Turma inválida')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const response = await authFetch(`${apiBase}/classes/${classId}`)
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body?.error || 'Não foi possível carregar os detalhes da turma')
      }
      const payload: ClassDetail = await response.json()
      setData(payload)

      const attendanceInitial: Record<number, boolean> = {}
      payload.students.forEach((student) => { attendanceInitial[student.id] = true })
      setAttendanceMap(attendanceInitial)

      const completionInitial: Record<number, Record<number, boolean>> = {}
      payload.assignments.forEach((assignment) => {
        const perStudent: Record<number, boolean> = {}
        payload.students.forEach((student) => {
          perStudent[student.id] = Boolean(assignment.completion?.byStudent?.[student.id])
        })
        completionInitial[assignment.id] = perStudent
      })
      setCompletionDrafts(completionInitial)

      const notesInitial: Record<number, { note1: string; note2: string; note3: string }> = {}
      payload.students.forEach((student) => {
        notesInitial[student.id] = {
          note1: student.note1 === null ? '' : String(student.note1),
          note2: student.note2 === null ? '' : String(student.note2),
          note3: student.note3 === null ? '' : String(student.note3)
        }
      })
      setNoteDrafts(notesInitial)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar turma')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadClassDetail()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId])

  const loadLessonPlans = async () => {
    if (!Number.isInteger(classId)) return
    try {
      setLoadingPlans(true)
      const [plansRes, templatesRes] = await Promise.all([
        authFetch(`${apiBase}/classes/${classId}/lesson-plans`),
        authFetch(`${apiBase}/lesson-plans`),
      ])
      if (plansRes.ok)     setLessonPlans(await plansRes.json())
      if (templatesRes.ok) setTemplates(await templatesRes.json())
    } catch { /* silent */ }
    finally { setLoadingPlans(false) }
  }

  useEffect(() => {
    if (tab === 'lesson-plans') loadLessonPlans()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, classId])

  const studentList = useMemo(() => data?.students ?? [], [data])
  const assignmentList = useMemo(() => data?.assignments ?? [], [data])

  const openEditAssignment = (assignment: Assignment) => {
    setEditingAssignmentId(assignment.id)
    setEditAssignment({
      title: assignment.title,
      dueDate: assignment.dueDate?.slice(0, 10),
      type: assignment.type || 'WORK',
      maxScore: assignment.maxScore === null ? '' : String(assignment.maxScore),
      description: assignment.description || ''
    })
    setEditAssignmentFiles([])
  }

  const handleSaveAttendance = async () => {
    if (!data) return
    try {
      setSavingAttendance(true)
      setMessage(null)
      setError(null)
      const records = data.students.map((student) => ({
        studentId: student.id,
        present: Boolean(attendanceMap[student.id]),
        date: attendanceDate
      }))
      const response = await authFetch(`${apiBase}/classes/${data.id}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records })
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body?.error || 'Erro ao salvar presença')
      }
      setMessage('Presença registrada com sucesso.')
      await loadClassDetail()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar presença')
    } finally {
      setSavingAttendance(false)
    }
  }

  const handleCreateAssignment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!data) return
    try {
      setSavingAssignment(true)
      setMessage(null)
      setError(null)
      const files = await Promise.all(newAssignmentFiles.map(fileToPayload))

      const response = await authFetch(`${apiBase}/classes/${data.id}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newAssignment.title,
          dueDate: newAssignment.dueDate,
          type: newAssignment.type,
          maxScore: newAssignment.maxScore === '' ? null : Number(newAssignment.maxScore),
          description: newAssignment.description || null,
          files
        })
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body?.error || 'Erro ao criar atividade')
      }
      setMessage('Atividade criada com sucesso.')
      setNewAssignment({ title: '', dueDate: new Date().toISOString().slice(0, 10), type: 'WORK', maxScore: '', description: '' })
      setNewAssignmentFiles([])
      await loadClassDetail()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar atividade')
    } finally {
      setSavingAssignment(false)
    }
  }

  const handleUpdateAssignment = async () => {
    if (!data || !editingAssignmentId) return
    try {
      setSavingAssignmentEdit(true)
      setMessage(null)
      setError(null)
      const files = await Promise.all(editAssignmentFiles.map(fileToPayload))
      const response = await authFetch(`${apiBase}/classes/${data.id}/assignments/${editingAssignmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editAssignment.title,
          dueDate: editAssignment.dueDate,
          type: editAssignment.type,
          maxScore: editAssignment.maxScore === '' ? null : Number(editAssignment.maxScore),
          description: editAssignment.description || null,
          files
        })
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body?.error || 'Erro ao editar atividade')
      }
      setMessage('Atividade atualizada com sucesso.')
      setEditingAssignmentId(null)
      setEditAssignmentFiles([])
      await loadClassDetail()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao editar atividade')
    } finally {
      setSavingAssignmentEdit(false)
    }
  }

  const handleDeleteAssignment = async (assignmentId: number) => {
    if (!data) return
    const confirmed = window.confirm('Deseja realmente deletar esta atividade?')
    if (!confirmed) return
    try {
      setDeletingAssignmentId(assignmentId)
      setMessage(null)
      setError(null)
      const response = await authFetch(`${apiBase}/classes/${data.id}/assignments/${assignmentId}`, { method: 'DELETE' })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body?.error || 'Erro ao deletar atividade')
      }
      setMessage('Atividade deletada com sucesso.')
      await loadClassDetail()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao deletar atividade')
    } finally {
      setDeletingAssignmentId(null)
    }
  }

  const handleSaveCompletion = async (assignmentId: number) => {
    if (!data) return
    try {
      setSavingCompletionByAssignment((prev) => ({ ...prev, [assignmentId]: true }))
      setMessage(null)
      setError(null)
      const perStudent = completionDrafts[assignmentId] || {}
      const records = studentList.map((student) => ({
        studentId: student.id,
        completed: Boolean(perStudent[student.id])
      }))

      const response = await authFetch(`${apiBase}/classes/${data.id}/assignments/${assignmentId}/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records })
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body?.error || 'Erro ao salvar realização')
      }
      setMessage('Realização da atividade atualizada.')
      await loadClassDetail()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar realização')
    } finally {
      setSavingCompletionByAssignment((prev) => ({ ...prev, [assignmentId]: false }))
    }
  }

  const handleSaveNotes = async () => {
    if (!data) return
    try {
      setSavingNotes(true)
      setMessage(null)
      setError(null)
      for (const student of studentList) {
        const draft = noteDrafts[student.id] || { note1: '', note2: '', note3: '' }
        const response = await authFetch(`${apiBase}/classes/${data.id}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: student.id,
            note1: draft.note1 === '' ? null : Number(draft.note1),
            note2: draft.note2 === '' ? null : Number(draft.note2),
            note3: draft.note3 === '' ? null : Number(draft.note3)
          })
        })
        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          throw new Error(body?.error || 'Erro ao salvar notas')
        }
      }
      setMessage('Notas atualizadas com sucesso.')
      await loadClassDetail()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar notas')
    } finally {
      setSavingNotes(false)
    }
  }

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><p className="text-sm text-gray-600 dark:text-gray-400">Carregando turma...</p></div>

  const handleLinkPlan = async () => {
    if (!linkTemplateId) return setError('Selecione um plano de aula')
    setSavingLink(true); setMessage(null); setError(null)
    try {
      const res = await authFetch(`${apiBase}/classes/${classId}/lesson-plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: Number(linkTemplateId), planned_date: linkDate }),
      })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.error || 'Erro ao vincular') }
      setLinkTemplateId(''); setLinkDate(new Date().toISOString().slice(0, 10))
      setMessage('Plano vinculado à turma.')
      await loadLessonPlans()
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro') }
    finally { setSavingLink(false) }
  }

  const handleMarkDone = async () => {
    if (!doneModal) return
    setSavingDone(true); setMessage(null); setError(null)
    try {
      const res = await authFetch(`${apiBase}/classes/${classId}/lesson-plans/${doneModal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DONE', completion_notes: doneNotes || null }),
      })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.error || 'Erro') }
      setDoneModal(null); setDoneNotes('')
      setMessage('Aula marcada como concluída.')
      await loadLessonPlans()
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro') }
    finally { setSavingDone(false) }
  }

  const handleRevertPlan = async (plan: LessonPlan) => {
    try {
      const res = await authFetch(`${apiBase}/classes/${classId}/lesson-plans/${plan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PLANNED', completion_notes: null }),
      })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.error || 'Erro') }
      setMessage('Plano reaberto.')
      await loadLessonPlans()
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro') }
  }

  const handleUnlinkPlan = async (planId: number) => {
    if (!window.confirm('Desvincular este plano da turma?')) return
    try {
      const res = await authFetch(`${apiBase}/classes/${classId}/lesson-plans/${planId}`, { method: 'DELETE' })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.error || 'Erro') }
      setMessage('Plano desvinculado.')
      await loadLessonPlans()
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro') }
  }

  if (error && !data) return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">{error}</div>
  if (!data) return null

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <button onClick={() => navigate(-1)} className="mb-3 flex items-center gap-1.5 text-xs text-gray-500 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400 transition-colors">
          <LuArrowLeft className="h-3.5 w-3.5" /> Voltar
        </button>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{data.name}</h1>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1.5">
            <LuClock3 className="h-3.5 w-3.5" /> {data.schedule || 'Horário não informado'}
          </span>
          {data.classroom && (
            <span className="flex items-center gap-1.5">
              <LuDoorOpen className="h-3.5 w-3.5" /> {data.classroom}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
            {data.totalStudents} aluno{data.totalStudents !== 1 ? 's' : ''} · {data.attendanceRate.toFixed(1)}% presença
          </span>
        </div>
      </header>

      <div className="flex flex-wrap gap-1 rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-800 dark:bg-gray-900">
        {TAB_ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === item.key
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {message && <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">{message}</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">{error}</div>}

      {tab === 'students' && (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <table className="min-w-full text-sm">
            <thead className="border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Aluno</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Email</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Frequência</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Média</th>
              </tr>
            </thead>
            <tbody>
              {studentList.map((student) => (
                <tr key={student.id} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                  <td className="px-4 py-3 text-gray-900 dark:text-white">{student.fullName}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{student.email || '-'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{student.attendanceRate.toFixed(1)}%</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{student.average ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'attendance' && (
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="attendance-date">Data da chamada</label>
            <input id="attendance-date" type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-2">
            {studentList.map((student) => (
              <label key={student.id} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-800">
                <span className="text-gray-800 dark:text-gray-200">{student.fullName}</span>
                <span className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={Boolean(attendanceMap[student.id])} onChange={(e) => setAttendanceMap((prev) => ({ ...prev, [student.id]: e.target.checked }))} />
                  <span className="text-gray-600 dark:text-gray-400">Presente</span>
                </span>
              </label>
            ))}
          </div>
          <button onClick={handleSaveAttendance} disabled={savingAttendance} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
            {savingAttendance ? 'Salvando...' : 'Salvar presença'}
          </button>
        </div>
      )}

      {tab === 'assignments' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Atividades da Turma</h2>
            {assignmentList.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">Nenhuma atividade cadastrada.</p>
            ) : (
              <ul className="space-y-4">
                {assignmentList.map((assignment) => (
                  <li key={assignment.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                    {editingAssignmentId === assignment.id ? (
                      <div className="space-y-2">
                        <input value={editAssignment.title} onChange={(e) => setEditAssignment((prev) => ({ ...prev, title: e.target.value }))} placeholder="Título" className={inputCls} />
                        <input type="date" value={editAssignment.dueDate} onChange={(e) => setEditAssignment((prev) => ({ ...prev, dueDate: e.target.value }))} className={inputCls} />
                        <select value={editAssignment.type} onChange={(e) => setEditAssignment((prev) => ({ ...prev, type: e.target.value }))} className={inputCls}>
                          <option value="WORK">WORK</option>
                          <option value="EXAM">EXAM</option>
                        </select>
                        <input type="number" min="0" value={editAssignment.maxScore} onChange={(e) => setEditAssignment((prev) => ({ ...prev, maxScore: e.target.value }))} placeholder="Nota máxima" className={inputCls} />
                        <textarea value={editAssignment.description} onChange={(e) => setEditAssignment((prev) => ({ ...prev, description: e.target.value }))} rows={3} placeholder="Descrição" className={inputCls} />
                        <input type="file" multiple onChange={(e) => setEditAssignmentFiles(Array.from(e.target.files || []))} className={inputCls} />
                        <div className="flex gap-2">
                          <button onClick={handleUpdateAssignment} disabled={savingAssignmentEdit} className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
                            {savingAssignmentEdit ? 'Salvando...' : 'Salvar edição'}
                          </button>
                          <button onClick={() => setEditingAssignmentId(null)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300">Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-blue-700 dark:text-blue-400">{assignment.title}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">Entrega: {new Date(assignment.dueDate).toLocaleDateString('pt-BR')}</p>
                          </div>
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            assignment.completion?.allCompleted
                              ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400'
                              : 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                          }`}>
                            {assignment.completion?.allCompleted ? 'Concluída por todos' : `${assignment.completion?.completedCount || 0}/${assignment.completion?.totalStudents || 0} concluíram`}
                          </span>
                        </div>

                        {assignment.description && <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{assignment.description}</p>}
                        {assignment.files && assignment.files.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {assignment.files.map((file) => (
                              <a key={file.id} href={file.url} target="_blank" rel="noreferrer" className="block text-xs text-blue-700 underline dark:text-blue-400">{file.originalName}</a>
                            ))}
                          </div>
                        )}

                        <div className="mt-3 space-y-2 rounded-lg border border-gray-200 p-2 dark:border-gray-700">
                          {studentList.map((student) => (
                            <label key={student.id} className="flex items-center justify-between text-sm">
                              <span className="text-gray-700 dark:text-gray-300">{student.fullName}</span>
                              <span className="inline-flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={Boolean(completionDrafts[assignment.id]?.[student.id])}
                                  onChange={(e) =>
                                    setCompletionDrafts((prev) => ({
                                      ...prev,
                                      [assignment.id]: {
                                        ...(prev[assignment.id] || {}),
                                        [student.id]: e.target.checked
                                      }
                                    }))
                                  }
                                />
                                <span className="text-gray-600 dark:text-gray-400">Realizou</span>
                              </span>
                            </label>
                          ))}
                          <button
                            onClick={() => handleSaveCompletion(assignment.id)}
                            disabled={Boolean(savingCompletionByAssignment[assignment.id])}
                            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
                          >
                            {savingCompletionByAssignment[assignment.id] ? 'Salvando...' : 'Salvar realização'}
                          </button>
                        </div>

                        <div className="mt-3 flex gap-2">
                          <button onClick={() => openEditAssignment(assignment)} className="rounded-md border border-brand-300 px-2 py-1 text-xs text-brand-700 hover:bg-brand-50 dark:border-brand-700 dark:text-brand-300">
                            Editar atividade
                          </button>
                          <button
                            onClick={() => handleDeleteAssignment(assignment.id)}
                            disabled={deletingAssignmentId === assignment.id}
                            className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-700 dark:text-red-300"
                          >
                            {deletingAssignmentId === assignment.id ? 'Deletando...' : 'Deletar atividade'}
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form onSubmit={handleCreateAssignment} className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Nova Atividade</h2>
            <input required value={newAssignment.title} onChange={(e) => setNewAssignment((prev) => ({ ...prev, title: e.target.value }))} placeholder="Título" className={inputCls} />
            <input required type="date" value={newAssignment.dueDate} onChange={(e) => setNewAssignment((prev) => ({ ...prev, dueDate: e.target.value }))} className={inputCls} />
            <select value={newAssignment.type} onChange={(e) => setNewAssignment((prev) => ({ ...prev, type: e.target.value }))} className={inputCls}>
              <option value="WORK">WORK</option>
              <option value="EXAM">EXAM</option>
            </select>
            <input type="number" min="0" value={newAssignment.maxScore} onChange={(e) => setNewAssignment((prev) => ({ ...prev, maxScore: e.target.value }))} placeholder="Nota máxima (opcional)" className={inputCls} />
            <textarea value={newAssignment.description} onChange={(e) => setNewAssignment((prev) => ({ ...prev, description: e.target.value }))} placeholder="Descrição (opcional)" rows={4} className={inputCls} />
            <input type="file" multiple onChange={(e) => setNewAssignmentFiles(Array.from(e.target.files || []))} className={inputCls} />
            <button type="submit" disabled={savingAssignment} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
              {savingAssignment ? 'Salvando...' : 'Criar atividade'}
            </button>
          </form>
        </div>
      )}

      {tab === 'grades' && (
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Aluno</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Nota 1</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Nota 2</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Nota 3</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Média</th>
                </tr>
              </thead>
              <tbody>
                {studentList.map((student) => (
                  <tr key={student.id} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                    <td className="px-3 py-2 text-gray-900 dark:text-white">{student.fullName}</td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" max="10" value={noteDrafts[student.id]?.note1 ?? ''} onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [student.id]: { ...(prev[student.id] || { note1: '', note2: '', note3: '' }), note1: e.target.value } }))} className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-800 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" max="10" value={noteDrafts[student.id]?.note2 ?? ''} onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [student.id]: { ...(prev[student.id] || { note1: '', note2: '', note3: '' }), note2: e.target.value } }))} className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-800 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" max="10" value={noteDrafts[student.id]?.note3 ?? ''} onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [student.id]: { ...(prev[student.id] || { note1: '', note2: '', note3: '' }), note3: e.target.value } }))} className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-800 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{student.average ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={handleSaveNotes} disabled={savingNotes} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
            {savingNotes ? 'Salvando...' : 'Salvar notas'}
          </button>
        </div>
      )}

      {tab === 'lesson-plans' && (() => {
        const done  = lessonPlans.filter(p => p.status === 'DONE').length
        const total = lessonPlans.length
        const pct   = total > 0 ? Math.round((done / total) * 100) : 0
        const fmtDate = (d: string) =>
          new Date(d.slice(0, 10) + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
        const statusColor = (s: LessonPlan['status']) =>
          s === 'DONE'      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
          s === 'CANCELLED' ? 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' :
                              'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
        const statusLabel = (s: LessonPlan['status']) =>
          s === 'DONE' ? 'Concluída' : s === 'CANCELLED' ? 'Cancelada' : 'Planejada'

        return (
          <div className="space-y-6">
            {/* Barra de progresso */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Progresso do Planejamento</h2>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{done}/{total} aulas concluídas</span>
              </div>
              <div className="h-3 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div className="h-3 rounded-full bg-brand-500 transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-right text-xs text-gray-500 dark:text-gray-400">{pct}% concluído</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Lista de planos vinculados */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 space-y-3">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Aulas desta Turma</h2>
                {loadingPlans ? (
                  <div className="flex justify-center py-6"><div className="h-6 w-6 animate-spin rounded-full border-b-2 border-brand-500" /></div>
                ) : lessonPlans.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum plano vinculado ainda. Use o painel ao lado para vincular.</p>
                ) : lessonPlans.map(plan => (
                  <div key={plan.id} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{plan.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{fmtDate(plan.planned_date)}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(plan.status)}`}>{statusLabel(plan.status)}</span>
                    </div>
                    {plan.description && <p className="text-sm text-gray-600 dark:text-gray-400">{plan.description}</p>}
                    {plan.completion_notes && (
                      <div className="rounded-lg bg-green-50 dark:bg-green-950/30 px-3 py-2 text-xs text-green-700 dark:text-green-400">
                        <span className="font-medium">O que foi feito: </span>{plan.completion_notes}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {plan.status === 'PLANNED' && (
                        <button onClick={() => { setDoneModal(plan); setDoneNotes('') }}
                          className="rounded-md bg-green-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-600">
                          ✓ Marcar como feita
                        </button>
                      )}
                      {plan.status === 'DONE' && (
                        <button onClick={() => handleRevertPlan(plan)}
                          className="rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300">
                          Reabrir
                        </button>
                      )}
                      <button onClick={() => handleUnlinkPlan(plan.id)}
                        className="rounded-md border border-red-300 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400">
                        Desvincular
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Vincular plano da biblioteca */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">Vincular Plano</h2>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    Selecione um plano da sua biblioteca e defina a data desta aula nesta turma.
                  </p>
                </div>
                {templates.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Você ainda não tem planos criados.{' '}
                    <a href="/teacher/lesson-plans" className="text-brand-600 underline dark:text-brand-400">Criar planos de aula →</a>
                  </p>
                ) : (
                  <>
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Plano de aula *</label>
                      <select value={linkTemplateId} onChange={e => setLinkTemplateId(e.target.value)}
                        className={`mt-1 ${inputCls}`}>
                        <option value="">Selecione um plano...</option>
                        {templates.map(t => (
                          <option key={t.id} value={t.id}>{t.title}</option>
                        ))}
                      </select>
                      {linkTemplateId && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                          {templates.find(t => t.id === Number(linkTemplateId))?.description}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Data da aula *</label>
                      <input type="date" value={linkDate} onChange={e => setLinkDate(e.target.value)}
                        className={`mt-1 ${inputCls}`} />
                    </div>
                    <button onClick={handleLinkPlan} disabled={savingLink}
                      className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
                      {savingLink ? 'Vinculando...' : 'Vincular à turma'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal — marcar aula como concluída */}
      {doneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Concluir: {doneModal.title}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Descreva o que foi efetivamente feito em aula (opcional).</p>
            <textarea value={doneNotes} onChange={e => setDoneNotes(e.target.value)}
              rows={4} placeholder="Ex: Foram explicados conceitos de equações do 1º grau e exercícios práticos..."
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setDoneModal(null); setDoneNotes('') }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300">
                Cancelar
              </button>
              <button onClick={handleMarkDone} disabled={savingDone}
                className="rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-60">
                {savingDone ? 'Salvando...' : 'Confirmar conclusão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

}
