import { useEffect, useState, useRef, useCallback } from 'react'
import {
  LuPlus, LuX, LuPhone, LuMail,
  LuMessageSquare, LuCalendarDays, LuCheck, LuClock,
  LuTrash2, LuPencil, LuCircleAlert, LuBookOpen, LuArchive, LuSave,
} from 'react-icons/lu'
import { useAuth } from '../../hooks/useAuth'
import PageMeta from '../../components/common/PageMeta'

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
  total_activities: number; pending_followups: number; next_followup: string | null
  created_at: string; updated_at: string
}

type Activity = {
  id: number; lead_id: number; type: ActivityType; description: string
  scheduled_at: string | null; done: number; created_by: number | null
  created_by_name: string | null; created_at: string
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

const inputCls = 'w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/30'
const inputSmCls = 'w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/30'

// ─── Lead Card (draggable + inline edit/delete) ───────────────────────────────

function LeadCard({ lead, onOpen, onDragStart, onInlineUpdate, onInlineDelete }: {
  lead: Lead
  onOpen: (l: Lead) => void
  onDragStart: (e: React.DragEvent, lead: Lead) => void
  onInlineUpdate: (id: number, patch: Partial<Lead>) => Promise<void>
  onInlineDelete: (id: number) => Promise<void>
}) {
  const [editMode, setEditMode]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState(false)
  const [form, setForm]           = useState({
    name: lead.name,
    phone: lead.phone || '',
    email: lead.email || '',
    stage: lead.stage,
    notes: lead.notes || '',
  })

  const now     = new Date()
  const overdue = lead.next_followup && new Date(lead.next_followup) < now && lead.pending_followups > 0
  const initials = lead.assigned_name
    ? lead.assigned_name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : null

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setSaving(true)
    await onInlineUpdate(lead.id, form)
    setSaving(false)
    setEditMode(false)
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm(`Remover lead "${lead.name}"?`)) return
    setDeleting(true)
    await onInlineDelete(lead.id)
    setDeleting(false)
  }

  const stageCfg = STAGES.find(s => s.key === lead.stage)!

  return (
    <div
      draggable={!editMode}
      onDragStart={e => !editMode && onDragStart(e, lead)}
      onClick={() => !editMode && onOpen(lead)}
      className={`rounded-xl border bg-white dark:bg-gray-900 shadow-sm transition-all select-none ${
        editMode
          ? 'border-brand-300 dark:border-brand-700 ring-2 ring-brand-500/20 cursor-default'
          : 'border-gray-200 dark:border-gray-700 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-brand-300 dark:hover:border-brand-700'
      }`}
    >
      {/* ── View mode ── */}
      {!editMode && (
        <div className="p-3.5 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-900 dark:text-white leading-tight truncate">{lead.name}</p>
              {lead.student_name && (
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Aluno: {lead.student_name}</p>
              )}
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
              {lead.email && (
                <span className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                  <LuMail className="h-3 w-3" />{lead.email}
                </span>
              )}
            </div>
          )}

          {lead.pending_followups > 0 && (
            <div className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
              overdue ? 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400'
                      : 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400'
            }`}>
              {overdue ? <LuCircleAlert className="h-3 w-3" /> : <LuClock className="h-3 w-3" />}
              {lead.pending_followups} follow-up{lead.pending_followups > 1 ? 's' : ''} pendente{overdue ? ' — atrasado!' : ''}
            </div>
          )}

          <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800">
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {lead.total_activities} interaç{lead.total_activities === 1 ? 'ão' : 'ões'}
            </span>
            {initials ? (
              <span title={lead.assigned_name ?? ''}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 dark:bg-brand-950/30 px-2 py-0.5 text-xs font-medium text-brand-700 dark:text-brand-400 border border-brand-200 dark:border-brand-800">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-white text-[9px] font-bold leading-none shrink-0">
                  {initials}
                </span>
                {lead.assigned_name?.split(' ')[0]}
              </span>
            ) : (
              <span className="text-xs text-gray-300 dark:text-gray-600 italic">sem responsável</span>
            )}
          </div>

          {/* Action row */}
          <div className="flex items-center gap-1.5 pt-0.5 border-t border-gray-100 dark:border-gray-800">
            <button
              onClick={e => { e.stopPropagation(); setForm({ name: lead.name, phone: lead.phone||'', email: lead.email||'', stage: lead.stage, notes: lead.notes||'' }); setEditMode(true) }}
              className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 py-1 text-xs text-gray-500 hover:border-brand-300 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400 transition-colors"
            >
              <LuPencil className="h-3 w-3" /> Editar
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 py-1 text-xs text-gray-500 hover:border-red-300 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 transition-colors disabled:opacity-50"
            >
              <LuTrash2 className="h-3 w-3" /> {deleting ? '...' : 'Deletar'}
            </button>
          </div>
        </div>
      )}

      {/* ── Edit mode ── */}
      {editMode && (
        <div className="p-3.5 space-y-2.5" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-brand-700 dark:text-brand-400 uppercase tracking-wide">Editando</span>
            <button onClick={e => { e.stopPropagation(); setEditMode(false) }}
              className="rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <LuX className="h-3.5 w-3.5" />
            </button>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">Nome *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputSmCls} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">Telefone</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputSmCls} />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">E-mail</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputSmCls} />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">Estágio</label>
            <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value as Stage }))} className={inputSmCls}>
              {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">Observações</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
              className={`${inputSmCls} resize-none`} />
          </div>

          <div className="flex gap-1.5">
            <button onClick={e => { e.stopPropagation(); setEditMode(false) }}
              className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving || !form.name.trim()}
              className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-brand-500 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50">
              <LuSave className="h-3 w-3" /> {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>

          {/* Stage badge preview */}
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

function LeadModal({ lead, onClose, onUpdate, onDelete, authFetch, apiBase }: {
  lead: Lead; onClose: () => void
  onUpdate: (l: Lead) => void; onDelete: (id: number) => void
  authFetch: (i: RequestInfo, init?: RequestInit) => Promise<Response>
  apiBase?: string
}) {
  const [editing, setEditing]         = useState(false)
  const [form, setForm]               = useState({ ...lead })
  const [activities, setActivities]   = useState<Activity[]>([])
  const [loadingActs, setLoadingActs] = useState(true)
  const [actType, setActType]         = useState<ActivityType>('NOTA')
  const [actDesc, setActDesc]         = useState('')
  const [actDate, setActDate]         = useState('')
  const [savingAct, setSavingAct]     = useState(false)
  const [saving, setSaving]           = useState(false)

  const stageCfg = STAGES.find(s => s.key === lead.stage)!
  const fmtDate  = (d: string) => new Date(d).toLocaleString('pt-BR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })

  useEffect(() => {
    authFetch(`${apiBase}/crm/leads/${lead.id}/activities`)
      .then(r => r.json()).then(setActivities).finally(() => setLoadingActs(false))
  }, [lead.id, authFetch, apiBase])

  const saveEdit = async () => {
    setSaving(true)
    const res = await authFetch(`${apiBase}/crm/leads/${lead.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    if (res.ok) { onUpdate(await res.json()); setEditing(false) }
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
      onUpdate({ ...lead, total_activities: lead.total_activities + 1,
        pending_followups: actDate ? lead.pending_followups + 1 : lead.pending_followups })
    }
    setSavingAct(false)
  }

  const toggleAct = async (act: Activity) => {
    const res = await authFetch(`${apiBase}/crm/activities/${act.id}/toggle`, { method: 'PATCH' })
    if (res.ok) {
      const updated = await res.json()
      const newActivities = activities.map(x => x.id === act.id ? { ...x, done: updated.done } : x)
      setActivities(newActivities)

      // Recalcula pending_followups a partir da lista atualizada e propaga pro card
      const newPending = newActivities.filter(
        x => x.done === 0 && x.scheduled_at !== null
      ).length
      onUpdate({ ...lead, pending_followups: newPending })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/50 p-4" onClick={onClose}>
      <div className="h-full w-full max-w-lg overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${stageCfg.dot}`} />
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{stageCfg.label}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setEditing(v => !v)}
              className={`rounded-lg p-1.5 transition-colors ${editing ? 'bg-brand-100 text-brand-600 dark:bg-brand-900/40 dark:text-brand-400' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
              <LuPencil className="h-4 w-4" />
            </button>
            <button onClick={() => { if(window.confirm('Remover este lead?')) onDelete(lead.id) }}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30 dark:hover:text-red-400">
              <LuTrash2 className="h-4 w-4" />
            </button>
            <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
              <LuX className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
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
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Origem</label>
                  <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value as Source }))} className={inputCls}>
                    {Object.entries(SOURCE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Estágio</label>
                  <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value as Stage }))} className={inputCls}>
                    {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              {form.stage === 'PERDIDO' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Motivo da perda</label>
                  <input value={form.lost_reason || ''} onChange={e => setForm(f => ({ ...f, lost_reason: e.target.value }))} className={inputCls} />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Observações</label>
                <textarea value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={inputCls} />
              </div>
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
              {lead.student_name && <p className="text-sm text-gray-500 dark:text-gray-400"><span className="font-medium">Aluno:</span> {lead.student_name}{lead.age_range ? ` · ${lead.age_range}` : ''}</p>}
              <div className="flex flex-wrap gap-3 text-sm">
                {lead.phone && <a href={`https://wa.me/55${lead.phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-green-600 hover:underline dark:text-green-400"><LuPhone className="h-4 w-4" />{lead.phone}</a>}
                {lead.email && <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400"><LuMail className="h-4 w-4" />{lead.email}</span>}
              </div>
              {lead.notes && <p className="text-sm text-gray-600 dark:text-gray-400 italic">{lead.notes}</p>}
              {lead.lost_reason && <p className="text-sm text-red-600 dark:text-red-400">Motivo da perda: {lead.lost_reason}</p>}
              <span className="inline-block rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-xs text-gray-600 dark:text-gray-400">{SOURCE_LABELS[lead.source]}</span>
            </div>
          )}

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
                  {actType === 'FOLLOW_UP' ? 'Data/hora do follow-up' : 'Data/hora da aula experimental'}
                </label>
                <input type="datetime-local" value={actDate} onChange={e => setActDate(e.target.value)} className={inputCls} />
              </div>
            )}
            <button onClick={addActivity} disabled={savingAct || !actDesc.trim()}
              className="w-full rounded-xl bg-brand-500 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
              {savingAct ? 'Salvando...' : '+ Registrar'}
            </button>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Histórico</p>
            {loadingActs ? (
              <div className="flex justify-center py-6"><div className="h-5 w-5 animate-spin rounded-full border-b-2 border-brand-500" /></div>
            ) : activities.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4 italic">Nenhuma interação registrada.</p>
            ) : (
              <div className="space-y-2">
                {activities.map(act => {
                  const isOverdue = act.scheduled_at && new Date(act.scheduled_at) < new Date() && !act.done
                  return (
                    <div key={act.id} className={`rounded-xl border p-3 space-y-1.5 transition-opacity ${act.done ? 'opacity-60' : ''} ${
                      isOverdue ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20'
                                : 'border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50'
                    }`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-500 dark:text-gray-400">{ACT_ICONS[act.type]}</span>
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{ACT_LABELS[act.type]}</span>
                          {isOverdue && <LuCircleAlert className="h-3.5 w-3.5 text-red-500" />}
                        </div>
                        {act.scheduled_at && (
                          <button onClick={() => toggleAct(act)}
                            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border transition-colors ${
                              act.done ? 'bg-green-100 border-green-200 text-green-700 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400'
                                       : 'border-gray-200 text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400'
                            }`}>
                            {act.done ? <><LuCheck className="h-3 w-3" /> Feito</> : <><LuClock className="h-3 w-3" /> Pendente</>}
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{act.description}</p>
                      <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                        <span>{act.created_by_name && `por ${act.created_by_name} · `}{fmtDate(act.created_at)}</span>
                        {act.scheduled_at && <span className={isOverdue ? 'text-red-500' : ''}><LuCalendarDays className="inline h-3 w-3 mr-0.5" />{fmtDate(act.scheduled_at)}</span>}
                      </div>
                    </div>
                  )
                })}
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
          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-400">{error}</div>}
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SecretaryCRM({ apiBase = '/secretary' }: { apiBase?: string }) {
  const { authFetch } = useAuth()
  const [leads, setLeads]         = useState<Lead[]>([])
  const [loading, setLoading]     = useState(true)
  const [openLead, setOpenLead]   = useState<Lead | null>(null)
  const [newModal, setNewModal]   = useState(false)
  const [filter, setFilter]       = useState<Stage | 'ALL'>('ALL')
  const [archiving, setArchiving] = useState(false)
  const [archivingLost, setArchivingLost] = useState(false)

  const dragLeadId = useRef<number | null>(null)
  const [dragOver, setDragOver]   = useState<Stage | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await authFetch(`${apiBase}/crm/leads`)
    if (res.ok) {
      const data: Lead[] = await res.json()
      setLeads(data.map(l => ({
        ...l,
        total_activities:  Number(l.total_activities  ?? 0),
        pending_followups: Number(l.pending_followups ?? 0),
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
    if (res.ok) {
      const updated = await res.json()
      setLeads(ls => ls.map(l => l.id === id ? { ...l, ...updated } : l))
    }
  }

  const handleInlineDelete = async (id: number) => {
    const res = await authFetch(`${apiBase}/crm/leads/${id}`, { method: 'DELETE' })
    if (res.ok) { setLeads(ls => ls.filter(l => l.id !== id)); if (openLead?.id === id) setOpenLead(null) }
  }

  const handleUpdate = (updated: Lead) =>
    setLeads(ls => ls.map(l => l.id === updated.id ? { ...l, ...updated } : l))

  const handleDelete = async (id: number) => {
    const res = await authFetch(`${apiBase}/crm/leads/${id}`, { method: 'DELETE' })
    if (res.ok) { setLeads(ls => ls.filter(l => l.id !== id)); setOpenLead(null) }
  }

  // ── Archive enrolled / lost from previous months ──
  const nowMonth  = new Date().getMonth()
  const nowYear   = new Date().getFullYear()

  const isOldDate = (dateStr: string | null) => {
    if (!dateStr) return false
    const d = new Date(dateStr)
    return d.getFullYear() < nowYear || (d.getFullYear() === nowYear && d.getMonth() < nowMonth)
  }

  const oldEnrolled = leads.filter(l => l.stage === 'MATRICULADO' && isOldDate(l.enrolled_at))
  const oldLost     = leads.filter(l => l.stage === 'PERDIDO'     && isOldDate(l.lost_at))

  const handleArchiveEnrolled = async () => {
    if (!window.confirm(`Arquivar ${oldEnrolled.length} matrícula(s) de meses anteriores? Elas sairão do board.`)) return
    setArchiving(true)
    const res = await authFetch(`${apiBase}/crm/archive-enrolled`, { method: 'POST' })
    if (res.ok) {
      const ids = new Set(oldEnrolled.map(l => l.id))
      setLeads(ls => ls.filter(l => !ids.has(l.id)))
    }
    setArchiving(false)
  }

  const handleArchiveLost = async () => {
    if (!window.confirm(`Arquivar ${oldLost.length} lead(s) perdido(s) de meses anteriores? Eles sairão do board.`)) return
    setArchivingLost(true)
    const res = await authFetch(`${apiBase}/crm/archive-lost`, { method: 'POST' })
    if (res.ok) {
      const ids = new Set(oldLost.map(l => l.id))
      setLeads(ls => ls.filter(l => !ids.has(l.id)))
    }
    setArchivingLost(false)
  }

  // ── Metrics ──
  const active       = leads.filter(l => !['MATRICULADO','PERDIDO'].includes(l.stage))
  const enrolled     = leads.filter(l => l.stage === 'MATRICULADO').length
  const experimental = leads.filter(l => l.stage === 'EXPERIMENTAL').length
  const lost         = leads.filter(l => l.stage === 'PERDIDO').length
  const shownStages     = filter === 'ALL' ? STAGES : STAGES.filter(s => s.key === filter)

  const monthName = new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <>
      <PageMeta title="CRM | Secretaria" description="Pipeline de leads" />
      <div className="space-y-5 flex flex-col" style={{ minHeight: 0 }}>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">CRM — Pipeline de Leads</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Arraste os cards entre as colunas para avançar o lead no pipeline.</p>
          </div>
          <button onClick={() => setNewModal(true)}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 shadow-sm">
            <LuPlus className="h-4 w-4" /> Novo Lead
          </button>
        </div>

        {/* Archive banners */}
        {oldEnrolled.length > 0 && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20 px-4 py-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <LuArchive className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                <span className="font-semibold">{oldEnrolled.length} matrícula{oldEnrolled.length > 1 ? 's' : ''}</span> de meses anteriores ainda no board.
                Inicie o mês de <span className="font-semibold capitalize">{monthName}</span> arquivando-as.
              </p>
            </div>
            <button onClick={handleArchiveEnrolled} disabled={archiving}
              className="shrink-0 flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50">
              <LuArchive className="h-3.5 w-3.5" />
              {archiving ? 'Arquivando...' : 'Arquivar agora'}
            </button>
          </div>
        )}
        {oldLost.length > 0 && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/40 px-4 py-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <LuArchive className="h-4 w-4 text-gray-500 dark:text-gray-400 shrink-0" />
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <span className="font-semibold">{oldLost.length} lead{oldLost.length > 1 ? 's' : ''} perdido{oldLost.length > 1 ? 's' : ''}</span> de meses anteriores ainda no board.
              </p>
            </div>
            <button onClick={handleArchiveLost} disabled={archivingLost}
              className="shrink-0 flex items-center gap-1.5 rounded-lg bg-gray-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50">
              <LuArchive className="h-3.5 w-3.5" />
              {archivingLost ? 'Arquivando...' : 'Arquivar perdidos'}
            </button>
          </div>
        )}

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 shrink-0">
          {[
            { label:'Leads ativos',    value: active.length, color:'text-brand-600 dark:text-brand-400',   bg:'bg-brand-50 dark:bg-brand-950/20 border-brand-100 dark:border-brand-900' },
            { label:'Em Experimental', value: experimental,  color:'text-violet-600 dark:text-violet-400', bg:'bg-violet-50 dark:bg-violet-950/20 border-violet-100 dark:border-violet-900' },
            { label:'Matriculados',    value: enrolled,      color:'text-green-600 dark:text-green-400',   bg:'bg-green-50 dark:bg-green-950/20 border-green-100 dark:border-green-900' },
            { label:'Perdidos',        value: lost,          color:'text-gray-600 dark:text-gray-400',     bg:'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700' },
          ].map(m => (
            <div key={m.label} className={`rounded-xl border p-4 ${m.bg}`}>
              <p className="text-xs text-gray-500 dark:text-gray-400">{m.label}</p>
              <p className={`text-2xl font-bold mt-1 ${m.color}`}>{m.value}</p>
            </div>
          ))}
        </div>

        {/* Stage filter pills */}
        <div className="flex flex-wrap gap-1.5 shrink-0">
          <button onClick={() => setFilter('ALL')}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${filter === 'ALL' ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 border-transparent' : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400'}`}>
            Todos ({leads.length})
          </button>
          {STAGES.map(s => {
            const cnt = leads.filter(l => l.stage === s.key).length
            return (
              <button key={s.key} onClick={() => setFilter(s.key)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${filter === s.key ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 border-transparent' : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400'}`}>
                {s.label} ({cnt})
              </button>
            )
          })}
        </div>

        {/* Kanban board */}
        {loading ? (
          <div className="flex justify-center py-20 shrink-0">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand-500" />
          </div>
        ) : (
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
                  }`}
                >
                  {/* Column header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${stage.dot}`} />
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{stage.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {oldCount > 0 && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                          isEnrolled
                            ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600'
                        }`}>
                          {oldCount} antigos
                        </span>
                      )}
                      <span className="rounded-full bg-gray-200 dark:bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-400">
                        {stageLeads.length}
                      </span>
                    </div>
                  </div>

                  {isOver && stageLeads.length === 0 && (
                    <div className="mx-3 mt-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 p-4 text-center text-xs text-gray-400 dark:text-gray-500">
                      Solte aqui
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto p-3 space-y-2.5" style={{ maxHeight: '65vh' }}>
                    {stageLeads.length === 0 && !isOver ? (
                      <p className="text-center text-xs text-gray-400 dark:text-gray-500 py-8 italic">Sem leads aqui</p>
                    ) : stageLeads.map(lead => (
                      <LeadCard key={lead.id} lead={lead}
                        onOpen={setOpenLead}
                        onDragStart={handleDragStart}
                        onInlineUpdate={handleInlineUpdate}
                        onInlineDelete={handleInlineDelete} />
                    ))}
                    {isOver && stageLeads.length > 0 && (
                      <div className="rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 p-3 text-center text-xs text-gray-400 dark:text-gray-500">
                        Solte aqui
                      </div>
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
          onUpdate={l => { handleUpdate(l); setOpenLead(l) }}
          onDelete={handleDelete} authFetch={authFetch} apiBase={apiBase} />
      )}
      {newModal && (
        <NewLeadModal onClose={() => setNewModal(false)}
          onCreated={l => setLeads(ls => [l, ...ls])} authFetch={authFetch} apiBase={apiBase} />
      )}
    </>
  )
}
