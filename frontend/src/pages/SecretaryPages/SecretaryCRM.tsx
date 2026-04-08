import { useEffect, useState, useRef, useCallback } from 'react'
import {
  LuPlus, LuX, LuPhone, LuMail, LuSearch,
  LuMessageSquare, LuCalendarDays, LuCheck, LuClock,
  LuTrash2, LuPencil, LuCircleAlert, LuBookOpen, LuArchive, LuSave,
  LuBell, LuList, LuLayoutDashboard, LuActivity, LuFilter, LuTag,
  LuChartBar, LuTrendingUp, LuTarget, LuRotateCcw, LuTriangleAlert,
} from 'react-icons/lu'
import { TbFlame } from 'react-icons/tb'
import { FaThermometerHalf, FaSnowflake } from 'react-icons/fa'
import { useAuth } from '../../hooks/useAuth'
import PageMeta from '../../components/common/PageMeta'
import { useCountdown, formatCountdown, countdownColor } from '../../hooks/useCountdown'

// --- Types ---

type Stage = 'NOVO' | 'CONTATO' | 'EXPERIMENTAL' | 'PROPOSTA' | 'MATRICULADO' | 'PERDIDO'
type Source = 'INDICACAO' | 'INSTAGRAM' | 'GOOGLE' | 'SITE' | 'OUTRO'
type ActivityType = 'LIGACAO' | 'MENSAGEM' | 'EMAIL' | 'AULA_EXP' | 'NOTA' | 'FOLLOW_UP'

type Lead = {
  id: number; name: string; phone: string | null; email: string | null
  cpf: string | null; rg: string | null
  student_name: string | null; age_range: string | null
  source: Source; stage: Stage; lost_reason: string | null; notes: string | null
  tags: string | null
  assigned_to: number | null; assigned_name: string | null
  score: number; temperature: 'QUENTE' | 'MORNO' | 'FRIO'
  expected_enrollment_date: string | null
  archived: number; enrolled_at: string | null; lost_at: string | null
  follow_up_at: string | null; last_activity_at: string | null
  total_activities: number; pending_followups: number; done_followups: number; next_followup: string | null
  next_exp_class: string | null; pending_exp_classes: number; done_exp_classes: number
  created_at: string; updated_at: string
}

type Activity = {
  id: number; lead_id: number; type: ActivityType; description: string
  scheduled_at: string | null; done: number; done_note: string | null; created_by: number | null
  created_by_name: string | null; created_at: string
}

type StageLog = {
  id: number; lead_id: number; from_stage: string | null; to_stage: string
  changed_by: number | null; changed_by_name: string | null
  note: string | null; created_at: string; lead_name?: string
}

type DuplicateAlert = {
  id: number; name: string; stage: string; archived: number
  cpf: string | null; phone: string | null
}

type FunnelData = {
  funnel: { stage: string; entered: number; converted: number; lost_here: number; still_here: number; conversion_rate: number | null; dropout_rate: number | null; avg_days: number | null; current_count: number }[]
  overall_conversion: number; total_leads: number; total_enrolled: number; avg_days_to_close: number | null
  forecast_30d: { date: string; count: number }[]
  lost_reasons: { reason: string; total: number }[]
}

// --- Config ---

const STAGES: { key: Stage; label: string; color: string; dot: string; dropRing: string }[] = [
  { key: 'NOVO',         label: 'Novo Lead',    color: 'border-t-blue-400',   dot: 'bg-blue-400',   dropRing: 'ring-blue-400' },
  { key: 'CONTATO',      label: 'Em Contato',   color: 'border-t-amber-400',  dot: 'bg-amber-400',  dropRing: 'ring-amber-400' },
  { key: 'EXPERIMENTAL', label: 'Experimental', color: 'border-t-violet-400', dot: 'bg-violet-400', dropRing: 'ring-violet-400' },
  { key: 'PROPOSTA',     label: 'Proposta',     color: 'border-t-orange-400', dot: 'bg-orange-400', dropRing: 'ring-orange-400' },
  { key: 'MATRICULADO',  label: 'Matriculado',  color: 'border-t-green-400',  dot: 'bg-green-400',  dropRing: 'ring-green-400' },
  { key: 'PERDIDO',      label: 'Perdido',      color: 'border-t-gray-400',   dot: 'bg-gray-400',   dropRing: 'ring-gray-400' },
]

const STAGE_MAP = Object.fromEntries(STAGES.map(s => [s.key, s])) as Record<Stage, typeof STAGES[0]>

const SOURCE_LABELS: Record<Source, string> = {
  INDICACAO: '👥 Indicação', INSTAGRAM: '📸 Instagram',
  GOOGLE: '🔍 Google', SITE: '🌐 Site', OUTRO: '📌 Outro',
}

const ACT_ICONS: Record<ActivityType, React.ReactNode> = {
  LIGACAO:   <LuPhone className="h-3.5 w-3.5" />,
  MENSAGEM:  <LuMessageSquare className="h-3.5 w-3.5" />,
  EMAIL:     <LuMail className="h-3.5 w-3.5" />,
  AULA_EXP:  <LuBookOpen className="h-3.5 w-3.5" />,
  NOTA:      <LuPencil className="h-3.5 w-3.5" />,
  FOLLOW_UP: <LuClock className="h-3.5 w-3.5" />,
}
const ACT_LABELS: Record<ActivityType, string> = {
  LIGACAO:'Ligação', MENSAGEM:'Mensagem', EMAIL:'E-mail',
  AULA_EXP:'Aula Experimental', NOTA:'Nota', FOLLOW_UP:'Follow-up',
}
const LOG_LABELS: Record<string, string> = {
  NOVO: 'Novo Lead', CONTATO: 'Em Contato', EXPERIMENTAL: 'Experimental',
  PROPOSTA: 'Proposta', MATRICULADO: 'Matriculado', PERDIDO: 'Perdido',
  ATIVIDADE: 'Atividade registrada', FOLLOW_UP_AGENDADO: 'Follow-up agendado',
  ATIVIDADE_FEITA: 'Atividade concluída',
  EDICAO: 'Dados editados', CAMPO_PERSONALIZADO: 'Campo personalizado', REATIVACAO: 'Reativado',
}

const inputCls = 'w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/30'
const inputSmCls = 'w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/30'

const fmtDate = (d: string) => new Date(d).toLocaleString('pt-BR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
const fmtDateShort = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'short' })

const normalizeLead = (l: Lead): Lead => ({
  ...l,
  total_activities:    Number(l.total_activities    ?? 0),
  pending_followups:   Number(l.pending_followups   ?? 0),
  done_followups:      Number(l.done_followups      ?? 0),
  pending_exp_classes: Number(l.pending_exp_classes ?? 0),
  done_exp_classes:    Number(l.done_exp_classes    ?? 0),
  score:               Number(l.score               ?? 0),
})

// --- ScoreBadge ---

function ScoreBadge({ score, temperature }: { score: number; temperature: Lead['temperature'] }) {
  const cfg = temperature === 'QUENTE'
    ? { cls: 'bg-red-100 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400', icon: <TbFlame className="h-3 w-3" /> }
    : temperature === 'MORNO'
    ? { cls: 'bg-amber-100 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400', icon: <FaThermometerHalf className="h-3 w-3" /> }
    : { cls: 'bg-blue-100 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-400', icon: <FaSnowflake className="h-3 w-3" /> }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${cfg.cls}`}>
      {cfg.icon} {score}
    </span>
  )
}

// --- TagList ---

function TagList({ tags }: { tags: string | null }) {
  if (!tags?.trim()) return null
  return (
    <div className="flex flex-wrap gap-1">
      {tags.split(',').map(t => t.trim()).filter(Boolean).map(t => (
        <span key={t} className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-400">
          <LuTag className="h-2.5 w-2.5" />{t}
        </span>
      ))}
    </div>
  )
}

// --- Lead Card ---

function LeadCard({ lead, onOpen, onDragStart, onInlineUpdate, onInlineDelete }: {
  lead: Lead; onOpen: (l: Lead) => void
  onDragStart: (e: React.DragEvent, lead: Lead) => void
  onInlineUpdate: (id: number, patch: Partial<Lead>) => Promise<boolean>
  onInlineDelete: (id: number) => Promise<void>
}) {
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [form, setForm] = useState({ name: lead.name, phone: lead.phone||'', email: lead.email||'', stage: lead.stage, notes: lead.notes||'' })
  const followUpCd   = useCountdown(lead.follow_up_at)
  const nextFollowCd = useCountdown(lead.next_followup)
  const expCd        = useCountdown(lead.stage === 'EXPERIMENTAL' ? lead.next_exp_class : null)
  const hasAnyExp    = lead.done_exp_classes > 0 || lead.pending_exp_classes > 0
  const initials = lead.assigned_name
    ? lead.assigned_name.split(' ').map((w: string) => w[0]).slice(0,2).join('').toUpperCase() : null
  const stageCfg = STAGE_MAP[lead.stage]

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!form.name.trim()) return
    setSaving(true); setError(null)
    const isMovingToLost = lead.stage !== 'PERDIDO' && form.stage === 'PERDIDO'
    const isLeavingLost = lead.stage === 'PERDIDO' && form.stage !== 'PERDIDO'
    const patch: Partial<Lead> = { ...form }
    if (isMovingToLost) {
      const reason = window.prompt('Motivo da perda?')
      if (!reason?.trim()) { setSaving(false); setError('Motivo da perda e obrigatorio'); return }
      patch.lost_reason = reason.trim()
    } else if (isLeavingLost) {
      patch.lost_reason = null
    }
    const ok = await onInlineUpdate(lead.id, patch)
    setSaving(false)
    if (ok) setEditMode(false)
    else setError('Erro ao salvar. Tente novamente.')
  }
  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm(`Remover lead "${lead.name}"?`)) return
    setDeleting(true); await onInlineDelete(lead.id); setDeleting(false)
  }

  return (
    <div draggable={!editMode} onDragStart={e => !editMode && onDragStart(e, lead)}
      onClick={() => !editMode && onOpen(lead)}
      className={`rounded-xl border bg-white dark:bg-gray-900 shadow-sm transition-all select-none ${
        editMode ? 'border-brand-300 ring-2 ring-brand-500/20 cursor-default'
                 : 'border-gray-200 dark:border-gray-700 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-brand-300'
      }`}>
      {!editMode ? (
        <div className="p-3.5 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="font-semibold text-sm text-gray-900 dark:text-white leading-tight truncate">{lead.name}</p>
                {lead.score != null && <ScoreBadge score={lead.score} temperature={lead.temperature ?? 'FRIO'} />}
              </div>
              {lead.student_name && <p className="text-xs text-gray-500 truncate">Aluno: {lead.student_name}</p>}
            </div>
            <span className="text-xs text-gray-400 shrink-0">{SOURCE_LABELS[lead.source]}</span>
          </div>
          <TagList tags={lead.tags} />
          {(lead.phone || lead.email) && (
            <div className="flex flex-wrap gap-2">
              {lead.phone && (
                <a href={`https://wa.me/55${lead.phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                  onClick={e => e.stopPropagation()} className="inline-flex items-center gap-1 text-xs text-green-600 hover:underline dark:text-green-400">
                  <LuPhone className="h-3 w-3" />{lead.phone}
                </a>
              )}
              {lead.email && <span className="inline-flex items-center gap-1 text-xs text-gray-400"><LuMail className="h-3 w-3" />{lead.email}</span>}
            </div>
          )}
          {lead.expected_enrollment_date && !['MATRICULADO','PERDIDO'].includes(lead.stage) && (
            <div className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium border bg-teal-50 border-teal-200 text-teal-700 dark:bg-teal-950/30 dark:border-teal-800 dark:text-teal-400">
              <LuTarget className="h-3 w-3" /> Previsão: {fmtDateShort(lead.expected_enrollment_date)}
            </div>
          )}
          {followUpCd && followUpCd.type !== 'far' && (
            <div className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium border ${countdownColor(followUpCd)}`}>
              <LuBell className="h-3 w-3" />
              {followUpCd.type === 'overdue' ? 'Contato atrasado!' : `Contato em ${formatCountdown(followUpCd)}`}
            </div>
          )}
          {nextFollowCd && nextFollowCd.type !== 'far' && (
            <div className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium border ${countdownColor(nextFollowCd)}`}>
              <LuClock className="h-3 w-3" />
              {nextFollowCd.type === 'overdue' ? 'Follow-up atrasado!' : `Follow-up em ${formatCountdown(nextFollowCd)}`}
            </div>
          )}
          {lead.done_followups > 0 && lead.pending_followups === 0 && !lead.next_followup && (
            <div className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium border bg-green-50 border-green-200 text-green-700 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400">
              <LuCheck className="h-3 w-3" />{lead.done_followups} follow-up{lead.done_followups > 1 ? 's' : ''} concluído{lead.done_followups > 1 ? 's' : ''}
            </div>
          )}
          {lead.stage === 'EXPERIMENTAL' && expCd && expCd.type !== 'far' && (
            <div className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium border ${countdownColor(expCd)}`}>
              <LuBookOpen className="h-3 w-3" />{expCd.type === 'overdue' ? 'Aula exp. atrasada!' : `Aula exp. em ${formatCountdown(expCd)}`}
            </div>
          )}
          {lead.stage === 'EXPERIMENTAL' && lead.done_exp_classes > 0 && lead.pending_exp_classes === 0 && (
            <div className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium border bg-green-50 border-green-200 text-green-700 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400">
              <LuCheck className="h-3 w-3" />{lead.done_exp_classes} aula{lead.done_exp_classes > 1 ? 's' : ''} exp. concluída{lead.done_exp_classes > 1 ? 's' : ''}
            </div>
          )}
          {lead.stage === 'EXPERIMENTAL' && !hasAnyExp && (
            <div className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium border bg-violet-50 border-violet-200 text-violet-600 dark:bg-violet-950/30 dark:border-violet-800 dark:text-violet-400">
              <LuCircleAlert className="h-3 w-3" /> Agendar aula experimental
            </div>
          )}
          <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800">
            <span className="text-xs text-gray-400">{lead.total_activities} interaç{lead.total_activities === 1 ? 'ão' : 'ões'}</span>
            {initials ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 dark:bg-brand-950/30 px-2 py-0.5 text-xs font-medium text-brand-700 dark:text-brand-400 border border-brand-200 dark:border-brand-800">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-white text-[9px] font-bold shrink-0">{initials}</span>
                {lead.assigned_name?.split(' ')[0]}
              </span>
            ) : <span className="text-xs text-gray-300 italic">sem responsável</span>}
          </div>
          <div className="flex items-center gap-1.5 pt-0.5 border-t border-gray-100 dark:border-gray-800">
            <button onClick={e => { e.stopPropagation(); setError(null); setForm({ name: lead.name, phone: lead.phone||'', email: lead.email||'', stage: lead.stage, notes: lead.notes||'' }); setEditMode(true) }}
              className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 py-1 text-xs text-gray-500 hover:border-brand-300 hover:text-brand-600 transition-colors">
              <LuPencil className="h-3 w-3" /> Editar
            </button>
            <button onClick={handleDelete} disabled={deleting}
              className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 py-1 text-xs text-gray-500 hover:border-red-300 hover:text-red-500 transition-colors disabled:opacity-50">
              <LuTrash2 className="h-3 w-3" /> {deleting ? '...' : 'Deletar'}
            </button>
          </div>
        </div>
      ) : (
        <div className="p-3.5 space-y-2.5" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-brand-700 dark:text-brand-400 uppercase tracking-wide">Editando</span>
            <button onClick={e => { e.stopPropagation(); setEditMode(false) }} className="rounded p-0.5 text-gray-400"><LuX className="h-3.5 w-3.5" /></button>
          </div>
          <div><label className="block text-[10px] font-medium text-gray-500 mb-0.5">Nome *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputSmCls} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-[10px] font-medium text-gray-500 mb-0.5">Telefone</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputSmCls} /></div>
            <div><label className="block text-[10px] font-medium text-gray-500 mb-0.5">E-mail</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputSmCls} /></div>
          </div>
          <div><label className="block text-[10px] font-medium text-gray-500 mb-0.5">Estágio</label>
            <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value as Stage }))} className={inputSmCls}>
              {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select></div>
          <div className="flex gap-1.5">
            <button onClick={e => { e.stopPropagation(); setEditMode(false) }} className="flex-1 rounded-lg border border-gray-300 py-1.5 text-xs text-gray-600">Cancelar</button>
            <button onClick={handleSave} disabled={saving || !form.name.trim()} className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-brand-500 py-1.5 text-xs font-medium text-white disabled:opacity-50">
              <LuSave className="h-3 w-3" /> {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
          {error && <p className="text-[10px] text-red-600">{error}</p>}
          <div className="flex items-center gap-1.5 pt-1">
            <span className={`h-2 w-2 rounded-full ${stageCfg?.dot}`} />
            <span className="text-xs text-gray-400">{stageCfg?.label}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// --- Lead Modal ---

function LeadModal({ lead, onClose, onDelete, onRefresh, authFetch, apiBase }: {
  lead: Lead; onClose: () => void; onDelete: (id: number) => void
  onRefresh: (id: number) => Promise<void>
  authFetch: (i: RequestInfo, init?: RequestInit) => Promise<Response>; apiBase?: string
}) {
  const [editing, setEditing]       = useState(false)
  const [form, setForm]             = useState({ ...lead })
  const [activities, setActivities] = useState<Activity[]>([])
  const [logs, setLogs]             = useState<StageLog[]>([])
  const [loadingActs, setLoadingActs] = useState(true)
  const [actType, setActType]       = useState<ActivityType>('NOTA')
  const [actDesc, setActDesc]       = useState('')
  const [actDate, setActDate]       = useState('')
  const [savingAct, setSavingAct]   = useState(false)
  const [saving, setSaving]         = useState(false)
  const [editError, setEditError]   = useState<string | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [noteError, setNoteError] = useState<string | null>(null)
  const [savedNotes, setSavedNotes] = useState<Record<number, string>>({})
  const [activeTab, setActiveTab]   = useState<'atividades' | 'historico'>('atividades')
  const stageCfg = STAGE_MAP[lead.stage]

  const reloadActivities = useCallback(async () => {
    setLoadingActs(true)
    const r = await authFetch(`${apiBase}/crm/leads/${lead.id}/activities`)
    if (r.ok) {
      const data = await r.json()
      if (data.activities) {
        setActivities(data.activities)
        setLogs(data.logs || [])
        setSavedNotes(s => {
          const next = { ...s }
          for (const a of data.activities as Activity[]) {
            if (a.done_note) next[a.id] = a.done_note
          }
          return next
        })
      } else {
        setActivities(data)
        setSavedNotes(s => {
          const next = { ...s }
          for (const a of data as Activity[]) {
            if (a.done_note) next[a.id] = a.done_note
          }
          return next
        })
      }
    }
    setLoadingActs(false)
  }, [lead.id, authFetch, apiBase])

  useEffect(() => { reloadActivities() }, [reloadActivities])

  useEffect(() => {
    setForm({ ...lead })
    setEditing(false)
    setEditError(null)
    setSavedNotes({})
  }, [lead])

  const saveEdit = async () => {
    if (form.stage === 'PERDIDO' && !form.lost_reason?.trim()) {
      setEditError('Motivo da perda e obrigatorio')
      return
    }
    setSaving(true)
    setEditError(null)
    const payload = {
      ...form,
      lost_reason: form.stage === 'PERDIDO' ? (form.lost_reason || null) : null,
    }
    const res = await authFetch(`${apiBase}/crm/leads/${lead.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    if (res.ok) { await onRefresh(lead.id); await reloadActivities(); setEditing(false) }
    setSaving(false)
  }

  const addActivity = async () => {
    if (!actDesc.trim()) return; setSavingAct(true)
    const res = await authFetch(`${apiBase}/crm/leads/${lead.id}/activities`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: actType, description: actDesc, scheduled_at: actDate || null }),
    })
    if (res.ok) {
      const newActivity = await res.json()
      setActivities(a => [newActivity, ...a])
      setActDesc(''); setActDate('')
      await onRefresh(lead.id)
      await reloadActivities()
    }
    setSavingAct(false)
  }

  const toggleAct = async (act: Activity) => {
    const res = await authFetch(`${apiBase}/crm/activities/${act.id}/toggle`, {
      method: 'PATCH',
    })
    if (res.ok) {
      const updated = await res.json()
      setActivities(acts => acts.map(x => x.id === act.id ? { ...x, done: updated.done, done_note: updated.done_note ?? x.done_note } : x))
      setEditingNoteId(null)
      setNoteDraft('')
      await onRefresh(lead.id)
      await reloadActivities()
    }
  }
  const saveActNote = async (act: Activity) => {
    const trimmed = noteDraft.trim()
    if (!trimmed) { setNoteError('Resultado e obrigatorio'); return }
    const res = await authFetch(`${apiBase}/crm/activities/${act.id}/toggle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done_note: trimmed }),
    })
    if (res.ok) {
      const updated = await res.json()
      setActivities(acts => acts.map(x => x.id === act.id ? { ...x, done: updated.done, done_note: updated.done_note ?? trimmed } : x))
      setEditingNoteId(null)
      setNoteDraft('')
      setNoteError(null)
      setSavedNotes(s => ({ ...s, [act.id]: updated.done_note ?? trimmed }))
      await onRefresh(lead.id)
      await reloadActivities()
    } else {
      setNoteError('Nao foi possivel salvar o resultado')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/50 p-4" onClick={onClose}>
      <div className="h-full w-full max-w-lg overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="border-b border-gray-200 dark:border-gray-700 px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${stageCfg?.dot}`} />
            <span className="text-sm font-medium text-gray-500">{stageCfg?.label}</span>
            {lead.score != null && <ScoreBadge score={lead.score} temperature={lead.temperature ?? 'FRIO'} />}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => {
              setEditError(null)
              setEditing(v => {
                if (v) setForm({ ...lead })
                return !v
              })
            }}
              className={`rounded-lg p-1.5 transition-colors ${editing ? 'bg-brand-100 text-brand-600' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
              <LuPencil className="h-4 w-4" />
            </button>
            <button onClick={() => { if(window.confirm('Remover este lead?')) onDelete(lead.id) }}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500">
              <LuTrash2 className="h-4 w-4" />
            </button>
            <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
              <LuX className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {editing ? (
            <div className="space-y-3 rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50/40 p-4">
              <p className="text-xs font-semibold text-brand-700 uppercase tracking-wide">Editando</p>
              {editError && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{editError}</div>}
              {([['name','Nome *','text'],['phone','Telefone','text'],['email','E-mail','email'],
                ['cpf','CPF','text'],['rg','RG','text'],
                ['student_name','Nome do aluno','text'],['age_range','Faixa etária','text']] as [string,string,string][]).map(([k,lbl,t]) => (
                <div key={k}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{lbl}</label>
                  <input type={t} value={(form as Record<string,unknown>)[k] as string || ''}
                    onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} className={inputCls} />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Origem</label>
                  <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value as Source }))} className={inputCls}>
                    {Object.entries(SOURCE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                  </select></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Estágio</label>
                  <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value as Stage }))} className={inputCls}>
                    {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select></div>
              </div>
              {form.stage === 'PERDIDO' && (
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Motivo da perda</label>
                  <input value={form.lost_reason || ''} onChange={e => setForm(f => ({ ...f, lost_reason: e.target.value }))} className={inputCls} /></div>
              )}
              <div><label className="block text-xs font-medium text-gray-600 mb-1">🎯 Previsão de matrícula</label>
                <input type="date" value={form.expected_enrollment_date || ''} onChange={e => setForm(f => ({ ...f, expected_enrollment_date: e.target.value || null }))} className={inputCls} /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">📅 Agendar contato</label>
                <input type="datetime-local" value={form.follow_up_at?.slice(0,16) || ''} onChange={e => setForm(f => ({ ...f, follow_up_at: e.target.value || null }))} className={inputCls} /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">🏷️ Tags</label>
                <input value={form.tags || ''} onChange={e => setForm(f => ({ ...f, tags: e.target.value || null }))} className={inputCls} placeholder="ex: violão, adulto" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Observações</label>
                <textarea value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={inputCls} /></div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setForm({ ...lead }); setEditError(null); setEditing(false) }} className="rounded-xl border border-gray-300 px-3 py-1.5 text-sm text-gray-600">Cancelar</button>
                <button onClick={saveEdit} disabled={saving} className="rounded-xl bg-brand-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{lead.name}</h2>
              {lead.student_name && <p className="text-sm text-gray-500"><span className="font-medium">Aluno:</span> {lead.student_name}{lead.age_range ? ` · ${lead.age_range}` : ''}</p>}
              <div className="flex flex-wrap gap-3 text-sm">
                {lead.phone && <a href={`https://wa.me/55${lead.phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-green-600 hover:underline"><LuPhone className="h-4 w-4" />{lead.phone}</a>}
                {lead.email && <span className="flex items-center gap-1.5 text-gray-500"><LuMail className="h-4 w-4" />{lead.email}</span>}
              </div>
              {(lead.cpf || lead.rg) && (
                <div className="flex gap-4 text-xs text-gray-500">
                  {lead.cpf && <span>CPF: {lead.cpf}</span>}
                  {lead.rg && <span>RG: {lead.rg}</span>}
                </div>
              )}
              <TagList tags={lead.tags} />
              {lead.expected_enrollment_date && (
                <div className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm border bg-teal-50 border-teal-200 text-teal-700">
                  <LuTarget className="h-4 w-4" /> Previsão: {fmtDateShort(lead.expected_enrollment_date)}
                </div>
              )}
              {lead.follow_up_at && (
                <div className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm border ${
                  new Date(lead.follow_up_at) < new Date() ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-700'
                }`}>
                  <LuBell className="h-4 w-4" /> Contato: {fmtDate(lead.follow_up_at)}
                </div>
              )}
              {lead.notes && <p className="text-sm text-gray-600 dark:text-gray-400 italic">{lead.notes}</p>}
              {lead.lost_reason && <p className="text-sm text-red-600">Motivo: {lead.lost_reason}</p>}
              <span className="inline-block rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-xs text-gray-600">{SOURCE_LABELS[lead.source]}</span>
            </div>
          )}

          {/* Registrar interação */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Registrar interação</p>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(ACT_LABELS) as ActivityType[]).map(t => (
                <button key={t} onClick={() => setActType(t)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                    actType === t ? 'bg-brand-100 border-brand-300 text-brand-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}>{ACT_ICONS[t]} {ACT_LABELS[t]}</button>
              ))}
            </div>
            <textarea value={actDesc} onChange={e => setActDesc(e.target.value)} rows={2}
              placeholder={actType === 'FOLLOW_UP' ? 'Descreva o que deve ser feito...' : 'O que aconteceu?'}
              className={`${inputCls} resize-none`} />
            {(actType === 'FOLLOW_UP' || actType === 'AULA_EXP') && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {actType === 'FOLLOW_UP' ? '📅 Data/hora do follow-up' : '📅 Data/hora da aula experimental'}
                </label>
                <input type="datetime-local" value={actDate} onChange={e => setActDate(e.target.value)} className={inputCls} />
              </div>
            )}
            <button onClick={addActivity} disabled={savingAct || !actDesc.trim()}
              className="w-full rounded-xl bg-brand-500 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
              {savingAct ? 'Salvando...' : '+ Registrar'}
            </button>
          </div>

          {/* Tabs */}
          <div>
            <div className="flex gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1 mb-4">
              {[['atividades','Atividades'],['historico','Histórico']].map(([key, label]) => (
                <button key={key} onClick={() => setActiveTab(key as 'atividades' | 'historico')}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                    activeTab === key ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}>{label}</button>
              ))}
            </div>
            {activeTab === 'atividades' && (
              loadingActs ? <div className="flex justify-center py-6"><div className="h-5 w-5 animate-spin rounded-full border-b-2 border-brand-500" /></div>
              : activities.length === 0 ? <p className="text-xs text-gray-400 text-center py-4 italic">Nenhuma interação registrada.</p>
              : <div className="space-y-2">
                {activities.map(act => {
                  const isOverdue = act.scheduled_at && new Date(act.scheduled_at) < new Date() && !act.done
                  return (
                    <div key={act.id} className={`rounded-xl border p-3 space-y-1.5 ${act.done ? 'opacity-60' : ''} ${
                      isOverdue ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20' : 'border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50'
                    }`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-500">{ACT_ICONS[act.type]}</span>
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{ACT_LABELS[act.type]}</span>
                          {isOverdue && <LuCircleAlert className="h-3.5 w-3.5 text-red-500" />}
                        </div>
                        {act.scheduled_at && (
                          <button
                            onClick={() => {
                              if (act.done) toggleAct(act)
                              else { setEditingNoteId(act.id); setNoteDraft(act.done_note || ''); setNoteError(null) }
                            }}
                            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border ${
                              act.done ? 'bg-green-100 border-green-200 text-green-700' : 'border-gray-200 text-gray-500 hover:bg-gray-100'
                            }`}>
                            {act.done ? <><LuCheck className="h-3 w-3" /> Feito</> : <><LuClock className="h-3 w-3" /> Pendente</>}
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{act.description}</p>
                      {editingNoteId === act.id ? (
                        <div>
                          <p className="text-[10px] font-medium text-gray-500 mb-1">Resultado</p>
                          <textarea
                            rows={2}
                            value={noteDraft}
                            onChange={e => { setNoteDraft(e.target.value); if (noteError && e.target.value.trim()) setNoteError(null) }}
                            className={`${inputSmCls} resize-none ${noteError ? 'border-red-300 focus:ring-red-500/30' : ''}`}
                          />
                          {noteError && <p className="text-[10px] text-red-600 mt-1">{noteError}</p>}
                          <div className="flex gap-2 justify-end mt-2">
                            <button
                              onClick={() => { setEditingNoteId(null); setNoteDraft(''); setNoteError(null) }}
                              className="rounded-md border border-gray-300 px-2 py-1 text-[10px] text-gray-600"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => saveActNote(act)}
                              disabled={!noteDraft.trim()}
                              className="rounded-md bg-brand-500 px-2 py-1 text-[10px] text-white disabled:opacity-50"
                            >
                              Salvar
                            </button>
                          </div>
                        </div>
                      ) : act.done ? (
                        <div className="mt-1">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-semibold text-gray-600">Resultado</p>
                            <button
                              onClick={() => { setEditingNoteId(act.id); setNoteDraft(act.done_note || ''); setNoteError(null) }}
                              className="text-[10px] text-brand-600 hover:underline"
                            >
                              Editar
                            </button>
                          </div>
                          <div className="mt-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-300 whitespace-pre-wrap">
                            {act.done_note || savedNotes[act.id] || 'Resultado nao informado'}
                          </div>
                        </div>
                      ) : null}
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>{act.created_by_name && `por ${act.created_by_name} · `}{fmtDate(act.created_at)}</span>
                        {act.scheduled_at && <span className={isOverdue ? 'text-red-500' : ''}><LuCalendarDays className="inline h-3 w-3 mr-0.5" />{fmtDate(act.scheduled_at)}</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {activeTab === 'historico' && (
              <div className="space-y-2">
                {logs.length === 0 ? <p className="text-xs text-gray-400 text-center py-4 italic">Nenhum registro.</p>
                : logs.map(log => (
                  <div key={log.id} className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap text-xs">
                        {log.from_stage && !['ATIVIDADE','FOLLOW_UP_AGENDADO','EDICAO','CAMPO_PERSONALIZADO','REATIVACAO'].includes(log.to_stage) ? (
                          <><span className="text-gray-500">{LOG_LABELS[log.from_stage] || log.from_stage}</span>
                  <span className="text-gray-400">→</span>
                          <span className="font-semibold text-gray-800 dark:text-gray-200">{LOG_LABELS[log.to_stage] || log.to_stage}</span></>
                        ) : <span className={`font-semibold ${log.to_stage === 'REATIVACAO' ? 'text-brand-600' : log.to_stage === 'EDICAO' ? 'text-amber-600' : 'text-gray-800 dark:text-gray-200'}`}>
                          {LOG_LABELS[log.to_stage] || log.to_stage}</span>}
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">{fmtDate(log.created_at)}</span>
                    </div>
                    {log.note && <p className="text-xs text-gray-500 italic">{log.note}</p>}
                    {log.changed_by_name && <p className="text-xs text-gray-400">por {log.changed_by_name}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Archived Panel ---

function ArchivedPanel({ authFetch, apiBase, onClose, onOpenLead, onReactivated }: {
  authFetch: (i: RequestInfo, init?: RequestInit) => Promise<Response>
  apiBase?: string; onClose: () => void; onOpenLead: (lead: Lead) => void; onReactivated?: () => void
}) {
  const [tab, setTab]         = useState<'all' | 'enrolled' | 'lost'>('all')
  const [leads, setLeads]     = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [reactivating, setReactivating] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams({ type: tab })
    if (search.trim()) p.set('search', search.trim())
    const r = await authFetch(`${apiBase}/crm/archived?${p}`)
    if (r.ok) setLeads(await r.json())
    setLoading(false)
  }, [tab, search, authFetch, apiBase])

  useEffect(() => { load() }, [load])

  const handleReactivate = async (lead: Lead) => {
    if (!window.confirm(`Reativar "${lead.name}" e devolver ao pipeline?`)) return
    setReactivating(lead.id)
    const r = await authFetch(`${apiBase}/crm/leads/${lead.id}/reactivate`, { method: 'POST' })
    if (r.ok) { await load(); onReactivated?.() }
    else { const e = await r.json().catch(() => {}); alert(e?.error || 'Erro ao reativar') }
    setReactivating(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/50 p-4" onClick={onClose}>
      <div className="h-full w-full max-w-2xl overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="border-b border-gray-200 dark:border-gray-700 px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <LuArchive className="h-5 w-5 text-brand-500" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Leads Arquivados</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><LuX className="h-5 w-5" /></button>
        </div>
        <div className="flex gap-1 p-3 shrink-0 border-b border-gray-100 dark:border-gray-800">
          {[['all','Todos'],['enrolled','Matriculados'],['lost','Perdidos']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key as 'all' | 'enrolled' | 'lost')}
              className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                tab === key ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}>{label}</button>
          ))}
        </div>
        <div className="px-4 py-3 shrink-0">
          <div className="relative">
            <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar arquivados..."
              className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:text-white" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
          {loading ? <div className="flex justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-b-2 border-brand-500" /></div>
          : leads.length === 0 ? <p className="text-center text-sm text-gray-400 py-10 italic">Nenhum lead arquivado.</p>
          : leads.map(lead => {
            const stageCfg = STAGE_MAP[lead.stage as Stage]
            const isLost = lead.stage === 'PERDIDO'
            return (
              <div key={lead.id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={() => onOpenLead(lead)} className="font-semibold text-sm text-gray-900 dark:text-white hover:text-brand-600 truncate">
                        {lead.name}
                      </button>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        isLost ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' : 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${stageCfg?.dot}`} />
                        {stageCfg?.label}
                      </span>
                      {lead.score != null && <ScoreBadge score={lead.score} temperature={lead.temperature ?? 'FRIO'} />}
                    </div>
                    {lead.student_name && <p className="text-xs text-gray-500">Aluno: {lead.student_name}</p>}
                    <div className="flex flex-wrap gap-3 mt-1">
                      {lead.phone && <span className="text-xs text-gray-400 flex items-center gap-1"><LuPhone className="h-3 w-3" />{lead.phone}</span>}
                      {lead.cpf && <span className="text-xs text-gray-400">CPF: {lead.cpf}</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {isLost ? (lead.lost_at ? `Perdido em ${fmtDate(lead.lost_at)}` : 'Perdido')
                               : (lead.enrolled_at ? `Matriculado em ${fmtDate(lead.enrolled_at)}` : 'Matriculado')}
                      {' · '}{lead.total_activities} interações
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {isLost && (
                      <button onClick={() => handleReactivate(lead)} disabled={reactivating === lead.id}
                        className="flex items-center gap-1 rounded-lg bg-brand-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50">
                        <LuRotateCcw className={`h-3 w-3 ${reactivating === lead.id ? 'animate-spin' : ''}`} /> Reativar
                      </button>
                    )}
                    <button onClick={() => onOpenLead(lead)}
                      className="flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs text-gray-500 hover:border-brand-300 hover:text-brand-600">
                      <LuPencil className="h-3 w-3" /> Ver
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// --- Funnel Panel ---

function FunnelPanel({ authFetch, apiBase, onClose }: {
  authFetch: (i: RequestInfo, init?: RequestInit) => Promise<Response>
  apiBase?: string; onClose: () => void
}) {
  const [data, setData]       = useState<FunnelData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authFetch(`${apiBase}/crm/funnel`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && Array.isArray(d.funnel)) setData(d) })
      .finally(() => setLoading(false))
  }, [authFetch, apiBase])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/50 p-4" onClick={onClose}>
      <div className="h-full w-full max-w-2xl overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="border-b border-gray-200 dark:border-gray-700 px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <LuChartBar className="h-5 w-5 text-brand-500" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Funil de Conversão</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><LuX className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand-500" /></div>
          : !data ? <p className="text-center text-sm text-gray-400 py-20">Erro ao carregar métricas.</p>
          : (
            <>
              {/* Resumo geral */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Total ativo', value: data.total_leads, color: 'text-brand-600' },
                  { label: 'Matriculados', value: data.total_enrolled, color: 'text-green-600' },
                  { label: 'Conversão geral', value: `${data.overall_conversion}%`, color: 'text-amber-600' },
                ].map(m => (
                  <div key={m.label} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 text-center">
                    <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{m.label}</p>
                  </div>
                ))}
              </div>
              {data.avg_days_to_close != null && (
                <div className="rounded-xl border border-brand-100 dark:border-brand-900 bg-brand-50 dark:bg-brand-950/20 px-4 py-3 flex items-center gap-3">
                  <LuTrendingUp className="h-5 w-5 text-brand-600 shrink-0" />
                  <p className="text-sm text-brand-800 dark:text-brand-300">
                    Tempo médio do ciclo completo (Novo → Matriculado): <span className="font-bold">{data.avg_days_to_close} dias</span>
                  </p>
                </div>
              )}

              {/* Funil por estágio */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Pipeline por estágio</p>
                <div className="space-y-2">
                  {data.funnel.map(f => {
                    const stageCfg = STAGE_MAP[f.stage as Stage]
                    const convPct = f.conversion_rate ?? 0
                    return (
                      <div key={f.stage} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${stageCfg?.dot}`} />
                            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{stageCfg?.label || f.stage}</span>
                            <span className="text-xs text-gray-400">{f.current_count} ativos</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            {f.avg_days != null && <span>⏱ {f.avg_days}d média</span>}
                            {f.conversion_rate != null && (
                              <span className={`font-semibold ${convPct >= 50 ? 'text-green-600' : convPct >= 25 ? 'text-amber-600' : 'text-red-500'}`}>
                                {convPct}% avançam
                              </span>
                            )}
                          </div>
                        </div>
                        {f.conversion_rate != null && (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${convPct >= 50 ? 'bg-green-500' : convPct >= 25 ? 'bg-amber-500' : 'bg-red-500'}`}
                                style={{ width: `${convPct}%` }} />
                            </div>
                            <span className="text-[10px] text-gray-400 shrink-0">{f.entered} entraram</span>
                          </div>
                        )}
                        <div className="flex gap-3 text-[10px] text-gray-400">
                          <span className="text-green-600">✓ {f.converted} avançaram</span>
                          <span className="text-red-500">✗ {f.lost_here} perdidos aqui</span>
                          <span>~ {f.still_here} ainda aqui</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Previsão 30 dias */}
              {data.forecast_30d.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                    <LuTarget className="inline h-3.5 w-3.5 mr-1" />Previsão próximos 30 dias
                  </p>
                  <div className="space-y-1.5">
                    {data.forecast_30d.map(f => (
                      <div key={f.date} className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
                        <span className="text-sm text-gray-700 dark:text-gray-300">{fmtDateShort(f.date)}</span>
                        <span className="text-sm font-semibold text-teal-600">{f.count} matrícula{f.count > 1 ? 's' : ''} prevista{f.count > 1 ? 's' : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Motivos de perda */}
              {data.lost_reasons.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Motivos de perda</p>
                  <div className="space-y-2">
                    {data.lost_reasons.map(r => {
                      const total = data.lost_reasons.reduce((s, x) => s + x.total, 0)
                      const pct = total > 0 ? Math.round((r.total / total) * 100) : 0
                      return (
                        <div key={r.reason} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-700 dark:text-gray-300">{r.reason}</span>
                            <span className="text-gray-500">{r.total} ({pct}%)</span>
                          </div>
                          <div className="bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
                            <div className="bg-red-400 h-full rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// --- New Lead Modal ---

function NewLeadModal({ onClose, onCreated, authFetch, apiBase }: {
  onClose: () => void; onCreated: (l: Lead) => void
  authFetch: (i: RequestInfo, init?: RequestInit) => Promise<Response>; apiBase?: string
}) {
  const [form, setForm] = useState({
    name: '', phone: '', email: '', cpf: '', rg: '',
    student_name: '', age_range: '',
    source: 'OUTRO' as Source, stage: 'NOVO' as Stage,
    tags: '', notes: '', expected_enrollment_date: '', follow_up_at: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [dupWarning, setDupWarning] = useState<DuplicateAlert[]>([])
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  useEffect(() => {
    const p = new URLSearchParams()
    if (form.cpf.replace(/\D/g,'')) p.set('cpf', form.cpf)
    if (form.phone.replace(/\D/g,'')) p.set('phone', form.phone)
    if (!p.toString()) { setDupWarning([]); return }
    const t = setTimeout(async () => {
      const r = await authFetch(`${apiBase}/crm/check-duplicate?${p}`)
      if (r.ok) { const d = await r.json(); setDupWarning(d.duplicates || []) }
    }, 500)
    return () => clearTimeout(t)
  }, [form.cpf, form.phone, authFetch, apiBase])

  const submit = async () => {
    if (!form.name.trim()) return setError('Nome é obrigatório')
    setSaving(true); setError(null)
    const res = await authFetch(`${apiBase}/crm/leads`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, cpf: form.cpf || null, rg: form.rg || null,
        tags: form.tags || null, expected_enrollment_date: form.expected_enrollment_date || null,
        follow_up_at: form.follow_up_at || null }),
    })
    if (res.ok) { onCreated(await res.json()); onClose() }
    else { const b = await res.json().catch(() => {}); setError(b?.error || 'Erro ao criar lead') }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <LuPlus className="h-5 w-5 text-brand-500" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Novo Lead</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><LuX className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
          {dupWarning.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20 p-3 space-y-1">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <LuTriangleAlert className="h-4 w-4 shrink-0" />
                <span className="text-xs font-semibold">Possível duplicidade detectada</span>
              </div>
              {dupWarning.map(d => (
                <p key={d.id} className="text-xs text-amber-700 dark:text-amber-300 pl-6">
                  {d.name} — {STAGE_MAP[d.stage as Stage]?.label || d.stage}{d.archived ? ' (arquivado)' : ''}
                </p>
              ))}
            </div>
          )}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Contato</p>
            <div className="space-y-2">
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Nome *</label>
                <input value={form.name} onChange={set('name')} className={inputCls} placeholder="Nome completo" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Telefone</label>
                  <input value={form.phone} onChange={set('phone')} className={inputCls} placeholder="(00) 00000-0000" /></div>
                <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">E-mail</label>
                  <input type="email" value={form.email} onChange={set('email')} className={inputCls} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">CPF</label>
                  <input value={form.cpf} onChange={set('cpf')} className={inputCls} placeholder="000.000.000-00" /></div>
                <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">RG</label>
                  <input value={form.rg} onChange={set('rg')} className={inputCls} /></div>
              </div>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Futuro Aluno</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2"><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Nome do aluno</label>
                <input value={form.student_name} onChange={set('student_name')} className={inputCls} /></div>
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Faixa etária</label>
                <input value={form.age_range} onChange={set('age_range')} className={inputCls} placeholder="Ex: 6-8 anos" /></div>
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Como nos encontrou?</label>
                <select value={form.source} onChange={set('source')} className={inputCls}>
                  {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Pipeline</p>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Estágio inicial</label>
                <select value={form.stage} onChange={set('stage')} className={inputCls}>
                  {STAGES.filter(s => !['MATRICULADO','PERDIDO'].includes(s.key)).map(s => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select></div>
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">🎯 Previsão de matrícula</label>
                <input type="date" value={form.expected_enrollment_date} onChange={set('expected_enrollment_date')} className={inputCls} /></div>
              <div className="col-span-2"><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">📅 Agendar primeiro contato</label>
                <input type="datetime-local" value={form.follow_up_at} onChange={set('follow_up_at')} className={inputCls} /></div>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Extra</p>
            <div className="space-y-2">
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">🏷️ Tags (por vírgula)</label>
                <input value={form.tags} onChange={set('tags')} className={inputCls} placeholder="ex: violão, adulto, manhã" /></div>
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Observações</label>
                <textarea value={form.notes} onChange={set('notes')} rows={2} className={`${inputCls} resize-none`} /></div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 dark:border-gray-700 px-6 py-4 shrink-0">
          <button onClick={onClose} className="rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300">Cancelar</button>
          <button onClick={submit} disabled={saving} className="rounded-xl bg-brand-500 px-5 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
            {saving ? 'Criando...' : '+ Criar Lead'}
          </button>
        </div>
      </div>
    </div>
  )
}

// --- Feed Panel ---

function FeedPanel({ authFetch, apiBase, onClose }: {
  authFetch: (i: RequestInfo, init?: RequestInit) => Promise<Response>
  apiBase?: string; onClose: () => void
}) {
  const [feed, setFeed]       = useState<StageLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('TODOS')
  useEffect(() => {
    authFetch(`${apiBase}/crm/feed`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setFeed(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [authFetch, apiBase])
  const filteredFeed = filter === 'TODOS' ? feed : feed.filter(l => l.to_stage === filter)
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/50 p-4" onClick={onClose}>
      <div className="h-full w-full max-w-md overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="border-b border-gray-200 dark:border-gray-700 px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <LuActivity className="h-5 w-5 text-brand-500" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Atividade Recente</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><LuX className="h-5 w-5" /></button>
        </div>
        <div className="p-4 shrink-0">
          <div className="flex flex-wrap gap-1.5">
            {['TODOS','NOVO','CONTATO','EXPERIMENTAL','PROPOSTA','MATRICULADO','PERDIDO','ATIVIDADE','ATIVIDADE_FEITA','FOLLOW_UP_AGENDADO'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  filter === f ? 'bg-gray-900 text-white border-transparent dark:bg-white dark:text-gray-900'
                               : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400'
                }`}>{LOG_LABELS[f] || f}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
          {loading ? <div className="flex justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-b-2 border-brand-500" /></div>
          : filteredFeed.length === 0 ? <p className="text-center text-sm text-gray-400 py-10 italic">Nenhuma atividade.</p>
          : filteredFeed.map(log => (
            <div key={log.id} className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{log.lead_name}</span>
                <span className="text-xs text-gray-400 shrink-0">{fmtDate(log.created_at)}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                {log.from_stage && log.to_stage !== 'ATIVIDADE' && log.to_stage !== 'FOLLOW_UP_AGENDADO' ? (
                  <><span className="text-gray-500">{LOG_LABELS[log.from_stage] || log.from_stage}</span>
                  <span className="text-gray-400">→</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">{LOG_LABELS[log.to_stage] || log.to_stage}</span></>
                ) : <span className="font-medium text-gray-700 dark:text-gray-300">{LOG_LABELS[log.to_stage] || log.to_stage}</span>}
              </div>
              {log.note && <p className="text-xs text-gray-500 italic">{log.note}</p>}
              {log.changed_by_name && <p className="text-xs text-gray-400">por {log.changed_by_name}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// --- Main Page ---

export default function SecretaryCRM({ apiBase = '/secretary' }: { apiBase?: string }) {
  const { authFetch } = useAuth()
  const [leads, setLeads]         = useState<Lead[]>([])
  const [loading, setLoading]     = useState(true)
  const [openLead, setOpenLead]   = useState<Lead | null>(null)
  const [newModal, setNewModal]   = useState(false)
  const [showFeed, setShowFeed]   = useState(false)
  const [showFunnel, setShowFunnel]   = useState(false)
  const [showArchive, setShowArchive] = useState(false)
  const [filter, setFilter]       = useState<Stage | 'ALL'>('ALL')
  const [globalSearch, setGlobalSearch] = useState('')
  const [listSearch, setListSearch]     = useState('')
  const [archiving, setArchiving]     = useState(false)
  const [archivingLost, setArchivingLost] = useState(false)
  const dragLeadId = useRef<number | null>(null)
  const [dragOver, setDragOver]   = useState<Stage | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const isListMode = filter !== 'ALL'

  const load = useCallback(async () => {
    setLoading(true)
    const res = await authFetch(`${apiBase}/crm/leads`)
    if (res.ok) {
      const json = await res.json()
      const data: Lead[] = Array.isArray(json) ? json : (json.data ?? [])
      setLeads(data.map(l => normalizeLead(l)))
    }
    setLoading(false)
  }, [authFetch, apiBase])

  useEffect(() => { load() }, [load])

  const handleDragStart = (e: React.DragEvent, lead: Lead) => {
    dragLeadId.current = lead.id; e.dataTransfer.effectAllowed = 'move'
    const ghost = e.currentTarget as HTMLElement
    ghost.style.opacity = '0.5'; setTimeout(() => { ghost.style.opacity = '1' }, 0)
  }
  const handleDrop = async (e: React.DragEvent, stage: Stage) => {
    e.preventDefault(); setDragOver(null)
    const id = dragLeadId.current; dragLeadId.current = null; if (!id) return
    const lead = leads.find(l => l.id === id); if (!lead || lead.stage === stage) return
    const isMovingToLost = lead.stage !== 'PERDIDO' && stage === 'PERDIDO'
    const isLeavingLost = lead.stage === 'PERDIDO' && stage !== 'PERDIDO'
    const patch: Partial<Lead> = { stage }
    if (isMovingToLost) {
      const reason = window.prompt('Motivo da perda?')
      if (!reason?.trim()) return
      patch.lost_reason = reason.trim()
    } else if (isLeavingLost) {
      patch.lost_reason = null
    }
    setLeads(ls => ls.map(l => l.id === id ? { ...l, stage, ...(patch.lost_reason !== undefined ? { lost_reason: patch.lost_reason } : {}) } : l))
    const res = await authFetch(`${apiBase}/crm/leads/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    })
    if (!res.ok) setLeads(ls => ls.map(l => l.id === id ? lead : l))
    else load()
  }
  const handleBoardDragOver = (e: React.DragEvent) => {
    if (!boardRef.current) return
    const rect = boardRef.current.getBoundingClientRect(); const edge = 120; const speed = 20
    if (e.clientX < rect.left + edge) boardRef.current.scrollBy({ left: -speed })
    if (e.clientX > rect.right - edge) boardRef.current.scrollBy({ left: speed })
  }

  const handleInlineUpdate = async (id: number, patch: Partial<Lead>) => {
    try {
      const res = await authFetch(`${apiBase}/crm/leads/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
      })
      if (res.ok) {
        const u = await res.json()
        setLeads(ls => ls.map(l => l.id === id ? normalizeLead({ ...l, ...u } as Lead) : l))
        return true
      }
    } catch (err) {
      console.error('Erro ao atualizar lead', err)
    }
    return false
  }
  const handleInlineDelete = async (id: number) => {
    const res = await authFetch(`${apiBase}/crm/leads/${id}`, { method: 'DELETE' })
    if (res.ok) { setLeads(ls => ls.filter(l => l.id !== id)); if (openLead?.id === id) setOpenLead(null) }
  }
  const handleRefreshLead = async (id: number) => {
    const res = await authFetch(`${apiBase}/crm/leads`)
    if (res.ok) {
      const json = await res.json()
      const data: Lead[] = Array.isArray(json) ? json : (json.data ?? [])
      const fresh = data.find(l => l.id === id)
      if (fresh) {
        const n = normalizeLead(fresh)
        setLeads(ls => ls.map(l => l.id === id ? n : l)); setOpenLead(n)
      }
    }
  }
  const handleDelete = async (id: number) => {
    const res = await authFetch(`${apiBase}/crm/leads/${id}`, { method: 'DELETE' })
    if (res.ok) { setLeads(ls => ls.filter(l => l.id !== id)); setOpenLead(null) }
  }

  const now = new Date()
  const nowMonth = now.getMonth(); const nowYear = now.getFullYear()
  const isOldDate = (d: string | null) => {
    if (!d) return false; const dt = new Date(d)
    return dt.getFullYear() < nowYear || (dt.getFullYear() === nowYear && dt.getMonth() < nowMonth)
  }
  const oldEnrolled = leads.filter(l => l.stage === 'MATRICULADO' && isOldDate(l.enrolled_at))
  const oldLost     = leads.filter(l => l.stage === 'PERDIDO'     && isOldDate(l.lost_at))

  const handleArchiveEnrolled = async () => {
    if (!window.confirm(`Arquivar ${oldEnrolled.length} matrícula(s)?`)) return
    setArchiving(true)
    const res = await authFetch(`${apiBase}/crm/archive-enrolled`, { method: 'POST' })
    if (res.ok) { const ids = new Set(oldEnrolled.map(l => l.id)); setLeads(ls => ls.filter(l => !ids.has(l.id))) }
    setArchiving(false)
  }
  const handleArchiveLost = async () => {
    if (!window.confirm(`Arquivar ${oldLost.length} lead(s) perdido(s)?`)) return
    setArchivingLost(true)
    const res = await authFetch(`${apiBase}/crm/archive-lost`, { method: 'POST' })
    if (res.ok) { const ids = new Set(oldLost.map(l => l.id)); setLeads(ls => ls.filter(l => !ids.has(l.id))) }
    setArchivingLost(false)
  }

  // Métricas
  const active       = leads.filter(l => !['MATRICULADO','PERDIDO'].includes(l.stage))
  const enrolled     = leads.filter(l => l.stage === 'MATRICULADO').length
  const experimental = leads.filter(l => l.stage === 'EXPERIMENTAL').length
  const lost         = leads.filter(l => l.stage === 'PERDIDO').length
  const overdueToday = leads.filter(l => {
    const dates = [l.follow_up_at, l.next_followup].filter(Boolean) as string[]
    return dates.some(d => new Date(d) <= now)
  }).length
  const monthName    = now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })

  // Busca global (modo ALL)
  const globalLeads = !isListMode && globalSearch.trim()
    ? leads.filter(l => {
        const q = globalSearch.toLowerCase()
        return l.name.toLowerCase().includes(q)
          || (l.phone || '').includes(q)
          || (l.email || '').toLowerCase().includes(q)
          || (l.student_name || '').toLowerCase().includes(q)
          || (l.cpf || '').includes(q)
      })
    : []

  // Lista por estágio (modo filtro)
  const listLeads = isListMode ? leads.filter(l => {
    if (l.stage !== filter) return false
    if (!listSearch.trim()) return true
    const q = listSearch.toLowerCase()
    return l.name.toLowerCase().includes(q) || (l.phone || '').includes(q)
      || (l.email || '').toLowerCase().includes(q) || (l.student_name || '').toLowerCase().includes(q)
  }) : []

  const stageCfgActive = isListMode ? STAGE_MAP[filter as Stage] : null
  const isGlobalSearchMode = !isListMode && globalSearch.trim().length > 0

  return (
    <>
      <PageMeta title="CRM | Secretaria" description="Pipeline de leads" />
      <div className="space-y-4 flex flex-col" style={{ minHeight: 0 }}>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">CRM — Pipeline de Leads</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {isListMode ? 'Modo lista — filtre dentro do estágio selecionado.'
                          : 'Arraste os cards entre colunas para avançar leads no pipeline.'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button onClick={() => setShowArchive(true)}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:border-brand-300 transition-colors">
              <LuArchive className="h-3.5 w-3.5" /> Arquivados
            </button>
            <button onClick={() => setShowFunnel(true)}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:border-brand-300 transition-colors">
              <LuChartBar className="h-3.5 w-3.5" /> Funil
            </button>
            <button onClick={() => setShowFeed(true)}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:border-brand-300 transition-colors">
              <LuActivity className="h-3.5 w-3.5" /> Feed
            </button>
            <button onClick={() => setNewModal(true)}
              className="flex shrink-0 items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 shadow-sm">
              <LuPlus className="h-4 w-4" /> Novo Lead
            </button>
          </div>
        </div>

        {/* Archive banners */}
        {oldEnrolled.length > 0 && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20 px-4 py-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <LuArchive className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                <span className="font-semibold">{oldEnrolled.length} matrícula{oldEnrolled.length > 1 ? 's' : ''}</span> de meses anteriores.
                Inicie <span className="font-semibold capitalize">{monthName}</span> arquivando-as.
              </p>
            </div>
            <button onClick={handleArchiveEnrolled} disabled={archiving}
              className="shrink-0 flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50">
              <LuArchive className="h-3.5 w-3.5" />{archiving ? 'Arquivando...' : 'Arquivar'}
            </button>
          </div>
        )}
        {oldLost.length > 0 && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/40 px-4 py-3 shrink-0">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <LuArchive className="inline h-4 w-4 text-gray-500 mr-1.5" />
              <span className="font-semibold">{oldLost.length} lead{oldLost.length > 1 ? 's' : ''} perdido{oldLost.length > 1 ? 's' : ''}</span> de meses anteriores.
            </p>
            <button onClick={handleArchiveLost} disabled={archivingLost}
              className="shrink-0 flex items-center gap-1.5 rounded-lg bg-gray-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50">
              <LuArchive className="h-3.5 w-3.5" />{archivingLost ? 'Arquivando...' : 'Arquivar perdidos'}
            </button>
          </div>
        )}

        {/* Métricas */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 shrink-0">
          {[
            { label: 'Leads ativos',    value: active.length, color: 'text-brand-600',  bg: 'bg-brand-50 dark:bg-brand-950/20 border-brand-100 dark:border-brand-900' },
            { label: 'Em Experimental', value: experimental,  color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/20 border-violet-100 dark:border-violet-900' },
            { label: 'Matriculados',    value: enrolled,      color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-950/20 border-green-100 dark:border-green-900' },
            { label: 'Perdidos',        value: lost,          color: 'text-gray-600',   bg: 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700' },
            { label: 'Contatos vencidos', value: overdueToday, color: overdueToday > 0 ? 'text-red-600' : 'text-gray-500', bg: overdueToday > 0 ? 'bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900' : 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700' },
          ].map(m => (
            <div key={m.label} className={`rounded-xl border p-4 ${m.bg}`}>
              <p className="text-xs text-gray-500 dark:text-gray-400">{m.label}</p>
              <p className={`text-2xl font-bold mt-1 ${m.color}`}>{m.value}</p>
            </div>
          ))}
        </div>

        {/* Filtros de estágio + busca global */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button onClick={() => { setFilter('ALL'); setListSearch('') }}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors flex items-center gap-1.5 ${
              filter === 'ALL' ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 border-transparent' : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400'
            }`}>
            <LuLayoutDashboard className="h-3 w-3" /> Todos ({leads.length})
          </button>
          {STAGES.map(s => {
            const cnt = leads.filter(l => l.stage === s.key).length
            return (
              <button key={s.key} onClick={() => { setFilter(s.key); setListSearch(''); setGlobalSearch('') }}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  filter === s.key ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 border-transparent' : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400'
                }`}>
                {filter === s.key && <LuList className="h-3 w-3" />}
                {s.label} ({cnt})
              </button>
            )
          })}
          {/* Busca global (só no modo ALL) */}
          {!isListMode && (
            <div className="relative ml-auto">
              <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input value={globalSearch} onChange={e => setGlobalSearch(e.target.value)}
                placeholder="Buscar em todos os leads..."
                className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 pl-8 pr-8 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:text-white w-56" />
              {globalSearch && (
                <button onClick={() => setGlobalSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <LuX className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand-500" /></div>
        ) : isGlobalSearchMode ? (
          /* --- Resultado da busca global --- */
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <LuFilter className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-500">{globalLeads.length} resultado{globalLeads.length !== 1 ? 's' : ''} para "<strong>{globalSearch}</strong>"</span>
            </div>
            {globalLeads.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <LuSearch className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nenhum lead encontrado.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {globalLeads.map(lead => {
                  const sc = STAGE_MAP[lead.stage]
                  return (
                    <div key={lead.id} onClick={() => setOpenLead(lead)}
                      className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 cursor-pointer hover:border-brand-300 hover:shadow-sm transition-all">
                      <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${sc?.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">{lead.name}</span>
                          <span className="text-xs text-gray-400 rounded-full border border-gray-200 dark:border-gray-700 px-2 py-0.5">{sc?.label}</span>
                          {lead.score != null && <ScoreBadge score={lead.score} temperature={lead.temperature ?? 'FRIO'} />}
                        </div>
                        <div className="flex gap-3 mt-0.5 text-xs text-gray-400">
                          {lead.student_name && <span>Aluno: {lead.student_name}</span>}
                          {lead.phone && <span><LuPhone className="inline h-3 w-3 mr-0.5" />{lead.phone}</span>}
                          {lead.email && <span>{lead.email}</span>}
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">{SOURCE_LABELS[lead.source]}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : isListMode ? (
          /* --- Lista por estágio --- */
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {stageCfgActive && (
                <div className="flex items-center gap-2">
                  <span className={`h-3 w-3 rounded-full ${stageCfgActive.dot}`} />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{stageCfgActive.label}</span>
                  <span className="rounded-full bg-gray-200 dark:bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-400">{listLeads.length}</span>
                </div>
              )}
              <div className="relative flex-1 max-w-xs">
                <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input value={listSearch} onChange={e => setListSearch(e.target.value)}
                  placeholder="Pesquisar..."
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:text-white" />
                {listSearch && (
                  <button onClick={() => setListSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><LuX className="h-3.5 w-3.5" /></button>
                )}
              </div>
            </div>
            {listLeads.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <LuSearch className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">{listSearch ? 'Nenhum resultado.' : 'Nenhum lead neste estágio.'}</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {listLeads.map(lead => (
                  <LeadCard key={lead.id} lead={lead} onOpen={setOpenLead}
                    onDragStart={handleDragStart} onInlineUpdate={handleInlineUpdate} onInlineDelete={handleInlineDelete} />
                ))}
              </div>
            )}
          </div>
        ) : (
          /* --- Kanban --- */
          <div ref={boardRef} onDragOver={handleBoardDragOver}
            className="flex gap-4 overflow-x-auto scroll-smooth pb-6" style={{ minHeight: '60vh' }}>
            {STAGES.map(stage => {
              const stageLeads = leads.filter(l => l.stage === stage.key)
              const isOver = dragOver === stage.key
              const oldCount = stage.key === 'MATRICULADO' ? oldEnrolled.length : stage.key === 'PERDIDO' ? oldLost.length : 0
              return (
                <div key={stage.key}
                  onDragOver={e => { e.preventDefault(); setDragOver(stage.key) }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={e => handleDrop(e, stage.key)}
                  className={`flex-shrink-0 w-72 flex flex-col rounded-2xl border-t-4 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 transition-all ${stage.color} ${
                    isOver ? `ring-2 ${stage.dropRing} ring-offset-2 scale-[1.01] bg-gray-100 dark:bg-gray-800` : ''
                  }`}>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${stage.dot}`} />
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{stage.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {oldCount > 0 && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                          stage.key === 'MATRICULADO' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-gray-200 text-gray-600 border-gray-300'
                        }`}>{oldCount} ant.</span>
                      )}
                      <span className="rounded-full bg-gray-200 dark:bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-400">{stageLeads.length}</span>
                    </div>
                  </div>
                  {isOver && stageLeads.length === 0 && (
                    <div className="mx-3 mt-3 rounded-xl border-2 border-dashed border-gray-300 p-4 text-center text-xs text-gray-400">Solte aqui</div>
                  )}
                  <div className="flex-1 overflow-y-auto p-3 space-y-2.5" style={{ maxHeight: '65vh' }}>
                    {stageLeads.length === 0 && !isOver
                      ? <p className="text-center text-xs text-gray-400 py-8 italic">Sem leads aqui</p>
                      : stageLeads.map(lead => (
                        <LeadCard key={lead.id} lead={lead} onOpen={setOpenLead}
                          onDragStart={handleDragStart} onInlineUpdate={handleInlineUpdate} onInlineDelete={handleInlineDelete} />
                      ))
                    }
                    {isOver && stageLeads.length > 0 && (
                      <div className="rounded-xl border-2 border-dashed border-gray-300 p-3 text-center text-xs text-gray-400">Solte aqui</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Modais */}
        {openLead && (
          <LeadModal lead={openLead} onClose={() => setOpenLead(null)}
            onDelete={handleDelete} onRefresh={handleRefreshLead}
            authFetch={authFetch} apiBase={apiBase} />
        )}
        {newModal && (
          <NewLeadModal onClose={() => setNewModal(false)}
            onCreated={l => { setLeads(ls => [normalizeLead(l), ...ls]); setNewModal(false) }}
            authFetch={authFetch} apiBase={apiBase} />
        )}
        {showFeed    && <FeedPanel authFetch={authFetch} apiBase={apiBase} onClose={() => setShowFeed(false)} />}
        {showFunnel  && <FunnelPanel authFetch={authFetch} apiBase={apiBase} onClose={() => setShowFunnel(false)} />}
        {showArchive && (
          <ArchivedPanel authFetch={authFetch} apiBase={apiBase} onClose={() => setShowArchive(false)}
            onOpenLead={lead => { setOpenLead(normalizeLead(lead)); setShowArchive(false) }}
            onReactivated={() => load()} />
        )}
      </div>
    </>
  )
}
