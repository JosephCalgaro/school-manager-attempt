import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  LuPlus, LuRefreshCw, LuPower, LuPowerOff,
  LuPencil, LuTrash2, LuLogIn, LuSearch,
  LuUsers, LuBookOpen, LuGraduationCap, LuBuilding2,
  LuX, LuCheck,
} from 'react-icons/lu'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface School {
  id: number
  name: string
  cnpj: string | null
  email: string | null
  phone: string | null
  address: string | null
  plan: 'TRIAL' | 'BASIC' | 'PRO'
  is_active: number
  created_at: string
  active_students?: number
  active_users?: number
  active_classes?: number
}

interface SchoolForm {
  school_name: string
  school_cnpj: string
  school_email: string
  school_phone: string
  school_address: string
  plan: string
  admin_name: string
  admin_email: string
  admin_password: string
  admin_phone: string
}

// ─── Helpers de API ───────────────────────────────────────────────────────────

const SAAS_KEY = import.meta.env.VITE_SAAS_KEY || 'saas_dev_key_change_in_production'

async function saasReq(method: string, path: string, body?: unknown) {
  const res = await fetch(`/saas${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Saas-Key': SAAS_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e?.error || `HTTP ${res.status}`)
  }
  return res.json()
}

// ─── Badge de plano ───────────────────────────────────────────────────────────

function PlanBadge({ plan }: { plan: string }) {
  const cls =
    plan === 'PRO'   ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' :
    plan === 'BASIC' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                       'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{plan}</span>
}

// ─── Campo de formulário ─────────────────────────────────────────────────────

function Field({
  label, value, onChange, type = 'text', required = false, span = false,
}: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; required?: boolean; span?: boolean
}) {
  const inp = 'w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/30'
  return (
    <div className={span ? 'col-span-2' : ''}>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} className={inp} />
    </div>
  )
}

// ─── Modal criar/editar escola ────────────────────────────────────────────────

function SchoolModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: School | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!editing
  const [form, setForm] = useState<SchoolForm>({
    school_name:     editing?.name    || '',
    school_cnpj:     editing?.cnpj    || '',
    school_email:    editing?.email   || '',
    school_phone:    editing?.phone   || '',
    school_address:  editing?.address || '',
    plan:            editing?.plan    || 'BASIC',
    admin_name:      '',
    admin_email:     '',
    admin_password:  '',
    admin_phone:     '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set = (k: keyof SchoolForm) => (v: string) => setForm(p => ({ ...p, [k]: v }))

  const submit = async () => {
    setSaving(true); setError('')
    try {
      if (isEdit) {
        await saasReq('PUT', `/schools/${editing!.id}`, {
          name: form.school_name, cnpj: form.school_cnpj || null,
          email: form.school_email || null, phone: form.school_phone || null,
          address: form.school_address || null, plan: form.plan,
        })
      } else {
        await saasReq('POST', '/schools', form)
      }
      onSaved(); onClose()
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao salvar') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-gray-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEdit ? `Editar — ${editing!.name}` : 'Nova Escola'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <LuX className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
              {error}
            </div>
          )}

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Dados da Escola</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome" value={form.school_name} onChange={set('school_name')} required span />
              <Field label="CNPJ" value={form.school_cnpj} onChange={set('school_cnpj')} />
              <Field label="E-mail" value={form.school_email} onChange={set('school_email')} type="email" />
              <Field label="Telefone" value={form.school_phone} onChange={set('school_phone')} />
              <Field label="Endereço" value={form.school_address} onChange={set('school_address')} span />
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Plano</label>
                <select value={form.plan} onChange={e => set('plan')(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/30">
                  <option value="TRIAL">TRIAL</option>
                  <option value="BASIC">BASIC</option>
                  <option value="PRO">PRO</option>
                </select>
              </div>
            </div>
          </div>

          {!isEdit && (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Usuário Admin</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nome" value={form.admin_name} onChange={set('admin_name')} required />
                <Field label="E-mail" value={form.admin_email} onChange={set('admin_email')} type="email" required />
                <Field label="Senha" value={form.admin_password} onChange={set('admin_password')} type="password" required />
                <Field label="Telefone" value={form.admin_phone} onChange={set('admin_phone')} />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
          <button onClick={onClose}
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">
            Cancelar
          </button>
          <button onClick={submit} disabled={saving}
            className="rounded-xl bg-brand-500 px-5 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
            {saving ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar Escola'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Card de escola ────────────────────────────────────────────────────────────

function SchoolCard({
  school,
  onEdit,
  onDelete,
  onEnter,
  onToggle,
}: {
  school: School
  onEdit: (s: School) => void
  onDelete: (s: School) => void
  onEnter: (s: School) => void
  onToggle: (s: School) => void
}) {
  const inactive = !school.is_active

  return (
    <div className={`relative rounded-2xl border bg-white dark:bg-gray-900 p-5 flex flex-col gap-4 transition-shadow hover:shadow-md ${
      inactive
        ? 'border-gray-200 opacity-60 dark:border-gray-700'
        : 'border-gray-200 dark:border-gray-700'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-900/20">
            <LuBuilding2 className="h-5 w-5 text-brand-600 dark:text-brand-400" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white leading-tight truncate">{school.name}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{school.email || 'Sem e-mail'}</p>
          </div>
        </div>
        <PlanBadge plan={school.plan} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { icon: <LuGraduationCap className="h-3.5 w-3.5" />, label: 'Alunos',   value: school.active_students ?? '–' },
          { icon: <LuUsers         className="h-3.5 w-3.5" />, label: 'Usuários', value: school.active_users    ?? '–' },
          { icon: <LuBookOpen      className="h-3.5 w-3.5" />, label: 'Turmas',   value: school.active_classes  ?? '–' },
        ].map(s => (
          <div key={s.label} className="rounded-xl bg-gray-50 dark:bg-gray-800 py-2">
            <div className="flex items-center justify-center gap-1 text-gray-400 dark:text-gray-500 mb-0.5">
              {s.icon}
              <span className="text-[10px] uppercase tracking-wide">{s.label}</span>
            </div>
            <p className="text-base font-bold text-gray-800 dark:text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Status + data */}
      <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
        <span className={`rounded-full px-2 py-0.5 font-medium ${
          inactive ? 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400'
                   : 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
        }`}>
          {inactive ? 'Inativa' : 'Ativa'}
        </span>
        <span>Criada em {new Date(school.created_at).toLocaleDateString('pt-BR')}</span>
      </div>

      {/* Ações */}
      <div className="flex gap-1.5 pt-1 border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={() => onEnter(school)}
          disabled={inactive}
          title="Entrar no painel desta escola"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-500 py-2 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          <LuLogIn className="h-3.5 w-3.5" /> Entrar
        </button>
        <button onClick={() => onEdit(school)} title="Editar escola"
          className="rounded-xl border border-gray-200 dark:border-gray-700 p-2 text-gray-500 hover:text-brand-600 hover:border-brand-300 dark:hover:text-brand-400 transition-colors">
          <LuPencil className="h-4 w-4" />
        </button>
        <button onClick={() => onToggle(school)} title={inactive ? 'Ativar' : 'Desativar'}
          className={`rounded-xl border p-2 transition-colors ${
            inactive
              ? 'border-gray-200 dark:border-gray-700 text-gray-400 hover:bg-green-50 hover:text-green-600 hover:border-green-200'
              : 'border-gray-200 dark:border-gray-700 text-gray-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200'
          }`}>
          {inactive ? <LuPower className="h-4 w-4" /> : <LuPowerOff className="h-4 w-4" />}
        </button>
        <button onClick={() => onDelete(school)} title="Deletar escola"
          className="rounded-xl border border-gray-200 dark:border-gray-700 p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors">
          <LuTrash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Modal de confirmação de exclusão ─────────────────────────────────────────

function DeleteModal({
  school,
  onClose,
  onDeleted,
}: {
  school: School
  onClose: () => void
  onDeleted: () => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const confirm = async () => {
    setDeleting(true); setError('')
    try {
      await saasReq('DELETE', `/schools/${school.id}`)
      onDeleted(); onClose()
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao deletar') }
    finally { setDeleting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 shadow-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/30">
            <LuTrash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">Deletar escola?</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{school.name}</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Esta ação é irreversível. Se a escola tiver dados vinculados, a exclusão será bloqueada — desative-a em vez disso.
        </p>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose}
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300">
            Cancelar
          </button>
          <button onClick={confirm} disabled={deleting}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
            {deleting ? 'Deletando...' : 'Deletar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function SaasPanel() {
  const navigate = useNavigate()

  const [schools,      setSchools]      = useState<School[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [search,       setSearch]       = useState('')
  const [modalSchool,  setModalSchool]  = useState<School | null | 'new'>()
  const [deleteTarget, setDeleteTarget] = useState<School | null>(null)
  const [entering,     setEntering]     = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setSchools(await saasReq('GET', '/schools')) }
    catch { setError('Falha ao carregar escolas. Verifique a SAAS_KEY.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleToggle = async (school: School) => {
    try {
      await saasReq('PATCH', `/schools/${school.id}/toggle`)
      load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao alterar escola')
    }
  }

  const handleEnter = async (school: School) => {
    setEntering(school.id)
    try {
      const data = await saasReq('POST', `/schools/${school.id}/impersonate`)
      // Salva sessão da escola (inclui is_temp e expires_at)
      const userToStore = {
        ...data.user,
        is_temp:         data.is_temp    ?? false,
        temp_expires_at: data.expires_at ?? null,
      }
      localStorage.setItem('auth', JSON.stringify({ user: userToStore, token: data.token }))
      navigate('/')
      window.location.reload()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao entrar na escola')
    } finally { setEntering(null) }
  }

  const visible = schools.filter(s =>
    !search ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.email || '').toLowerCase().includes(search.toLowerCase())
  )

  const active   = schools.filter(s =>  s.is_active).length
  const inactive = schools.filter(s => !s.is_active).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Escolas</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {active} ativa{active !== 1 ? 's' : ''}{inactive > 0 ? `, ${inactive} inativa${inactive !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 disabled:opacity-50">
            <LuRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setModalSchool('new')}
            className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 shadow-sm">
            <LuPlus className="h-4 w-4" /> Nova Escola
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Busca */}
      <div className="relative max-w-xs">
        <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar escola..."
          className="h-10 w-full rounded-xl border border-gray-300 bg-white pl-9 pr-4 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
      </div>

      {/* Grid de cards */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-2xl border border-gray-100 dark:border-gray-800 h-52 animate-pulse bg-gray-50 dark:bg-gray-800" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400 dark:text-gray-500">
          <LuBuilding2 className="h-10 w-10" />
          <p className="text-sm">{search ? 'Nenhuma escola encontrada.' : 'Nenhuma escola cadastrada.'}</p>
          {!search && (
            <button onClick={() => setModalSchool('new')} className="text-sm text-brand-500 hover:underline">
              Criar primeira escola →
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map(s => (
            <div key={s.id} className="relative">
              {entering === s.id && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-sm text-brand-600 dark:text-brand-400 font-medium">
                    <LuCheck className="h-4 w-4 animate-pulse" /> Entrando...
                  </div>
                </div>
              )}
              <SchoolCard
                school={s}
                onEdit={setModalSchool}
                onDelete={setDeleteTarget}
                onEnter={handleEnter}
                onToggle={handleToggle}
              />
            </div>
          ))}
        </div>
      )}

      {/* Modais */}
      {modalSchool && (
        <SchoolModal
          editing={modalSchool === 'new' ? null : modalSchool}
          onClose={() => setModalSchool(undefined)}
          onSaved={load}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          school={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={load}
        />
      )}
    </div>
  )
}
