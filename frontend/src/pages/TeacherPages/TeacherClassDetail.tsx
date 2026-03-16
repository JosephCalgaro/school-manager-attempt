import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { LuClock3, LuDoorOpen, LuArrowLeft, LuChevronDown, LuChevronUp, LuUpload, LuX, LuFileText } from 'react-icons/lu'
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
  due_date: string
  description: string | null
  max_score: number | null
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
  full_name: string
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
  // new flexible sections
  custom_sections: string | null
  // legacy columns (kept for backward compat)
  warm_up: string | null
  ice_breaker: string | null
  development: string | null
  language_awareness: string | null
  closure: string | null
  planned_date: string
  status: 'PLANNED' | 'DONE' | 'CANCELLED'
  completion_notes: string | null
  created_at: string
}

type PlanSection = { id: string; label: string; topics: string[] }

function parsePlanSections(plan: LessonPlan | Record<string, unknown>): PlanSection[] {
  // Try custom_sections first
  const raw = (plan as Record<string, unknown>).custom_sections as string | null
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length)
        return parsed.map((s, i) => ({ id: String(i), label: s.label ?? '', topics: Array.isArray(s.topics) ? s.topics.filter(Boolean) : [] }))
    } catch { /* fall through */ }
  }
  // Legacy columns
  const legacy: [string | null, string][] = [
    [(plan as Record<string, unknown>).warm_up as string | null,            'Warm Up'],
    [(plan as Record<string, unknown>).ice_breaker as string | null,        'Ice Breaker'],
    [(plan as Record<string, unknown>).development as string | null,        'Development'],
    [(plan as Record<string, unknown>).language_awareness as string | null, 'Language Awareness'],
    [(plan as Record<string, unknown>).closure as string | null,            'Closure'],
  ]
  return legacy.flatMap(([r, label], i) => {
    if (!r) return []
    let topics: string[] = []
    try { const p = JSON.parse(r); topics = Array.isArray(p) ? p.filter(Boolean) : [String(p)] }
    catch { topics = [r] }
    return topics.length ? [{ id: String(i), label, topics }] : []
  })
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

// ─── FileDropZone ─────────────────────────────────────────────────────────────
function FileDropZone({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return
    const next = [...files]
    Array.from(incoming).forEach(f => { if (!next.find(x => x.name === f.name && x.size === f.size)) next.push(f) })
    onChange(next)
  }

  return (
    <div className="space-y-2">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 transition-colors ${
          dragging
            ? 'border-brand-400 bg-brand-50 dark:border-brand-600 dark:bg-brand-950/20'
            : 'border-gray-200 bg-gray-50 hover:border-brand-300 hover:bg-brand-50/40 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-brand-700'
        }`}
      >
        <LuUpload className={`h-5 w-5 ${dragging ? 'text-brand-500' : 'text-gray-400 dark:text-gray-500'}`} />
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          <span className="font-medium text-brand-600 dark:text-brand-400">Clique para selecionar</span>
          {' '}ou arraste arquivos aqui
        </p>
        <input ref={inputRef} type="file" multiple className="hidden"
          onChange={e => addFiles(e.target.files)} />
      </div>
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 px-3 py-1.5">
              <span className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 min-w-0">
                <LuFileText className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                <span className="truncate">{f.name}</span>
                <span className="shrink-0 text-gray-400">({(f.size / 1024).toFixed(0)} KB)</span>
              </span>
              <button type="button" onClick={() => onChange(files.filter((_, j) => j !== i))}
                className="ml-2 shrink-0 rounded p-0.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30 dark:hover:text-red-400">
                <LuX className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

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

// ─── Plan Instance Card ───────────────────────────────────────────────────────

const COLORS = ['amber','blue','violet','emerald','rose','orange','cyan','pink'] as const
type PlanColor = typeof COLORS[number]
const colorAt = (i: number): PlanColor => COLORS[i % COLORS.length]

const COLOR_CHIP: Record<PlanColor, string> = {
  amber:   'border-amber-200   bg-amber-50   text-amber-700   dark:bg-amber-950/30  dark:border-amber-700  dark:text-amber-400',
  blue:    'border-blue-200    bg-blue-50    text-blue-700    dark:bg-blue-950/30   dark:border-blue-700   dark:text-blue-400',
  violet:  'border-violet-200  bg-violet-50  text-violet-700  dark:bg-violet-950/30 dark:border-violet-700 dark:text-violet-400',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-700 dark:text-emerald-400',
  rose:    'border-rose-200    bg-rose-50    text-rose-700    dark:bg-rose-950/30   dark:border-rose-700   dark:text-rose-400',
  orange:  'border-orange-200  bg-orange-50  text-orange-700  dark:bg-orange-950/30 dark:border-orange-700 dark:text-orange-400',
  cyan:    'border-cyan-200    bg-cyan-50    text-cyan-700    dark:bg-cyan-950/30   dark:border-cyan-700   dark:text-cyan-400',
  pink:    'border-pink-200    bg-pink-50    text-pink-700    dark:bg-pink-950/30   dark:border-pink-700   dark:text-pink-400',
}
const COLOR_BLOCK: Record<PlanColor, string> = {
  amber:   'bg-amber-50   border-amber-200   dark:bg-amber-950/20  dark:border-amber-800',
  blue:    'bg-blue-50    border-blue-200    dark:bg-blue-950/20   dark:border-blue-800',
  violet:  'bg-violet-50  border-violet-200  dark:bg-violet-950/20 dark:border-violet-800',
  emerald: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800',
  rose:    'bg-rose-50    border-rose-200    dark:bg-rose-950/20   dark:border-rose-800',
  orange:  'bg-orange-50  border-orange-200  dark:bg-orange-950/20 dark:border-orange-800',
  cyan:    'bg-cyan-50    border-cyan-200    dark:bg-cyan-950/20   dark:border-cyan-800',
  pink:    'bg-pink-50    border-pink-200    dark:bg-pink-950/20   dark:border-pink-800',
}
const BULLET: Record<PlanColor, string> = {
  amber:'bg-amber-400', blue:'bg-blue-400', violet:'bg-violet-400',
  emerald:'bg-emerald-400', rose:'bg-rose-400', orange:'bg-orange-400',
  cyan:'bg-cyan-400', pink:'bg-pink-400',
}

function PlanInstanceCard({
  plan, fmtDate, onMarkDone, onRevert, onUnlink,
}: {
  plan: LessonPlan
  fmtDate: (d: string) => string
  onMarkDone: (p: LessonPlan) => void
  onRevert: (p: LessonPlan) => void
  onUnlink: (id: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const sections = parsePlanSections(plan)
  const filledSections = sections.filter(s => s.topics.length > 0)

  const statusCls =
    plan.status === 'DONE'      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
    plan.status === 'CANCELLED' ? 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' :
                                  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
  const statusLabel =
    plan.status === 'DONE' ? '✓ Concluída' :
    plan.status === 'CANCELLED' ? 'Cancelada' : '⏰ Planejada'

  return (
    <div className={`rounded-2xl border overflow-hidden transition-shadow hover:shadow-md ${
      plan.status === 'DONE'
        ? 'border-green-200 bg-green-50/40 dark:border-green-900 dark:bg-green-950/10'
        : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'
    }`}>
      <div className="p-4 space-y-3">
        {/* Title + date + status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">{plan.title}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{fmtDate(plan.planned_date)}</p>
            {plan.description && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 italic">{plan.description}</p>
            )}
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCls}`}>
            {statusLabel}
          </span>
        </div>

        {/* Section chips */}
        {filledSections.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {filledSections.map((s, i) => (
              <span key={s.id} className={`rounded-full border px-2 py-0.5 text-xs font-medium ${COLOR_CHIP[colorAt(i)]}`}>
                {s.label} <span className="opacity-60">·{s.topics.length}</span>
              </span>
            ))}
            <button onClick={() => setExpanded(v => !v)}
              className="ml-auto flex items-center gap-1 text-xs text-gray-500 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400 transition-colors">
              {expanded ? <LuChevronUp className="h-3.5 w-3.5" /> : <LuChevronDown className="h-3.5 w-3.5" />}
              {expanded ? 'Ocultar' : 'Ver conteúdo'}
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500 italic">Sem seções definidas</p>
        )}

        {/* Completion notes */}
        {plan.completion_notes && (
          <div className="rounded-lg bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-800 px-3 py-2 text-xs text-green-700 dark:text-green-400">
            <span className="font-semibold">Realizado: </span>{plan.completion_notes}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
          {plan.status === 'PLANNED' && (
            <button onClick={() => onMarkDone(plan)}
              className="rounded-lg bg-green-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600 transition-colors">
              ✓ Marcar como feita
            </button>
          )}
          {plan.status === 'DONE' && (
            <button onClick={() => onRevert(plan)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors">
              ↩ Reabrir
            </button>
          )}
          <button onClick={() => onUnlink(plan.id)}
            className="ml-auto rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30 transition-colors">
            Desvincular
          </button>
        </div>
      </div>

      {/* Expanded section content */}
      {expanded && filledSections.length > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
          {filledSections.map((s, i) => {
            const color = colorAt(i)
            return (
              <div key={s.id} className={`px-4 py-3 ${COLOR_BLOCK[color]} border-0`}>
                <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold mb-2.5 ${COLOR_CHIP[color]}`}>
                  {s.label}
                </span>
                <ul className="space-y-1.5">
                  {s.topics.map((t, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <span className={`mt-2 h-1.5 w-1.5 rounded-full shrink-0 ${BULLET[color]}`} />
                      <span className="leading-relaxed">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
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
  const [templates, setTemplates] = useState<{ id: number; title: string; description: string | null; custom_sections: string | null; warm_up: string | null; ice_breaker: string | null; development: string | null; language_awareness: string | null; closure: string | null }[]>([])
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
      dueDate: assignment.due_date?.slice(0, 10),
      type: assignment.type || 'WORK',
      maxScore: assignment.max_score === null ? '' : String(assignment.max_score),
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
                  <td className="px-4 py-3 text-gray-900 dark:text-white">{student.full_name}</td>
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
                <span className="text-gray-800 dark:text-gray-200">{student.full_name}</span>
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
                        <FileDropZone files={editAssignmentFiles} onChange={setEditAssignmentFiles} />
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
                <p className="text-xs text-gray-600 dark:text-gray-400">Entrega: {new Date(assignment.due_date).toLocaleDateString('pt-BR')}</p>
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
                              <span className="text-gray-700 dark:text-gray-300">{student.full_name}</span>
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
            <FileDropZone files={newAssignmentFiles} onChange={setNewAssignmentFiles} />
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
                    <td className="px-3 py-2 text-gray-900 dark:text-white">{student.full_name}</td>
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
        const planned   = lessonPlans.filter(p => p.status === 'PLANNED')
        const done      = lessonPlans.filter(p => p.status === 'DONE')
        const total     = lessonPlans.length
        const pct       = total > 0 ? Math.round((done.length / total) * 100) : 0
        const fmtDate   = (d: string) =>
          new Date(d.slice(0, 10) + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })

        return (
          <div className="space-y-5">

            {/* ── Progress header */}
            <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Progresso do Planejamento</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {done.length} de {total} aula{total !== 1 ? 's' : ''} concluída{done.length !== 1 ? 's' : ''}
                    {planned.length > 0 && ` · ${planned.length} pendente${planned.length !== 1 ? 's' : ''}`}
                  </p>
                </div>
                <span className="text-2xl font-bold text-brand-600 dark:text-brand-400">{pct}%</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div className="h-2.5 rounded-full bg-brand-500 transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-5">
              {/* ── Plans list */}
              <div className="lg:col-span-3 space-y-4">

                {loadingPlans ? (
                  <div className="flex justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-b-2 border-brand-500" /></div>
                ) : lessonPlans.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-10 text-center">
                    <p className="text-sm text-gray-400 dark:text-gray-500">Nenhuma aula planejada ainda.</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Use o painel ao lado para vincular um plano de aula.</p>
                  </div>
                ) : (
                  <>
                    {planned.length > 0 && (
                      <div className="space-y-2.5">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                          ⏰ Pendentes ({planned.length})
                        </h3>
                        {planned.map(plan => (
                          <PlanInstanceCard key={plan.id} plan={plan} fmtDate={fmtDate}
                            onMarkDone={(p) => { setDoneModal(p); setDoneNotes('') }}
                            onRevert={handleRevertPlan} onUnlink={handleUnlinkPlan} />
                        ))}
                      </div>
                    )}
                    {done.length > 0 && (
                      <div className="space-y-2.5">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                          ✓ Concluídas ({done.length})
                        </h3>
                        {done.map(plan => (
                          <PlanInstanceCard key={plan.id} plan={plan} fmtDate={fmtDate}
                            onMarkDone={(p) => { setDoneModal(p); setDoneNotes('') }}
                            onRevert={handleRevertPlan} onUnlink={handleUnlinkPlan} />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* ── Link panel */}
              <div className="lg:col-span-2 self-start rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5 space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">Vincular Plano de Aula</h2>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    Escolha um plano da sua biblioteca e defina a data desta aula.
                  </p>
                </div>

                {templates.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 p-4 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum plano criado ainda.</p>
                    <a href="/teacher/lesson-plans" className="mt-1 inline-block text-xs text-brand-600 underline dark:text-brand-400">
                      Criar planos →
                    </a>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Plano de aula *</label>
                      <select value={linkTemplateId} onChange={e => setLinkTemplateId(e.target.value)} className={inputCls}>
                        <option value="">Selecione um plano...</option>
                        {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                      </select>

                      {/* Preview of selected template */}
                      {linkTemplateId && (() => {
                        const t = templates.find(x => x.id === Number(linkTemplateId))
                        if (!t) return null
                        const secs = parsePlanSections(t as Record<string, unknown>)
                        return (
                          <div className="mt-2 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-3 space-y-2">
                            {t.description && <p className="text-xs text-gray-500 dark:text-gray-400 italic">{t.description}</p>}
                            {secs.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {secs.map((s, i) => (
                                  <span key={s.id} className={`rounded-full border px-2 py-0.5 text-xs font-medium ${COLOR_CHIP[colorAt(i)]}`}>
                                    {s.label} <span className="opacity-60">·{s.topics.length}</span>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-400 italic">Sem seções definidas</p>
                            )}
                          </div>
                        )
                      })()}
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Data da aula *</label>
                      <input type="date" value={linkDate} onChange={e => setLinkDate(e.target.value)} className={inputCls} />
                    </div>

                    <button onClick={handleLinkPlan} disabled={savingLink}
                      className="w-full rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60 transition-colors">
                      {savingLink ? 'Vinculando...' : '+ Adicionar à turma'}
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
