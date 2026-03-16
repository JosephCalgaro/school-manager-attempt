import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  LuUser, LuMail, LuPhone, LuIdCard, LuCalendarDays,
  LuMapPin, LuBookOpen, LuUsers, LuBadgeCheck, LuClock,
} from 'react-icons/lu'
import { useAuth } from '../hooks/useAuth'
import PageMeta from '../components/common/PageMeta'

// ── tipos ────────────────────────────────────────────────────────────────────
interface ProfileClass {
  id: number
  name: string
  schedule: string | null
  classroom: string | null
  totalStudents: number
}

interface ProfileData {
  id: number
  full_name: string
  email: string
  role: string
  phone?: string | null
  cpf?: string | null
  rg?: string | null
  birth_date?: string | null
  address?: string | null
  due_day?: number | null
  created_at?: string | null
  // STUDENT
  responsible_name?: string | null
  responsible_email?: string | null
  responsible_phone?: string | null
  // RESPONSIBLE
  student_id?: number | null
  student_name?: string | null
  student_email?: string | null
  // TEACHER
  classes?: ProfileClass[]
}

// ── helpers ──────────────────────────────────────────────────────────────────
function formatDate(value?: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return value
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatCPF(v?: string | null) {
  if (!v) return '—'
  const n = v.replace(/\D/g, '')
  if (n.length !== 11) return v
  return `${n.slice(0,3)}.${n.slice(3,6)}.${n.slice(6,9)}-${n.slice(9)}`
}

const roleLabels: Record<string, string> = {
  ADMIN:       'Administrador',
  TEACHER:     'Professor',
  SECRETARY:   'Secretaria',
  STUDENT:     'Aluno',
  RESPONSIBLE: 'Responsável',
}

// ── subcomponentes ───────────────────────────────────────────────────────────
function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null | number }) {
  const display = value !== null && value !== undefined && value !== '' ? String(value) : '—'
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 shrink-0 text-gray-400 dark:text-gray-500">{icon}</span>
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-800 dark:text-white/90">{display}</p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-700 lg:p-6">
      <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</h4>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-5">{children}</div>
    </div>
  )
}

export default function UserProfiles() {
  const { user, authFetch } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const role = (user?.role || '').toUpperCase()

  useEffect(() => {
    if (!user) return
    authFetch('/auth/profile')
      .then(r => {
        if (!r.ok) throw new Error('Falha ao carregar perfil')
        return r.json()
      })
      .then(data => setProfile(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [user, authFetch])

  if (loading) {
    return (
      <div className="space-y-4">
        {[1,2,3].map(i => (
          <div key={i} className="h-40 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
        ))}
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-900/20">
        <p className="text-sm text-red-600 dark:text-red-400">{error || 'Erro ao carregar perfil'}</p>
        <button onClick={() => navigate(-1)} className="mt-3 text-sm text-brand-600 hover:text-brand-700">
          ← Voltar
        </button>
      </div>
    )
  }

  const roleBadgeColor: Record<string, string> = {
    ADMIN:       'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    TEACHER:     'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
    SECRETARY:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    STUDENT:     'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300',
    RESPONSIBLE: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  }

  return (
    <>
      <PageMeta title="Meu Perfil | Escola" description="Perfil do usuário" />
      <div className="space-y-5">

        {/* — Cabeçalho avatar ——————————————————————————————————————————— */}
        <div className="flex items-center gap-5 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-500 text-2xl font-bold text-white">
            {profile.full_name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{profile.full_name}</h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{profile.email}</p>
            <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleBadgeColor[role] || 'bg-gray-100 text-gray-600'}`}>
              {roleLabels[role] || role}
            </span>
          </div>
        </div>

        {/* — Informações pessoais ——————————————————————————————————————— */}
        <Section title="Informações Pessoais">
          <Field icon={<LuUser className="h-4 w-4"/>}        label="Nome Completo"       value={profile.full_name} />
          <Field icon={<LuMail className="h-4 w-4"/>}        label="Email"               value={profile.email} />
          <Field icon={<LuPhone className="h-4 w-4"/>}       label="Telefone"            value={profile.phone} />
          <Field icon={<LuIdCard className="h-4 w-4"/>}      label="CPF"                 value={formatCPF(profile.cpf)} />
          {profile.rg && (
            <Field icon={<LuIdCard className="h-4 w-4"/>}    label="RG"                  value={profile.rg} />
          )}
          {profile.birth_date && (
            <Field icon={<LuCalendarDays className="h-4 w-4"/>} label="Data de Nascimento" value={formatDate(profile.birth_date)} />
          )}
          {profile.address && (
            <Field icon={<LuMapPin className="h-4 w-4"/>}    label="Endereço"            value={profile.address} />
          )}
          {role === 'STUDENT' && profile.due_day && (
            <Field icon={<LuCalendarDays className="h-4 w-4"/>} label="Dia de Vencimento" value={`Todo dia ${profile.due_day}`} />
          )}
          {profile.created_at && (
            <Field icon={<LuClock className="h-4 w-4"/>}     label="Membro desde"        value={formatDate(profile.created_at)} />
          )}
          <Field icon={<LuBadgeCheck className="h-4 w-4"/>}  label="Cargo / Função"      value={roleLabels[role] || role} />
        </Section>

        {/* — Responsável (somente STUDENT) ————————————————————————————— */}
        {role === 'STUDENT' && (profile.responsible_name || profile.responsible_email) && (
          <Section title="Responsável">
            <Field icon={<LuUser className="h-4 w-4"/>}  label="Nome"      value={profile.responsible_name} />
            <Field icon={<LuMail className="h-4 w-4"/>}  label="Email"     value={profile.responsible_email} />
            <Field icon={<LuPhone className="h-4 w-4"/>} label="Telefone"  value={profile.responsible_phone} />
          </Section>
        )}

        {/* — Aluno vinculado (somente RESPONSIBLE) ————————————————————— */}
        {role === 'RESPONSIBLE' && profile.student_name && (
          <Section title="Aluno Vinculado">
            <Field icon={<LuUser className="h-4 w-4"/>}  label="Nome"  value={profile.student_name} />
            <Field icon={<LuMail className="h-4 w-4"/>}  label="Email" value={profile.student_email} />
          </Section>
        )}

        {/* — Turmas (somente TEACHER) —————————————————————————————————— */}
        {role === 'TEACHER' && profile.classes && profile.classes.length > 0 && (
          <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-700 lg:p-6">
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Minhas Turmas ({profile.classes.length})
            </h4>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {profile.classes.map(cls => (
                <button
                  key={cls.id}
                  onClick={() => navigate(`/teacher/classes/${cls.id}`)}
                  className="flex w-full items-center justify-between py-3 text-left hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-white/90">{cls.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {cls.schedule || 'Sem horário'}
                      {cls.classroom ? ` · Sala ${cls.classroom}` : ''}
                    </p>
                  </div>
                  <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                    <LuUsers className="h-3.5 w-3.5" />
                    {cls.totalStudents}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* — Acesso (ID interno) ——————————————————————————————————————— */}
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            <LuBookOpen className="mr-1 inline h-3.5 w-3.5" />
            ID interno: <span className="font-mono font-semibold text-gray-600 dark:text-gray-300">#{profile.id}</span>
          </p>
        </div>

      </div>
    </>
  )
}
