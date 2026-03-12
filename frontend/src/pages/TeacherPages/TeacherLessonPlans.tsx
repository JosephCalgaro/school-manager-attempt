import { useEffect, useRef, useState } from 'react'
import {
  LuBookOpen, LuPlus, LuPencil, LuTrash2, LuX,
  LuChevronDown, LuChevronUp, LuCheck, LuSearch,
  LuGripVertical, LuFlame, LuSnowflake, LuLayers,
  LuBrainCircuit, LuFlag, LuPuzzle,
} from 'react-icons/lu'
import { useAuth } from '../../hooks/useAuth'

// ─── Types ────────────────────────────────────────────────────────────────────

type CustomSection = { id: string; label: string; topics: string[] }

type Template = {
  id: number; teacher_id: number; teacher_name?: string
  title: string; description: string | null
  custom_sections: string | null
  warm_up: string | null; ice_breaker: string | null
  development: string | null; language_awareness: string | null; closure: string | null
  created_at: string; updated_at: string
}

type Props = { apiBase?: string }

// ─── Palette ──────────────────────────────────────────────────────────────────

const COLORS = ['amber','blue','violet','emerald','rose','orange','cyan','pink'] as const
type Color = typeof COLORS[number]
function colorAt(i: number): Color { return COLORS[i % COLORS.length] }

const COLOR_MAP: Record<Color,string> = {
  amber:   'bg-amber-50   border-amber-200   text-amber-700   dark:bg-amber-950/30  dark:border-amber-800  dark:text-amber-400',
  blue:    'bg-blue-50    border-blue-200    text-blue-700    dark:bg-blue-950/30   dark:border-blue-800   dark:text-blue-400',
  violet:  'bg-violet-50  border-violet-200  text-violet-700  dark:bg-violet-950/30 dark:border-violet-800 dark:text-violet-400',
  emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400',
  rose:    'bg-rose-50    border-rose-200    text-rose-700    dark:bg-rose-950/30   dark:border-rose-800   dark:text-rose-400',
  orange:  'bg-orange-50  border-orange-200  text-orange-700  dark:bg-orange-950/30 dark:border-orange-800 dark:text-orange-400',
  cyan:    'bg-cyan-50    border-cyan-200    text-cyan-700    dark:bg-cyan-950/30   dark:border-cyan-800   dark:text-cyan-400',
  pink:    'bg-pink-50    border-pink-200    text-pink-700    dark:bg-pink-950/30   dark:border-pink-800   dark:text-pink-400',
}
const BULLET_BG: Record<Color,string> = {
  amber:'bg-amber-400', blue:'bg-blue-400', violet:'bg-violet-400',
  emerald:'bg-emerald-400', rose:'bg-rose-400', orange:'bg-orange-400',
  cyan:'bg-cyan-400', pink:'bg-pink-400',
}

// ─── Suggestions ──────────────────────────────────────────────────────────────

const SUGGESTED = [
  { label:'Warm Up',            icon:<LuFlame className="h-3.5 w-3.5"/>,        placeholder:'Perguntas introdutórias, revisão rápida, conversa informal...' },
  { label:'Ice Breaker',        icon:<LuSnowflake className="h-3.5 w-3.5"/>,    placeholder:'Jogo com bola, dinâmica de apresentação, jogo com dado...' },
  { label:'Development',        icon:<LuLayers className="h-3.5 w-3.5"/>,       placeholder:'Conteúdo principal: livro, exercícios, explicações...' },
  { label:'Language Awareness', icon:<LuBrainCircuit className="h-3.5 w-3.5"/>, placeholder:'Gramática, vocabulário, pronúncia, entrevistas em pares...' },
  { label:'Closure',            icon:<LuFlag className="h-3.5 w-3.5"/>,         placeholder:'Revisão final, jogo, Baamboozle, atividade de fixação...' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _uid = 0
function uid() { return String(++_uid) }

function parseLegacySections(t: Template): CustomSection[] {
  const legacy: [string|null, string][] = [
    [t.warm_up,'Warm Up'],[t.ice_breaker,'Ice Breaker'],
    [t.development,'Development'],[t.language_awareness,'Language Awareness'],[t.closure,'Closure'],
  ]
  return legacy.flatMap(([raw,label]) => {
    if (!raw) return []
    let topics: string[] = []
    try { const p = JSON.parse(raw); topics = Array.isArray(p) ? p.filter(Boolean) : [String(p)] }
    catch { topics = [raw] }
    return topics.length ? [{ id:uid(), label, topics }] : []
  })
}

function templateToSections(t: Template): CustomSection[] {
  if (t.custom_sections) {
    try {
      const p = JSON.parse(t.custom_sections)
      if (Array.isArray(p) && p.length)
        return p.map(s => ({ id:uid(), label:s.label??'', topics:Array.isArray(s.topics)?s.topics:[] }))
    } catch { /* ignore and fallback to legacy */ }
  }
  return parseLegacySections(t)
}

// ─── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({ template, onEdit, onDelete, deletingId }:{
  template:Template; onEdit:(t:Template)=>void; onDelete:(id:number)=>void; deletingId:number|null
}) {
  const [expanded, setExpanded] = useState(false)
  const sections = templateToSections(template)

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
      <div className="p-5 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 dark:bg-brand-900/20 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:text-brand-300 mb-2">
              <LuBookOpen className="h-3 w-3"/> Plano de Aula
            </span>
            <h3 className="font-semibold text-gray-900 dark:text-white text-base leading-snug">{template.title}</h3>
            {template.description && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{template.description}</p>}
          </div>
          <div className="flex gap-1 shrink-0 mt-0.5">
            <button onClick={()=>onEdit(template)} title="Editar"
              className="rounded-lg p-1.5 text-gray-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-900/30 dark:hover:text-brand-400 transition-colors">
              <LuPencil className="h-4 w-4"/>
            </button>
            <button onClick={()=>onDelete(template.id)} disabled={deletingId===template.id} title="Remover"
              className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors disabled:opacity-40">
              <LuTrash2 className="h-4 w-4"/>
            </button>
          </div>
        </div>

        {sections.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {sections.map((s,i)=>(
              <span key={s.id} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${COLOR_MAP[colorAt(i)]}`}>
                {s.label} <span className="opacity-60">·{s.topics.filter(Boolean).length}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-gray-400 dark:text-gray-500 italic">Nenhuma seção preenchida</p>
        )}

        {sections.length > 0 && (
          <button onClick={()=>setExpanded(v=>!v)}
            className="mt-3 flex items-center gap-1.5 text-xs text-gray-500 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400 transition-colors">
            {expanded ? <LuChevronUp className="h-3.5 w-3.5"/> : <LuChevronDown className="h-3.5 w-3.5"/>}
            {expanded ? 'Ocultar conteúdo' : 'Ver conteúdo'}
          </button>
        )}
      </div>

      {expanded && sections.length > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
          {sections.map((s,i)=>{
            const color = colorAt(i)
            const filled = s.topics.filter(Boolean)
            if (!filled.length) return null
            return (
              <div key={s.id} className="px-5 py-4">
                <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold mb-3 ${COLOR_MAP[color]}`}>{s.label}</div>
                <ul className="space-y-1.5">
                  {filled.map((topic,j)=>(
                    <li key={j} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <span className={`mt-2 h-1.5 w-1.5 rounded-full shrink-0 ${BULLET_BG[color]}`}/>
                      <span className="leading-relaxed">{topic}</span>
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

// ─── Plan Editor ──────────────────────────────────────────────────────────────

function PlanEditor({ initial, onClose, onSaved, authFetch, apiBase }:{
  initial:Template|null; onClose:()=>void; onSaved:()=>void
  authFetch:(input:RequestInfo,init?:RequestInit)=>Promise<Response>; apiBase:string
}) {
  const isEdit = Boolean(initial?.id)
  const [title, setTitle]     = useState(initial?.title ?? '')
  const [desc, setDesc]       = useState(initial?.description ?? '')
  const [sections, setSections] = useState<CustomSection[]>(()=> initial ? templateToSections(initial) : [])
  const [customLabel, setCustomLabel] = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string|null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const addSection = (label: string) => {
    const l = label.trim(); if (!l) return
    setSections(s => [...s, { id:uid(), label:l, topics:[''] }])
    setCustomLabel('')
  }
  const removeSection = (id:string) => setSections(s=>s.filter(x=>x.id!==id))
  const updateLabel   = (id:string, label:string) => setSections(s=>s.map(x=>x.id===id?{...x,label}:x))
  const addTopic      = (id:string) => setSections(s=>s.map(x=>x.id===id?{...x,topics:[...x.topics,'']}:x))
  const updateTopic   = (id:string, i:number, val:string) => setSections(s=>s.map(x=>x.id===id?{...x,topics:x.topics.map((t,j)=>j===i?val:t)}:x))
  const removeTopic   = (id:string, i:number) => setSections(s=>s.map(x=>x.id===id?{...x,topics:x.topics.filter((_,j)=>j!==i)}:x))

  const handleSubmit = async () => {
    if (!title.trim()) return setError('Título é obrigatório')
    setSaving(true); setError(null)
    try {
      const payload = sections.map(s=>({ label:s.label.trim(), topics:s.topics.filter(t=>t.trim()) })).filter(s=>s.label)
      const body = {
        title:title.trim(), description:desc||null,
        custom_sections: payload.length ? payload : null,
        warm_up:null, ice_breaker:null, development:null, language_awareness:null, closure:null,
      }
      const url    = isEdit ? `${apiBase}/lesson-plans/${initial!.id}` : `${apiBase}/lesson-plans`
      const method = isEdit ? 'PUT' : 'POST'
      const res = await authFetch(url, { method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })
      if (!res.ok) { const b = await res.json().catch(()=>{}); throw new Error(b?.error||'Erro ao salvar') }
      onSaved()
    } catch(e) { setError(e instanceof Error ? e.message : 'Erro ao salvar') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-gray-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{isEdit?'Editar Plano de Aula':'Novo Plano de Aula'}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Adicione seções e quantos tópicos quiser em cada uma</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><LuX className="h-5 w-5"/></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-400">{error}</div>}

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1.5">Título <span className="text-red-500">*</span></label>
              <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex: Welcome Unit – Classroom Objects and Alphabet"
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/30"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Tópico / Objetivo</label>
              <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Ex: Introduce yourself, classroom objects, the alphabet"
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/30"/>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Seções do Plano</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {SUGGESTED.map(s=>(
                <button key={s.label} type="button" onClick={()=>addSection(s.label)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-brand-300 hover:text-brand-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 transition-colors">
                  <LuPlus className="h-3 w-3"/> {s.icon} {s.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input ref={inputRef} value={customLabel} onChange={e=>setCustomLabel(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addSection(customLabel)}}}
                placeholder="Ou digite um nome personalizado..."
                className="flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/30"/>
              <button onClick={()=>addSection(customLabel)} className="flex items-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600">
                <LuPuzzle className="h-4 w-4"/> Adicionar
              </button>
            </div>
          </div>

          {sections.length === 0 && (
            <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-2">Nenhuma seção adicionada. Use os atalhos acima para começar.</p>
          )}

          {sections.map((s,i)=>{
            const color = colorAt(i)
            return (
              <div key={s.id} className={`rounded-xl border p-4 ${COLOR_MAP[color]}`}>
                <div className="flex items-center gap-2 mb-3">
                  <LuGripVertical className="h-4 w-4 opacity-30 shrink-0"/>
                  <input value={s.label} onChange={e=>updateLabel(s.id,e.target.value)}
                    className="flex-1 rounded-lg border border-current/20 bg-white/70 dark:bg-gray-900/40 px-2.5 py-1 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-current/30"/>
                  <span className="text-xs opacity-50 shrink-0">{s.topics.filter(Boolean).length} tópico(s)</span>
                  <button onClick={()=>removeSection(s.id)} className="rounded-lg p-1 opacity-50 hover:opacity-100 transition-opacity"><LuX className="h-4 w-4"/></button>
                </div>
                <div className="space-y-2">
                  {s.topics.map((topic,j)=>(
                    <div key={j} className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${BULLET_BG[color]}`}/>
                      <input value={topic} onChange={e=>updateTopic(s.id,j,e.target.value)}
                        placeholder={j===0 ? (SUGGESTED.find(x=>x.label===s.label)?.placeholder ?? `Descreva o tópico...`) : `Tópico ${j+1}...`}
                        className="flex-1 rounded-lg border border-current/20 bg-white/70 dark:bg-gray-900/40 px-3 py-1.5 text-sm placeholder:text-current/40 focus:outline-none focus:ring-2 focus:ring-current/30"/>
                      <button onClick={()=>removeTopic(s.id,j)} className="opacity-40 hover:opacity-100"><LuX className="h-3.5 w-3.5"/></button>
                    </div>
                  ))}
                  <button onClick={()=>addTopic(s.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-current/25 px-3 py-1.5 text-xs font-medium opacity-60 hover:opacity-100 transition-opacity">
                    <LuPlus className="h-3 w-3"/> Adicionar tópico
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-gray-200 dark:border-gray-700 px-6 py-4 shrink-0">
          <button onClick={onClose} className="rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
            {saving ? 'Salvando...' : <><LuCheck className="h-4 w-4"/>{isEdit?'Salvar Alterações':'Criar Plano'}</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TeacherLessonPlans({ apiBase = '/teacher' }: Props) {
  const { authFetch } = useAuth()
  const [templates, setTemplates]             = useState<Template[]>([])
  const [loading, setLoading]                 = useState(true)
  const [error, setError]                     = useState<string|null>(null)
  const [success, setSuccess]                 = useState<string|null>(null)
  const [search, setSearch]                   = useState('')
  const [editorOpen, setEditorOpen]           = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template|null>(null)
  const [deletingId, setDeletingId]           = useState<number|null>(null)

  const load = async () => {
    setLoading(true)
    try { const res = await authFetch(`${apiBase}/lesson-plans`); if (res.ok) setTemplates(await res.json()) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, []) // eslint-disable-line

  const openNew  = () => { setEditingTemplate(null); setEditorOpen(true) }
  const openEdit = (t: Template) => { setEditingTemplate(t); setEditorOpen(true) }

  const handleSaved = async (msg: string) => {
    setEditorOpen(false); setSuccess(msg); await load()
    setTimeout(() => setSuccess(null), 3500)
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('Remover este plano?')) return
    setDeletingId(id)
    try {
      const res = await authFetch(`${apiBase}/lesson-plans/${id}`, { method:'DELETE' })
      if (!res.ok) { const b = await res.json().catch(()=>{}); throw new Error(b?.error||'Erro') }
      setSuccess('Plano removido.'); await load(); setTimeout(() => setSuccess(null), 3500)
    } catch(e) { setError(e instanceof Error ? e.message : 'Erro ao remover') }
    finally { setDeletingId(null) }
  }

  const filtered = templates.filter(t =>
    !search || t.title.toLowerCase().includes(search.toLowerCase()) ||
    (t.description??'').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Planos de Aula</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Crie planos com seções personalizadas e quantos tópicos quiser. Depois vincule-os às turmas.</p>
        </div>
        <button onClick={openNew} className="flex shrink-0 items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 shadow-sm">
          <LuPlus className="h-4 w-4"/> Novo Plano
        </button>
      </div>

      {success && <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300"><LuCheck className="h-4 w-4 shrink-0"/>{success}</div>}
      {error   && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">{error}</div>}

      <div className="relative">
        <LuSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"/>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por título ou objetivo..."
          className="h-11 w-full rounded-xl border border-gray-300 bg-white pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-white"/>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand-500"/></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 p-12 text-center">
          <LuBookOpen className="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-gray-600"/>
          <p className="text-sm text-gray-500 dark:text-gray-400">{search ? 'Nenhum plano encontrado.' : 'Nenhum plano criado ainda.'}</p>
          {!search && <button onClick={openNew} className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">Criar primeiro plano →</button>}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-400 dark:text-gray-500">{filtered.length} plano{filtered.length!==1?'s':''}</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map(t=><TemplateCard key={t.id} template={t} onEdit={openEdit} onDelete={handleDelete} deletingId={deletingId}/>)}
          </div>
        </div>
      )}

      {editorOpen && (
        <PlanEditor initial={editingTemplate} onClose={()=>setEditorOpen(false)}
          onSaved={()=>handleSaved(editingTemplate?'Plano atualizado!':'Plano criado!')}
          authFetch={authFetch} apiBase={apiBase}/>
      )}
    </div>
  )
}
