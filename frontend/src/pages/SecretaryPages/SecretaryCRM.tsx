import { useEffect, useState, useRef, useCallback } from 'react'
import {
  LuPlus, LuX, LuPhone, LuMail, LuSearch,
  LuMessageSquare, LuCalendarDays, LuCheck, LuClock,
  LuTrash2, LuPencil, LuCircleAlert, LuBookOpen, LuArchive, LuSave,
  LuBell, LuList, LuLayoutDashboard, LuActivity, LuFilter,
} from 'react-icons/lu'
import { useAuth } from '../../hooks/useAuth'
import PageMeta from '../../components/common/PageMeta'
import { useCountdown, formatCountdown, countdownColor } from '../../hooks/useCountdown'

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = 'NOVO' | 'CONTATO' | 'EXPERIMENTAL' | 'PROPOSTA' | 'MATRICULADO' | 'PERDIDO'
type Source = 'INDICACAO' | 'INSTAGRAM' | 'GOOGLE' | 'SITE' | 'OUTRO'
type ActivityType = 'LIGACAO' | 'MENSAGEM' | 'EMAIL' | 'AULA_EXP' | 'NOTA' | 'FOLLOW_UP'

type Lead = {
  id: number; name: string; phone: string | null; email: string | null
  student_name: string | null; age_range: string | null
  source: Source; stage: Stage; lost_reason: string | null; notes: string | null
  assigned_to: number | null; assigned_name: string | null
  archived: number; enrolled_at: string | null; lost_at: string | null
  follow_up_at: string | null
  total_activities: number; pending_followups: number; done_followups: number; next_followup: string | null
  next_exp_class: string | null; pending_exp_classes: number; done_exp_classes: number
  created_at: string; updated_at: string
}

type Activity = {
  id: number; lead_id: number; type: ActivityType; description: string
  scheduled_at: string | null; done: number; created_by: number | null
  created_by_name: string | null; created_at: string
}

type StageLog = {
  id: number; lead_id: number; from_stage: string | null; to_stage: string
  changed_by: number | null; changed_by_name: string | null
  note: string | null; created_at: string; lead_name?: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const STAGES: { key: Stage; label: string; color: string; dot: string; dropRing: string }[] = [
  { key: 'NOVO',         label: 'Novo Lead',    color: 'border-t-blue-400',   dot: 'bg-blue-400',   dropRing: 'ring-blue-400' },
  { key: 'CONTATO',      label: 'Em Contato',   color: 'border-t-amber-400',  dot: 'bg-amber-400',  dropRing: 'ring-amber-400' },
  { key: 'EXPERIMENTAL', label: 'Experimental', color: 'border-t-violet-400', dot: 'bg-violet-400', dropRing: 'ring-violet-400' },
  { key: 'PROPOSTA',     label: 'Proposta',     color: 'border-t-orange-400', dot: 'bg-orange-400', dropRing: 'ring-orange-400' },
  { key: 'MATRICULADO',  label: 'Matriculado',  color: 'border-t-green-400',  dot: 'bg-green-400',  dropRing: 'ring-green-400' },
  { key: 'PERDIDO',      label: 'Perdido',      color: 'border-t-gray-400',   dot: 'bg-gray-400',   dropRing: 'ring-gray-400' },
]

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
}

const inputCls = 'w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/30'
const inputSmCls = 'w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/30'

const fmtDate = (d: string) => new Date(d).toLocaleString('pt-BR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })

// ─── Lead Card ────────────────────────────────────────────────────────────────

function LeadCard({ lead, onOpen, onDragStart, onInlineUpdate, onInlineDelete }: {
  lead: Lead; onOpen: (l: Lead) => void
  onDragStart: (e: React.DragEvent, lead: Lead) => void
  onInlineUpdate: (id: number, patch: Partial<Lead>) => Promise<void>
  onInlineDelete: (id: number) => Promise<void>
}) {
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState({ name: lead.name, phone: lead.phone||'', email: lead.email||'', stage: lead.stage, notes: lead.notes||'' })

  const followUpCd   = useCountdown(lead.follow_up_at)
  const nextFollowCd = useCountdown(lead.next_followup)
  const expCd        = useCountdown(lead.stage === 'EXPERIMENTAL' ? lead.next_exp_class : null)
  const hasAnyExp    = lead.done_exp_classes > 0 || lead.pending_exp_classes > 0
  const initials = lead.assigned_name
    ? lead.assigned_name.split(' ').map((w: string) => w[0]).slice(0,2).join('').toUpperCase() : null

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation(); setSaving(true)
    await onInlineUpdate(lead.id, form)
    setSaving(false); setEditMode(false)
  }
  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm(`Remover lead "${lead.name}"?`)) return
    setDeleting(true); await onInlineDelete(lead.id); setDeleting(false)
  }
  const stageCfg = STAGES.find(s => s.key === lead.stage)!

  return (
    <div draggable={!editMode} onDragStart={e => !editMode && onDragStart(e, lead)}
      onClick={() => !editMode && onOpen(lead)}
      className={`rounded-xl border bg-white dark:bg-gray-900 shadow-sm transition-all select-none ${
        editMode ? 'border-brand-300 dark:border-brand-700 ring-2 ring-brand-500/20 cursor-default'
                 : 'border-gray-200 dark:border-gray-700 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-brand-300'
      }`}>
      {!editMode && (
        <div className="p-3.5 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-900 dark:text-white leading-tight truncate">{lead.name}</p>
              {lead.student_name && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Aluno: {lead.student_name}</p>}
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{SOURCE_LABELS[lead.source]}</span>
          </div>

          {(lead.phone || lead.email) && (
            <div className="flex flex-wrap gap-2">
              {lead.phone && (
                <a href={`https://wa.me/55${lead.phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-xs text-green-600 hover:underline dark:text-green-400">
                  <LuPhone className="h-3 w-3" />{lead.phone}
                </a>
              )}
              {lead.email && <span className="inline-flex items-center gap-1 text-xs text-gray-400"><LuMail className="h-3 w-3" />{lead.email}</span>}
            </div>
          )}

          {/* Follow-up agendado (campo da lead) */}
          {followUpCd && followUpCd.type !== 'far' && (
            <div className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium border ${countdownColor(followUpCd)}`}>
              <LuBell className="h-3 w-3" />
              {followUpCd.type === 'overdue' ? 'Contato atrasado!' : `Contato em ${formatCountdown(followUpCd)}`}
            </div>
          )}

          {/* Próximo follow-up de atividade pendente */}
          {nextFollowCd && nextFollowCd.type !== 'far' && (
            <div className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium border ${countdownColor(nextFollowCd)}`}>
              <LuClock className="h-3 w-3" />
              {nextFollowCd.type === 'overdue' ? 'Follow-up atrasado!' : `Follow-up em ${formatCountdown(nextFollowCd)}`}
            </div>
          )}

          {/* Follow-ups concluídos (sem pendentes) */}
          {lead.done_followups > 0 && lead.pending_followups === 0 && !lead.next_followup && (
            <div className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium border bg-green-50 border-green-200 text-green-700 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400">
              <LuCheck className="h-3 w-3" />
              {lead.done_followups} follow-up{lead.done_followups > 1 ? 's' : ''} concluído{lead.done_followups > 1 ? 's' : ''}
            </div>
          )}

          {/* Aula experimental — pendente com countdown */}
          {lead.stage === 'EXPERIMENTAL' && expCd && expCd.type !== 'far' && (
            <div className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium border ${countdownColor(expCd)}`}>
              <LuBookOpen className="h-3 w-3" />
              {expCd.type === 'overdue' ? 'Aula exp. atrasada!' : `Aula exp. em ${formatCountdown(expCd)}`}
            </div>
          )}

          {/* Aulas experimentais concluídas (sem pendentes) */}
          {lead.stage === 'EXPERIMENTAL' && lead.done_exp_classes > 0 && lead.pending_exp_classes === 0 && (
            <div className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium border bg-green-50 border-green-200 text-green-700 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400">
              <LuCheck className="h-3 w-3" />
              {lead.done_exp_classes} aula{lead.done_exp_classes > 1 ? 's' : ''} exp. concluída{lead.done_exp_classes > 1 ? 's' : ''}
            </div>
          )}

          {/* Nunca agendou aula experimental */}
          {lead.stage === 'EXPERIMENTAL' && !hasAnyExp && (
            <div className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium border bg-violet-50 border-violet-200 text-violet-600 dark:bg-violet-950/30 dark:border-violet-800 dark:text-violet-400">
              <LuCircleAlert className="h-3 w-3" /> Agendar aula experimental
            </div>
          )}

          <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800">
            <span className="text-xs text-gray-400">{lead.total_activities} interaç{lead.total_activities === 1 ? 'ão' : 'ões'}</span>
            {initials ? (
              <span title={lead.assigned_name ?? ''} className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 dark:bg-brand-950/30 px-2 py-0.5 text-xs font-medium text-brand-700 dark:text-brand-400 border border-brand-200 dark:border-brand-800">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-white text-[9px] font-bold leading-none shrink-0">{initials}</span>
                {lead.assigned_name?.split(' ')[0]}
              </span>
            ) : <span className="text-xs text-gray-300 italic">sem responsável</span>}
          </div>

          <div className="flex items-center gap-1.5 pt-0.5 border-t border-gray-100 dark:border-gray-800">
            <button onClick={e => { e.stopPropagation(); setForm({ name: lead.name, phone: lead.phone||'', email: lead.email||'', stage: lead.stage, notes: lead.notes||'' }); setEditMode(true) }}
              className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 py-1 text-xs text-gray-500 hover:border-brand-300 hover:text-brand-600 transition-colors">
              <LuPencil className="h-3 w-3" /> Editar
            </button>
            <button onClick={handleDelete} disabled={deleting}
              className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 py-1 text-xs text-gray-500 hover:border-red-300 hover:text-red-500 transition-colors disabled:opacity-50">
              <LuTrash2 className="h-3 w-3" /> {deleting ? '...' : 'Deletar'}
            </button>
          </div>
        </div>
      )}

      {editMode && (
        <div className="p-3.5 space-y-2.5" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-brand-700 dark:text-brand-400 uppercase tracking-wide">Editando</span>
            <button onClick={e => { e.stopPropagation(); setEditMode(false) }} className="rounded p-0.5 text-gray-400 hover:text-gray-600"><LuX className="h-3.5 w-3.5" /></button>
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
          <div><label className="block text-[10px] font-medium text-gray-500 mb-0.5">Observações</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={`${inputSmCls} resize-none`} /></div>
          <div className="flex gap-1.5">
            <button onClick={e => { e.stopPropagation(); setEditMode(false) }} className="flex-1 rounded-lg border border-gray-300 py-1.5 text-xs text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button onClick={handleSave} disabled={saving || !form.name.trim()} className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-brand-500 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50">
              <LuSave className="h-3 w-3" /> {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
          <div className="flex items-center gap-1.5 pt-1">
            <span className={`h-2 w-2 rounded-full ${STAGES.find(s=>s.key===form.stage)?.dot}`} />
            <span className="text-xs text-gray-400">{stageCfg.label}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Lead Modal ───────────────────────────────────────────────────────────────

function LeadModal({ lead, onClose, onDelete, onRefresh, authFetch, apiBase }: {
  lead: Lead; onClose: () => void
  onDelete: (id: number) => void
  onRefresh: (id: number) => Promise<void>
  authFetch: (i: RequestInfo, init?: RequestInit) => Promise<Response>
  apiBase?: string
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
  const [activeTab, setActiveTab]   = useState<'atividades' | 'historico'>('atividades')
  const [logFilter, setLogFilter]   = useState<string>('TODOS')

  const stageCfg = STAGES.find(s => s.key === lead.stage)!

  useEffect(() => {
    authFetch(`${apiBase}/crm/leads/${lead.id}/activities`)
      .then(r => r.json())
      .then(data => {
        if (data.activities) { setActivities(data.activities); setLogs(data.logs || []) }
        else setActivities(data)
      })
      .finally(() => setLoadingActs(false))
  }, [lead.id, authFetch, apiBase])

  const saveEdit = async () => {
    setSaving(true)
    const res = await authFetch(`${apiBase}/crm/leads/${lead.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    if (res.ok) { await onRefresh(lead.id); setEditing(false) }
    setSaving(false)
  }

  const addActivity = async () => {
    if (!actDesc.trim()) return
    setSavingAct(true)
    const res = await authFetch(`${apiBase}/crm/leads/${lead.id}/activities`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: actType, description: actDesc, scheduled_at: actDate || null }),
    })
    if (res.ok) {
      const newAct = await res.json()
      setActivities(a => [newAct, ...a])
      setActDesc(''); setActDate('')
      await onRefresh(lead.id)
    }
    setSavingAct(false)
  }

  const toggleAct = async (act: Activity) => {
    const res = await authFetch(`${apiBase}/crm/activities/${act.id}/toggle`, { method: 'PATCH' })
    if (res.ok) {
      const updated = await res.json()
      setActivities(acts => acts.map(x => x.id === act.id ? { ...x, done: updated.done } : x))
      await onRefresh(lead.id)
    }
  }

  const filteredLogs = logFilter === 'TODOS' ? logs
    : logs.filter(l => l.to_stage === logFilter || l.from_stage === logFilter)

  const LOG_FILTER_OPTIONS = [
    { value: 'TODOS', label: 'Todos' },
    { value: 'CRIACAO', label: 'Criação' },
    ...STAGES.map(s => ({ value: s.key, label: s.label })),
    { value: 'ATIVIDADE', label: 'Atividades' },
    { value: 'FOLLOW_UP_AGENDADO', label: 'Follow-ups' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/50 p-4" onClick={onClose}>
      <div className="h-full w-full max-w-lg overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${stageCfg.dot}`} />
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{stageCfg.label}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setEditing(v => !v)}
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
          {/* Edit form */}
          {editing ? (
            <div className="space-y-3 rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50/40 dark:bg-brand-950/10 p-4">
              <p className="text-xs font-semibold text-brand-700 dark:text-brand-400 uppercase tracking-wide">Editando</p>
              {([['name','Nome *','text'],['phone','Telefone / WhatsApp','text'],['email','E-mail','email'],
                ['student_name','Nome do aluno','text'],['age_range','Faixa etária','text']] as [string,string,string][]).map(([k,lbl,t]) => (
                <div key={k}>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{lbl}</label>
                  <input type={t} value={(form as Record<string,unknown>)[k] as string || ''}
                    onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} className={inputCls} />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Origem</label>
                  <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value as Source }))} className={inputCls}>
                    {Object.entries(SOURCE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                  </select></div>
                <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Estágio</label>
                  <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value as Stage }))} className={inputCls}>
                    {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select></div>
              </div>
              {form.stage === 'PERDIDO' && (
                <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Motivo da perda</label>
                  <input value={form.lost_reason || ''} onChange={e => setForm(f => ({ ...f, lost_reason: e.target.value }))} className={inputCls} /></div>
              )}
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">📅 Agendar contato</label>
                <input type="datetime-local" value={form.follow_up_at?.slice(0,16) || ''}
                  onChange={e => setForm(f => ({ ...f, follow_up_at: e.target.value || null }))} className={inputCls} /></div>
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Observações</label>
                <textarea value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={inputCls} /></div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditing(false)} className="rounded-xl border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300">Cancelar</button>
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
              {lead.follow_up_at && (
                <div className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm border ${
                  new Date(lead.follow_up_at) < new Date()
                    ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400'
                    : 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-400'
                }`}>
                  <LuBell className="h-4 w-4" />
                  Contato agendado: {fmtDate(lead.follow_up_at)}
                </div>
              )}
              {lead.notes && <p className="text-sm text-gray-600 dark:text-gray-400 italic">{lead.notes}</p>}
              {lead.lost_reason && <p className="text-sm text-red-600">Motivo da perda: {lead.lost_reason}</p>}
              <span className="inline-block rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-xs text-gray-600 dark:text-gray-400">{SOURCE_LABELS[lead.source]}</span>
            </div>
          )}

          {/* Registrar interação */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Registrar interação</p>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(ACT_LABELS) as ActivityType[]).map(t => (
                <button key={t} onClick={() => setActType(t)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                    actType === t ? 'bg-brand-100 border-brand-300 text-brand-700 dark:bg-brand-900/40 dark:border-brand-700 dark:text-brand-300'
                                  : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400'
                  }`}>
                  {ACT_ICONS[t]} {ACT_LABELS[t]}
                </button>
              ))}
            </div>
            <textarea value={actDesc} onChange={e => setActDesc(e.target.value)} rows={2}
              placeholder={actType === 'FOLLOW_UP' ? 'Descreva o que deve ser feito...' : 'O que aconteceu?'}
              className={`${inputCls} resize-none`} />
            {(actType === 'FOLLOW_UP' || actType === 'AULA_EXP') && (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
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

          {/* Tabs: Atividades / Histórico */}
          <div>
            <div className="flex gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1 mb-4">
              {[['atividades','Atividades'],['historico','Histórico & Logs']] .map(([key, label]) => (
                <button key={key} onClick={() => setActiveTab(key as 'atividades' | 'historico')}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                    activeTab === key ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                  }`}>{label}
                </button>
              ))}
            </div>

            {/* Atividades */}
            {activeTab === 'atividades' && (
              loadingActs ? <div className="flex justify-center py-6"><div className="h-5 w-5 animate-spin rounded-full border-b-2 border-brand-500" /></div>
              : activities.length === 0 ? <p className="text-xs text-gray-400 text-center py-4 italic">Nenhuma interação registrada.</p>
              : <div className="space-y-2">
                {activities.map(act => {
                  const isOverdue = act.scheduled_at && new Date(act.scheduled_at) < new Date() && !act.done
                  return (
                    <div key={act.id} className={`rounded-xl border p-3 space-y-1.5 transition-opacity ${act.done ? 'opacity-60' : ''} ${
                      isOverdue ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20'
                                : 'border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50'
                    }`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-500">{ACT_ICONS[act.type]}</span>
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{ACT_LABELS[act.type]}</span>
                          {isOverdue && <LuCircleAlert className="h-3.5 w-3.5 text-red-500" />}
                        </div>
                        {act.scheduled_at && (
                          <button onClick={() => toggleAct(act)}
                            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border transition-colors ${
                              act.done ? 'bg-green-100 border-green-200 text-green-700' : 'border-gray-200 text-gray-500 hover:bg-gray-100'
                            }`}>
                            {act.done ? <><LuCheck className="h-3 w-3" /> Feito</> : <><LuClock className="h-3 w-3" /> Pendente</>}
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{act.description}</p>
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>{act.created_by_name && `por ${act.created_by_name} · `}{fmtDate(act.created_at)}</span>
                        {act.scheduled_at && <span className={isOverdue ? 'text-red-500' : ''}><LuCalendarDays className="inline h-3 w-3 mr-0.5" />{fmtDate(act.scheduled_at)}</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Histórico */}
            {activeTab === 'historico' && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {LOG_FILTER_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setLogFilter(opt.value)}
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                        logFilter === opt.value ? 'bg-gray-900 text-white border-transparent dark:bg-white dark:text-gray-900'
                                               : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400'
                      }`}>{opt.label}</button>
                  ))}
                </div>
                {filteredLogs.length === 0 ? <p className="text-xs text-gray-400 text-center py-4 italic">Nenhum registro encontrado.</p>
                : <div className="space-y-2">
                  {filteredLogs.map(log => (
                    <div key={log.id} className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {log.from_stage && log.to_stage !== 'ATIVIDADE' && log.to_stage !== 'FOLLOW_UP_AGENDADO' ? (
                            <>
                              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{LOG_LABELS[log.from_stage] || log.from_stage}</span>
                              <span className="text-gray-400 text-xs">→</span>
                              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{LOG_LABELS[log.to_stage] || log.to_stage}</span>
                            </>
                          ) : (
                            <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{LOG_LABELS[log.to_stage] || log.to_stage}</span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 shrink-0">{fmtDate(log.created_at)}</span>
                      </div>
                      {log.note && <p className="text-xs text-gray-500 dark:text-gray-400 italic">{log.note}</p>}
                      {log.changed_by_name && <p className="text-xs text-gray-400">por {log.changed_by_name}</p>}
                    </div>
                  ))}
                </div>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── New Lead Modal ───────────────────────────────────────────────────────────

function NewLeadModal({ onClose, onCreated, authFetch, apiBase }: {
  onClose: () => void; onCreated: (l: Lead) => void
  authFetch: (i: RequestInfo, init?: RequestInit) => Promise<Response>
  apiBase?: string
}) {
  const [form, setForm] = useState({ name:'', phone:'', email:'', student_name:'', age_range:'', source:'OUTRO' as Source, notes:'' })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string|null>(null)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async () => {
    if (!form.name.trim()) return setError('Nome é obrigatório')
    setSaving(true); setError(null)
    const res = await authFetch(`${apiBase}/crm/leads`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    if (res.ok) { onCreated(await res.json()); onClose() }
    else { const b = await res.json().catch(()=>{}); setError(b?.error || 'Erro ao criar lead') }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Novo Lead</h2>
          <button onClick={onClose}><LuX className="h-5 w-5 text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-3 max-h-[70vh] overflow-y-auto">
          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
          {([['name','Nome do responsável / contato *'],['phone','Telefone / WhatsApp'],['email','E-mail'],
            ['student_name','Nome do futuro aluno'],['age_range','Faixa etária (ex: 6-8 anos, Adulto)']] as [string,string][]).map(([k,lbl]) => (
            <div key={k}>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{lbl}</label>
              <input value={(form as Record<string,string>)[k]} onChange={set(k)} className={inputCls} />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Como nos encontrou?</label>
            <select value={form.source} onChange={set('source')} className={inputCls}>
              {Object.entries(SOURCE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Observações</label>
            <textarea value={form.notes} onChange={set('notes')} rows={2} className={`${inputCls} resize-none`} />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
          <button onClick={onClose} className="rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300">Cancelar</button>
          <button onClick={submit} disabled={saving} className="rounded-xl bg-brand-500 px-5 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
            {saving ? 'Criando...' : 'Criar Lead'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Feed Panel ───────────────────────────────────────────────────────────────

function FeedPanel({ authFetch, apiBase, onClose }: {
  authFetch: (i: RequestInfo, init?: RequestInit) => Promise<Response>
  apiBase?: string; onClose: () => void
}) {
  const [feed, setFeed]       = useState<StageLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('TODOS')

  useEffect(() => {
    authFetch(`${apiBase}/crm/feed`).then(r => r.json()).then(setFeed).finally(() => setLoading(false))
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
            {['TODOS','NOVO','CONTATO','EXPERIMENTAL','PROPOSTA','MATRICULADO','PERDIDO','ATIVIDADE','FOLLOW_UP_AGENDADO'].map(f => (
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
          : filteredFeed.length === 0 ? <p className="text-center text-sm text-gray-400 py-10 italic">Nenhuma atividade encontrada.</p>
          : filteredFeed.map(log => (
            <div key={log.id} className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{log.lead_name}</span>
                <span className="text-xs text-gray-400 shrink-0">{fmtDate(log.created_at)}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {log.from_stage && log.to_stage !== 'ATIVIDADE' && log.to_stage !== 'FOLLOW_UP_AGENDADO' ? (
                  <><span className="text-xs text-gray-500">{LOG_LABELS[log.from_stage] || log.from_stage}</span>
                  <span className="text-gray-400 text-xs">→</span>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{LOG_LABELS[log.to_stage] || log.to_stage}</span></>
                ) : <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{LOG_LABELS[log.to_stage] || log.to_stage}</span>}
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SecretaryCRM({ apiBase = '/secretary' }: { apiBase?: string }) {
  const { authFetch } = useAuth()
  const [leads, setLeads]         = useState<Lead[]>([])
  const [loading, setLoading]     = useState(true)
  const [openLead, setOpenLead]   = useState<Lead | null>(null)
  const [newModal, setNewModal]   = useState(false)
  const [showFeed, setShowFeed]   = useState(false)
  const [filter, setFilter]       = useState<Stage | 'ALL'>('ALL')
  const [listSearch, setListSearch] = useState('')
  const [archiving, setArchiving] = useState(false)
  const [archivingLost, setArchivingLost] = useState(false)

  const dragLeadId = useRef<number | null>(null)
  const [dragOver, setDragOver]   = useState<Stage | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)

  const isListMode = filter !== 'ALL'

  const load = useCallback(async () => {
    setLoading(true)
    const res = await authFetch(`${apiBase}/crm/leads`)
    if (res.ok) {
      const data: Lead[] = await res.json()
      setLeads(data.map(l => ({
        ...l,
        total_activities:    Number(l.total_activities    ?? 0),
        pending_followups:   Number(l.pending_followups   ?? 0),
        done_followups:      Number(l.done_followups      ?? 0),
        pending_exp_classes: Number(l.pending_exp_classes ?? 0),
        done_exp_classes:    Number(l.done_exp_classes    ?? 0),
      })))
    }
    setLoading(false)
  }, [authFetch, apiBase])

  useEffect(() => { load() }, [load])

  // ── Drag handlers ──
  const handleDragStart = (e: React.DragEvent, lead: Lead) => {
    dragLeadId.current = lead.id
    e.dataTransfer.effectAllowed = 'move'
    const ghost = e.currentTarget as HTMLElement
    ghost.style.opacity = '0.5'
    setTimeout(() => { ghost.style.opacity = '1' }, 0)
  }

  const handleDrop = async (e: React.DragEvent, stage: Stage) => {
    e.preventDefault(); setDragOver(null)
    const id = dragLeadId.current; dragLeadId.current = null
    if (!id) return
    const lead = leads.find(l => l.id === id)
    if (!lead || lead.stage === stage) return
    setLeads(ls => ls.map(l => l.id === id ? { ...l, stage } : l))
    const res = await authFetch(`${apiBase}/crm/leads/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage }),
    })
    if (!res.ok) setLeads(ls => ls.map(l => l.id === id ? { ...l, stage: lead.stage } : l))
  }

  const handleBoardDragOver = (e: React.DragEvent) => {
    if (!boardRef.current) return
    const rect = boardRef.current.getBoundingClientRect()
    const edge = 120; const speed = 20
    if (e.clientX < rect.left + edge) boardRef.current.scrollBy({ left: -speed })
    if (e.clientX > rect.right - edge) boardRef.current.scrollBy({ left: speed })
  }

  // ── CRUD handlers ──
  const handleInlineUpdate = async (id: number, patch: Partial<Lead>) => {
    const res = await authFetch(`${apiBase}/crm/leads/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    })
    if (res.ok) { const updated = await res.json(); setLeads(ls => ls.map(l => l.id === id ? { ...l, ...updated } : l)) }
  }

  const handleInlineDelete = async (id: number) => {
    const res = await authFetch(`${apiBase}/crm/leads/${id}`, { method: 'DELETE' })
    if (res.ok) { setLeads(ls => ls.filter(l => l.id !== id)); if (openLead?.id === id) setOpenLead(null) }
  }

  const handleRefreshLead = async (id: number) => {
    const res = await authFetch(`${apiBase}/crm/leads`)
    if (res.ok) {
      const data: Lead[] = await res.json()
      const fresh = data.find(l => l.id === id)
      if (fresh) {
        const normalized = { ...fresh, total_activities: Number(fresh.total_activities ?? 0), pending_followups: Number(fresh.pending_followups ?? 0), done_followups: Number(fresh.done_followups ?? 0), pending_exp_classes: Number(fresh.pending_exp_classes ?? 0), done_exp_classes: Number(fresh.done_exp_classes ?? 0) }
        setLeads(ls => ls.map(l => l.id === id ? normalized : l))
        setOpenLead(normalized)
      }
    }
  }
  const handleDelete  = async (id: number) => {
    const res = await authFetch(`${apiBase}/crm/leads/${id}`, { method: 'DELETE' })
    if (res.ok) { setLeads(ls => ls.filter(l => l.id !== id)); setOpenLead(null) }
  }

  // ── Archive ──
  const nowMonth = new Date().getMonth(); const nowYear = new Date().getFullYear()
  const isOldDate = (d: string | null) => { if (!d) return false; const dt = new Date(d); return dt.getFullYear() < nowYear || (dt.getFullYear() === nowYear && dt.getMonth() < nowMonth) }
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

  // ── Metrics ──
  const active       = leads.filter(l => !['MATRICULADO','PERDIDO'].includes(l.stage))
  const enrolled     = leads.filter(l => l.stage === 'MATRICULADO').length
  const experimental = leads.filter(l => l.stage === 'EXPERIMENTAL').length
  const lost         = leads.filter(l => l.stage === 'PERDIDO').length
  const followUpsToday = leads.filter(l => l.follow_up_at && new Date(l.follow_up_at).toDateString() === new Date().toDateString()).length
  const shownStages  = filter === 'ALL' ? STAGES : STAGES.filter(s => s.key === filter)
  const monthName    = new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' })

  // ── List mode filtered leads ──
  const listLeads = filter !== 'ALL' ? leads.filter(l => {
    if (l.stage !== filter) return false
    if (!listSearch.trim()) return true
    const q = listSearch.toLowerCase()
    return l.name.toLowerCase().includes(q)
      || (l.phone || '').toLowerCase().includes(q)
      || (l.email || '').toLowerCase().includes(q)
      || (l.student_name || '').toLowerCase().includes(q)
  }) : []

  const stageCfgActive = filter !== 'ALL' ? STAGES.find(s => s.key === filter) : null

  return (
    <>
      <PageMeta title="CRM | Secretaria" description="Pipeline de leads" />
      <div className="space-y-5 flex flex-col" style={{ minHeight: 0 }}>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">CRM — Pipeline de Leads</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {isListMode ? 'Modo lista — filtre e pesquise dentro do estágio selecionado.'
                          : 'Arraste os cards entre as colunas para avançar o lead no pipeline.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowFeed(true)}
              className="relative flex shrink-0 items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-brand-300 transition-colors">
              <LuActivity className="h-4 w-4" /> Feed
            </button>
            <button onClick={() => setNewModal(true)}
              className="flex shrink-0 items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 shadow-sm">
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
                <span className="font-semibold">{oldEnrolled.length} matrícula{oldEnrolled.length > 1 ? 's' : ''}</span> de meses anteriores no board.
                Inicie <span className="font-semibold capitalize">{monthName}</span> arquivando-as.
              </p>
            </div>
            <button onClick={handleArchiveEnrolled} disabled={archiving}
              className="shrink-0 flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50">
              <LuArchive className="h-3.5 w-3.5" />{archiving ? 'Arquivando...' : 'Arquivar agora'}
            </button>
          </div>
        )}
        {oldLost.length > 0 && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/40 px-4 py-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <LuArchive className="h-4 w-4 text-gray-500 shrink-0" />
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <span className="font-semibold">{oldLost.length} lead{oldLost.length > 1 ? 's' : ''} perdido{oldLost.length > 1 ? 's' : ''}</span> de meses anteriores.
              </p>
            </div>
            <button onClick={handleArchiveLost} disabled={archivingLost}
              className="shrink-0 flex items-center gap-1.5 rounded-lg bg-gray-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50">
              <LuArchive className="h-3.5 w-3.5" />{archivingLost ? 'Arquivando...' : 'Arquivar perdidos'}
            </button>
          </div>
        )}

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 shrink-0">
          {[
            { label:'Leads ativos',    value: active.length, color:'text-brand-600 dark:text-brand-400',   bg:'bg-brand-50 dark:bg-brand-950/20 border-brand-100 dark:border-brand-900' },
            { label:'Em Experimental', value: experimental,  color:'text-violet-600 dark:text-violet-400', bg:'bg-violet-50 dark:bg-violet-950/20 border-violet-100 dark:border-violet-900' },
            { label:'Matriculados',    value: enrolled,      color:'text-green-600 dark:text-green-400',   bg:'bg-green-50 dark:bg-green-950/20 border-green-100 dark:border-green-900' },
            { label:'Perdidos',        value: lost,          color:'text-gray-600 dark:text-gray-400',     bg:'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700' },
            { label:'Contatos hoje',   value: followUpsToday, color:'text-amber-600 dark:text-amber-400',  bg:'bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900' },
          ].map(m => (
            <div key={m.label} className={`rounded-xl border p-4 ${m.bg}`}>
              <p className="text-xs text-gray-500 dark:text-gray-400">{m.label}</p>
              <p className={`text-2xl font-bold mt-1 ${m.color}`}>{m.value}</p>
            </div>
          ))}
        </div>

        {/* Stage filter pills */}
        <div className="flex flex-wrap gap-1.5 shrink-0">
          <button onClick={() => { setFilter('ALL'); setListSearch('') }}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors flex items-center gap-1.5 ${filter === 'ALL' ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 border-transparent' : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400'}`}>
            <LuLayoutDashboard className="h-3 w-3" /> Todos ({leads.length})
          </button>
          {STAGES.map(s => {
            const cnt = leads.filter(l => l.stage === s.key).length
            return (
              <button key={s.key} onClick={() => { setFilter(s.key); setListSearch('') }}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors flex items-center gap-1.5 ${filter === s.key ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 border-transparent' : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400'}`}>
                {filter === s.key ? <LuList className="h-3 w-3" /> : null}
                {s.label} ({cnt})
              </button>
            )
          })}
        </div>

        {loading ? (
          <div className="flex justify-center py-20 shrink-0"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand-500" /></div>
        ) : isListMode ? (
          /* ── List mode ── */
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
                  placeholder="Pesquisar por nome, telefone, e-mail..."
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 pl-9 pr-4 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
                {listSearch && (
                  <button onClick={() => setListSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <LuX className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <LuFilter className="h-3.5 w-3.5" />
                {listSearch ? `${listLeads.length} resultado${listLeads.length !== 1 ? 's' : ''}` : `${listLeads.length} lead${listLeads.length !== 1 ? 's' : ''}`}
              </div>
            </div>
            {listLeads.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <LuSearch className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">{listSearch ? 'Nenhum resultado encontrado.' : 'Nenhum lead neste estágio.'}</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {listLeads.map(lead => (
                  <LeadCard key={lead.id} lead={lead} onOpen={setOpenLead}
                    onDragStart={handleDragStart}
                    onInlineUpdate={handleInlineUpdate}
                    onInlineDelete={handleInlineDelete} />
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ── Kanban mode ── */
          <div ref={boardRef} onDragOver={handleBoardDragOver}
            className="flex gap-4 overflow-x-auto scroll-smooth pb-6" style={{ minHeight: '60vh' }}>
            {shownStages.map(stage => {
              const stageLeads = leads.filter(l => l.stage === stage.key)
              const isOver     = dragOver === stage.key
              const isEnrolled = stage.key === 'MATRICULADO'
              const isLost     = stage.key === 'PERDIDO'
              const oldCount   = isEnrolled ? oldEnrolled.length : isLost ? oldLost.length : 0
              return (
                <div key={stage.key}
                  onDragOver={e => { e.preventDefault(); setDragOver(stage.key) }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={e => handleDrop(e, stage.key)}
                  className={`flex-shrink-0 w-72 flex flex-col rounded-2xl border-t-4 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 transition-all duration-150 ${stage.color} ${
                    isOver ? `ring-2 ${stage.dropRing} ring-offset-2 dark:ring-offset-gray-950 scale-[1.01] bg-gray-100 dark:bg-gray-800` : ''
                  }`}>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${stage.dot}`} />
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{stage.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {oldCount > 0 && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                          isEnrolled ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                                     : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600'
                        }`}>{oldCount} antigos</span>
                      )}
                      <span className="rounded-full bg-gray-200 dark:bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-400">{stageLeads.length}</span>
                    </div>
                  </div>
                  {isOver && stageLeads.length === 0 && (
                    <div className="mx-3 mt-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 p-4 text-center text-xs text-gray-400">Solte aqui</div>
                  )}
                  <div className="flex-1 overflow-y-auto p-3 space-y-2.5" style={{ maxHeight: '65vh' }}>
                    {stageLeads.length === 0 && !isOver ? (
                      <p className="text-center text-xs text-gray-400 py-8 italic">Sem leads aqui</p>
                    ) : stageLeads.map(lead => (
                      <LeadCard key={lead.id} lead={lead} onOpen={setOpenLead}
                        onDragStart={handleDragStart}
                        onInlineUpdate={handleInlineUpdate}
                        onInlineDelete={handleInlineDelete} />
                    ))}
                    {isOver && stageLeads.length > 0 && (
                      <div className="rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 p-3 text-center text-xs text-gray-400">Solte aqui</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {openLead && (
        <LeadModal lead={openLead} onClose={() => setOpenLead(null)}
          onDelete={handleDelete}
          onRefresh={handleRefreshLead}
          authFetch={authFetch} apiBase={apiBase} />
      )}
      {newModal && (
        <NewLeadModal onClose={() => setNewModal(false)}
          onCreated={l => setLeads(ls => [l, ...ls])} authFetch={authFetch} apiBase={apiBase} />
      )}
      {showFeed && (
        <FeedPanel authFetch={authFetch} apiBase={apiBase} onClose={() => setShowFeed(false)} />
      )}
    </>
  )
}
