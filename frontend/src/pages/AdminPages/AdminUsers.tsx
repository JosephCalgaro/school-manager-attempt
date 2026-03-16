import { useCallback, useEffect, useState } from 'react';
import { LuSearch, LuX, LuPlus, LuPowerOff, LuPower } from 'react-icons/lu';
import { useAuth } from '../../hooks/useAuth';

interface User {
  id: number; full_name: string; email: string
  phone?: string | null; role: string; is_active: boolean; created_at: string;
}
interface UserDetails extends User {
  cpf?: string | null; rg?: string | null; birth_date?: string | null;
  updated_at: string;
  classes?: Array<{ id: number; name: string; schedule: string }>;
}
interface UserForm {
  full_name: string; email: string; phone: string
  cpf: string; rg: string; birth_date: string
  role: string; password: string; is_active: boolean;
}

const ROLES = [
  { value: 'ADMIN',     label: 'Administrador',  color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400' },
  { value: 'TEACHER',   label: 'Professor',       color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400' },
  { value: 'SECRETARY', label: 'Secretaria',      color: 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-400' },
]
const getRoleLabel = (r: string) => ROLES.find(x => x.value === r)?.label ?? r
const getRoleBadge = (r: string) => ROLES.find(x => x.value === r)?.color ?? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'

const emptyForm = (): UserForm => ({ full_name: '', email: '', phone: '', cpf: '', rg: '', birth_date: '', role: 'TEACHER', password: '', is_active: true })

// ─── Modal criar / editar ─────────────────────────────────────────────────────
function UserModal({ initial, onClose, onSaved, authFetch }: {
  initial?: UserDetails | null
  onClose: () => void
  onSaved: () => void
  authFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>
}) {
  const isEdit = Boolean(initial?.id)
  const [form, setForm] = useState<UserForm>(initial
    ? { full_name: initial.full_name, email: initial.email, phone: initial.phone ?? '',
        cpf: initial.cpf ?? '', rg: initial.rg ?? '',
        birth_date: initial.birth_date ? String(initial.birth_date).slice(0, 10) : '',
        role: initial.role, password: '', is_active: initial.is_active }
    : emptyForm()
  )
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const set = (k: keyof UserForm, v: string | boolean) => setForm(p => ({ ...p, [k]: v }))

  const submit = async () => {
    setError(null)
    if (!form.full_name || !form.email || !form.role) return setError('Nome, email e função são obrigatórios')
    if (!isEdit && !form.password) return setError('Senha é obrigatória para novo usuário')
    setSaving(true)
    try {
      const url    = isEdit ? `/admin/users/${initial!.id}` : '/admin/users'
      const method = isEdit ? 'PUT' : 'POST'
      const payload = { ...form, password: form.password || undefined }
      const res = await authFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.message || 'Erro ao salvar') }
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{isEdit ? 'Editar Usuário' : 'Novo Usuário'}</h2>
          <button onClick={onClose}><LuX className="h-5 w-5 text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-400">{error}</p>}

          <div className="grid grid-cols-2 gap-4">
            {([
              { key: 'full_name',  label: 'Nome completo *',  span: 2 },
              { key: 'email',      label: 'Email *',          span: 1 },
              { key: 'phone',      label: 'Telefone',         span: 1 },
              { key: 'cpf',        label: 'CPF',              span: 1 },
              { key: 'rg',         label: 'RG',               span: 1 },
              { key: 'birth_date', label: 'Data de nascimento', span: 1, type: 'date' },
            ] as { key: keyof Omit<UserForm,'role'|'password'|'is_active'>; label: string; span: number; type?: string }[]).map(f => (
              <div key={f.key} className={f.span === 2 ? 'col-span-2' : ''}>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{f.label}</label>
                <input type={f.type ?? 'text'} value={form[f.key] ?? ''} onChange={e => set(f.key, e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
              </div>
            ))}

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Função *</label>
              <select value={form.role} onChange={e => set('role', e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                {isEdit ? 'Nova senha (vazio = manter)' : 'Senha *'}
              </label>
              <input type="password" value={form.password} onChange={e => set('password', e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
            </div>

            {isEdit && (
              <div className="col-span-2 flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                <button type="button" onClick={() => set('is_active', !form.is_active)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.is_active ? 'bg-brand-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <span className="text-sm text-gray-500 dark:text-gray-400">{form.is_active ? 'Ativo' : 'Inativo'}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300">Cancelar</button>
          <button onClick={submit} disabled={saving} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
            {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar usuário'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AdminUsers() {
  const { authFetch, user: currentUser } = useAuth();
  const [users, setUsers]       = useState<User[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [page, setPage]         = useState(0);
  const [total, setTotal]       = useState(0);
  const [limit]                 = useState(10);
  const [modal, setModal]       = useState<null | 'new' | UserDetails>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: limit.toString(), offset: (page * limit).toString(),
        ...(search     && { search }),
        ...(roleFilter && { role: roleFilter }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
      });
      const res = await authFetch(`/admin/users?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setUsers(data.data); setTotal(data.total);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [search, roleFilter, statusFilter, page, limit, authFetch]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openEdit = async (userId: number) => {
    const res = await authFetch(`/admin/users/${userId}`);
    if (res.ok) setModal(await res.json());
  };

  const handleToggle = async (u: User) => {
    setTogglingId(u.id)
    try {
      await authFetch(`/admin/users/${u.id}/toggle`, { method: 'PATCH' })
      await fetchUsers()
    } finally { setTogglingId(null) }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Gerenciar Usuários</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Total: <span className="font-semibold">{total}</span></p>
        </div>
        <button onClick={() => setModal('new')}
          className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
          <LuPlus className="h-4 w-4" /> Novo Usuário
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="relative">
          <LuSearch className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Buscar por nome ou email..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(0); }}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
          <option value="">Todos os Papéis</option>
          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1">
          {(['active', 'inactive', 'all'] as const).map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(0); }}
              className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                statusFilter === s ? 'bg-brand-500 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}>
              {s === 'active' ? 'Ativos' : s === 'inactive' ? 'Inativos' : 'Todos'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-6 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500 mx-auto" /></div>
        ) : users.length === 0 ? (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">Nenhum usuário encontrado</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <tr>
                    {['Nome','Email','Telefone','Função','Status','Ações'].map(h => (                      <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{u.full_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{u.email}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{u.phone || '-'}</td>
                      <td className="px-6 py-4 text-sm"><span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleBadge(u.role)}`}>{getRoleLabel(u.role)}</span></td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${u.is_active ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'}`}>
                          {u.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-3">
                          <button onClick={() => openEdit(u.id)} className="text-brand-600 dark:text-brand-400 hover:underline font-medium">Editar</button>
                          {/* Não permite desativar a si mesmo */}
                          {u.id !== currentUser?.id && (
                            <button onClick={() => handleToggle(u)} disabled={togglingId === u.id}
                              title={u.is_active ? 'Desativar' : 'Reativar'}
                              className={`flex items-center gap-1 text-sm font-medium disabled:opacity-50 transition-colors ${
                                u.is_active ? 'text-error-600 hover:text-error-700 dark:text-error-400' : 'text-success-600 hover:text-success-700 dark:text-success-400'
                              }`}>
                              {u.is_active ? <><LuPowerOff className="h-3.5 w-3.5" /> Desativar</> : <><LuPower className="h-3.5 w-3.5" /> Reativar</>}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {page * limit + 1}–{Math.min((page + 1) * limit, total)} de {total}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">Anterior</button>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">Próximo</button>
              </div>
            </div>
          </>
        )}
      </div>

      {modal && (
        <UserModal
          initial={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchUsers(); }}
          authFetch={authFetch}
        />
      )}
    </div>
  );
}
