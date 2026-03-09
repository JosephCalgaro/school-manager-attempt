import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { LuSearch, LuX, LuPlus, LuUserPlus } from 'react-icons/lu';

interface Student {
  id: number;
  full_name: string;
  cpf: string;
  email: string;
  phone?: string | null;
  birth_date: string;
  address: string;
  created_at: string;
}

interface StudentDetails extends Student {
  rg: string;
  due_day?: number;
  responsible_id: number | null;
  responsible?: {
    id?: number;
    full_name: string;
    cpf?: string;
    rg?: string;
    birth_date?: string;
    address?: string;
    email: string;
    phone?: string | null;
  } | null;
}

interface StudentClasses {
  id: number;
  name: string;
  schedule: string;
  teacher_name: string;
}

interface Attendance {
  id: number;
  date: string;
  present: boolean;
  class_name: string;
}

interface AttendanceStats {
  total: number;
  present: number;
  absent: number;
  percentage: string;
}

interface Assignment {
  id: number;
  title: string;
  type: string;
  max_score: number;
  due_date: string;
  description: string;
  class_name: string;
  score: number | null;
}

interface StudentDetailsData {
  attendance: Attendance[];
  statistics: AttendanceStats;
}

type StudentForm = {
  full_name: string;
  cpf: string;
  rg: string;
  birth_date: string;
  address: string;
  email: string;
  phone: string;
  due_day: string;
  password?: string;
  responsible: null | {
    full_name: string;
    cpf: string;
    rg: string;
    birth_date: string;
    address: string;
    email: string;
    phone: string;
  };
};

function detailsToForm(details: StudentDetails): StudentForm {
  return {
    full_name: details.full_name || '',
    cpf: details.cpf || '',
    rg: details.rg || '',
    birth_date: details.birth_date ? String(details.birth_date).slice(0, 10) : '',
    address: details.address || '',
    email: details.email || '',
    phone: details.phone || '',
    due_day: details.due_day ? String(details.due_day) : '',
    password: '',
    responsible: details.responsible
      ? {
          full_name: details.responsible.full_name || '',
          cpf: details.responsible.cpf || '',
          rg: details.responsible.rg || '',
          birth_date: details.responsible.birth_date ? String(details.responsible.birth_date).slice(0, 10) : '',
          address: details.responsible.address || '',
          email: details.responsible.email || '',
          phone: details.responsible.phone || ''
        }
      : null
  };
}

export default function AdminStudents() {
  const { authFetch } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [limit] = useState(10);

  const [selectedStudent, setSelectedStudent] = useState<StudentDetails | null>(null);
  const [studentClasses, setStudentClasses] = useState<StudentClasses[]>([]);
  const [studentAttendance, setStudentAttendance] = useState<StudentDetailsData | null>(null);
  const [studentAssignments, setStudentAssignments] = useState<Assignment[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'classes' | 'attendance' | 'assignments'>('info');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<StudentForm | null>(null);
  const [createModal, setCreateModal] = useState(false);

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: (page * limit).toString(),
        ...(search && { search })
      });

      const response = await authFetch(`/admin/students?${params}`);
      if (!response.ok) throw new Error('Erro ao buscar alunos');
      const data = await response.json();
      setStudents(data.data);
      setTotal(data.total);
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  }, [search, page, limit, authFetch]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const fetchStudentDetails = async (studentId: number) => {
    try {
      setDetailsLoading(true);

      const detailsRes = await authFetch(`/admin/students/${studentId}`);
      const details = await detailsRes.json();
      setSelectedStudent(details);
      setFormData(detailsToForm(details));

      const classesRes = await authFetch(`/admin/students/${studentId}/classes`);
      setStudentClasses(await classesRes.json());

      const attendanceRes = await authFetch(`/admin/students/${studentId}/attendance`);
      setStudentAttendance(await attendanceRes.json());

      const assignmentsRes = await authFetch(`/admin/students/${studentId}/assignments`);
      setStudentAssignments(await assignmentsRes.json());

      setActiveTab('info');
      setIsEditing(false);
    } catch (error) {
      console.error('Erro ao buscar detalhes:', error);
    } finally {
      setDetailsLoading(false);
    }
  };

  const saveStudentDetails = async () => {
    if (!selectedStudent || !formData) return;
    try {
      setSaving(true);
      const payload = {
        ...formData,
        due_day: formData.due_day === '' ? undefined : Number(formData.due_day),
      };

      const response = await authFetch(`/admin/students/${selectedStudent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.message || 'Erro ao atualizar aluno');
      }

      await fetchStudentDetails(selectedStudent.id);
      await fetchStudents();
      setIsEditing(false);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Erro ao atualizar aluno');
    } finally {
      setSaving(false);
    }
  };

  const closeModal = () => {
    setSelectedStudent(null);
    setStudentClasses([]);
    setStudentAttendance(null);
    setStudentAssignments([]);
    setIsEditing(false);
    setFormData(null);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Gerenciar Alunos</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Total de alunos: <span className="font-semibold">{total}</span>
          </p>
        </div>
        <button onClick={() => setCreateModal(true)}
          className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
          <LuPlus className="h-4 w-4" /> Novo Aluno
        </button>
      </div>

      <div className="mb-6 relative">
        <LuSearch className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nome, email ou CPF..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500 mx-auto"></div>
          </div>
        ) : students.length === 0 ? (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">Nenhum aluno encontrado</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Nome</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Telefone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">CPF</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {students.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{student.full_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{student.email}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{student.phone || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{student.cpf}</td>
                      <td className="px-6 py-4 text-sm">
                        <button
                          onClick={() => fetchStudentDetails(student.id)}
                          className="text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium"
                        >
                          Ver Detalhes
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Mostrando {page * limit + 1} a {Math.min((page + 1) * limit, total)} de {total}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  Próximo
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedStudent.full_name}</h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                <LuX className="w-6 h-6" />
              </button>
            </div>

            <div className="border-b border-gray-200 dark:border-gray-700 px-6">
              <div className="flex gap-4">
                {(['info', 'classes', 'attendance', 'assignments'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`py-3 px-4 font-medium border-b-2 transition ${
                      activeTab === tab
                        ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                        : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
                    }`}
                  >
                    {tab === 'info' && 'Informações'}
                    {tab === 'classes' && 'Turmas'}
                    {tab === 'attendance' && 'Frequência'}
                    {tab === 'assignments' && 'Atividades'}
                  </button>
                ))}
                {activeTab === 'info' && (
                  <button
                    onClick={() => (isEditing ? saveStudentDetails() : setIsEditing(true))}
                    disabled={saving}
                    className="ml-auto py-3 px-4 font-medium text-brand-600 dark:text-brand-400"
                  >
                    {saving ? 'Salvando...' : isEditing ? 'Salvar' : 'Editar'}
                  </button>
                )}
                {activeTab === 'info' && isEditing && (
                  <button onClick={() => setIsEditing(false)} className="py-3 px-2 font-medium text-gray-600 dark:text-gray-400">
                    Cancelar
                  </button>
                )}
              </div>
            </div>

            <div className="p-6">
              {detailsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500 mx-auto"></div>
                </div>
              ) : (
                <>
                  {activeTab === 'info' && formData && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        {(['full_name', 'email', 'phone', 'cpf', 'rg', 'birth_date', 'due_day'] as const).map((field) => (
                          <div key={field}>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {{
                                full_name: 'Nome',
                                email: 'Email',
                                phone: 'Telefone',
                                cpf: 'CPF',
                                rg: 'RG',
                                birth_date: 'Data de Nascimento',
                                due_day: 'Dia de Vencimento'
                              }[field]}
                            </p>
                            {isEditing ? (
                              <input
                                type={field === 'birth_date' ? 'date' : field === 'due_day' ? 'number' : 'text'}
                                value={formData[field] ?? ''}
                                onChange={(e) => setFormData((prev) => prev ? { ...prev, [field]: e.target.value } : prev)}
                                className="w-full rounded border px-2 py-1 dark:bg-gray-700"
                              />
                            ) : (
                              <p className="text-gray-900 dark:text-white font-medium">
                                {field === 'birth_date' && formData.birth_date
                                  ? new Date(formData.birth_date).toLocaleDateString('pt-BR')
                                  : formData[field] || '-'}
                              </p>
                            )}
                          </div>
                        ))}
                        {isEditing && (
                          <div className="col-span-2">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Nova Senha <span className="text-xs text-gray-400">(deixe em branco para não alterar)</span>
                            </p>
                            <input
                              type="password"
                              placeholder="Nova senha do aluno..."
                              value={formData.password || ''}
                              onChange={(e) => setFormData((prev) => prev ? { ...prev, password: e.target.value } : prev)}
                              className="w-full rounded border px-2 py-1 dark:bg-gray-700"
                            />
                          </div>
                        )}
                        <div className="col-span-2">
                          <p className="text-sm text-gray-600 dark:text-gray-400">Endereço</p>
                          {isEditing ? (
                            <input
                              value={formData.address}
                              onChange={(e) => setFormData((prev) => prev ? { ...prev, address: e.target.value } : prev)}
                              className="w-full rounded border px-2 py-1 dark:bg-gray-700"
                            />
                          ) : (
                            <p className="text-gray-900 dark:text-white font-medium">{formData.address || '-'}</p>
                          )}
                        </div>
                      </div>

                      {formData.responsible && (
                        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Responsável</h3>
                          <div className="grid grid-cols-2 gap-4">
                            {(() => {
                              const resp = formData.responsible;
                              return (['full_name', 'email', 'phone', 'cpf', 'rg', 'birth_date'] as const).map((field) => (
                              <div key={field}>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  {{
                                    full_name: 'Nome',
                                    email: 'Email',
                                    phone: 'Telefone',
                                    cpf: 'CPF',
                                    rg: 'RG',
                                    birth_date: 'Data de Nascimento'
                                  }[field]}
                                </p>
                                {isEditing ? (
                                  <input
                                    type={field === 'birth_date' ? 'date' : 'text'}
                                    value={resp[field] ?? ''}
                                    onChange={(e) =>
                                      setFormData((prev) =>
                                        prev && prev.responsible
                                          ? { ...prev, responsible: { ...prev.responsible, [field]: e.target.value } }
                                          : prev
                                      )
                                    }
                                    className="w-full rounded border px-2 py-1 dark:bg-gray-700"
                                  />
                                ) : (
                                  <p className="text-gray-900 dark:text-white font-medium">
                                    {field === 'birth_date' && resp[field]
                                      ? new Date(resp[field]).toLocaleDateString('pt-BR')
                                      : resp[field] || '-'}
                                  </p>
                                )}
                              </div>
                            ));
                            })()}
                            <div className="col-span-2">
                              <p className="text-sm text-gray-600 dark:text-gray-400">Endereço</p>
                              {isEditing ? (
                                <input
                                  value={formData.responsible.address}
                                  onChange={(e) =>
                                    setFormData((prev) =>
                                      prev && prev.responsible
                                        ? { ...prev, responsible: { ...prev.responsible, address: e.target.value } }
                                        : prev
                                    )
                                  }
                                  className="w-full rounded border px-2 py-1 dark:bg-gray-700"
                                />
                              ) : (
                                <p className="text-gray-900 dark:text-white font-medium">{formData.responsible.address || '-'}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'classes' && (
                    <div className="space-y-3">
                      {studentClasses.length === 0 ? <p className="text-gray-500 dark:text-gray-400">Nenhuma turma encontrada</p> : studentClasses.map((cls) => (
                        <div key={cls.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                          <h4 className="font-semibold text-gray-900 dark:text-white">{cls.name}</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Professor: {cls.teacher_name}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Horário: {cls.schedule}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === 'attendance' && studentAttendance && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-4 gap-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg"><p className="text-sm text-gray-600 dark:text-gray-400">Total</p><p className="text-2xl font-bold text-gray-900 dark:text-white">{studentAttendance.statistics.total}</p></div>
                        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg"><p className="text-sm text-gray-600 dark:text-gray-400">Presentes</p><p className="text-2xl font-bold text-green-600 dark:text-green-400">{studentAttendance.statistics.present}</p></div>
                        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg"><p className="text-sm text-gray-600 dark:text-gray-400">Ausentes</p><p className="text-2xl font-bold text-red-600 dark:text-red-400">{studentAttendance.statistics.absent}</p></div>
                        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg"><p className="text-sm text-gray-600 dark:text-gray-400">Percentual</p><p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{studentAttendance.statistics.percentage}</p></div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'assignments' && (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {studentAssignments.length === 0 ? <p className="text-gray-500 dark:text-gray-400">Nenhuma atividade encontrada</p> : studentAssignments.map((assignment) => (
                        <div key={assignment.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900 dark:text-white">{assignment.title}</h4>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Turma: {assignment.class_name}</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Tipo: {assignment.type}</p>
                            </div>
                            <div className="text-right">
                              {assignment.score !== null ? (
                                <div>
                                  <p className="text-2xl font-bold text-brand-600 dark:text-brand-400">{assignment.score}</p>
                                  <p className="text-xs text-gray-600 dark:text-gray-400">de {assignment.max_score}</p>
                                </div>
                              ) : <p className="text-gray-500 dark:text-gray-400 text-sm">Sem nota</p>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {createModal && (
        <CreateStudentModal
          onClose={() => setCreateModal(false)}
          onSaved={() => { setCreateModal(false); fetchStudents(); }}
          authFetch={authFetch}
        />
      )}
    </div>
  );
}

const emptyStudentForm = (): StudentForm => ({
  full_name: '', cpf: '', rg: '', birth_date: '', address: '',
  email: '', phone: '', due_day: '', password: '', responsible: null,
})
const emptyResp = () => ({
  full_name: '', cpf: '', rg: '', birth_date: '', address: '', email: '', phone: '', password: '',
})

type SField = { key: keyof Omit<StudentForm,'responsible'|'password'>; label: string; type?: string }
const S_FIELDS: SField[] = [
  { key: 'full_name',  label: 'Nome completo *' },
  { key: 'email',      label: 'Email *' },
  { key: 'cpf',        label: 'CPF *' },
  { key: 'rg',         label: 'RG' },
  { key: 'birth_date', label: 'Data de nascimento', type: 'date' },
  { key: 'phone',      label: 'Telefone' },
  { key: 'address',    label: 'Endereço' },
  { key: 'due_day',    label: 'Dia de vencimento', type: 'number' },
]
type RField = { key: keyof NonNullable<StudentForm['responsible']>; label: string; type?: string }
const R_FIELDS: RField[] = [
  { key: 'full_name',  label: 'Nome completo *' },
  { key: 'email',      label: 'Email *' },
  { key: 'cpf',        label: 'CPF' },
  { key: 'rg',         label: 'RG' },
  { key: 'birth_date', label: 'Data de nascimento', type: 'date' },
  { key: 'phone',      label: 'Telefone' },
  { key: 'address',    label: 'Endereço' },
  { key: 'password',   label: 'Senha de acesso', type: 'password' },
]

function CreateStudentModal({ onClose, onSaved, authFetch }: {
  onClose: () => void; onSaved: () => void
  authFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>
}) {
  const [form, setForm] = useState<StudentForm>(emptyStudentForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setS = (k: keyof Omit<StudentForm,'responsible'>, v: string) =>
    setForm(p => ({ ...p, [k]: v }))
  const setR = (k: keyof NonNullable<StudentForm['responsible']>, v: string) =>
    setForm(p => p.responsible ? { ...p, responsible: { ...p.responsible, [k]: v } } : p)

  const submit = async () => {
    setError(null)
    if (!form.full_name || !form.email || !form.cpf) return setError('Nome, email e CPF são obrigatórios')
    if (!form.password) return setError('Senha é obrigatória')
    setSaving(true)
    try {
      const payload = { ...form, due_day: form.due_day ? Number(form.due_day) : undefined }
      const res = await authFetch('/admin/students', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.message || 'Erro ao salvar') }
      onSaved()
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao salvar') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-900 shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-white dark:bg-gray-900">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Novo Aluno</h2>
          <button onClick={onClose}><LuX className="h-5 w-5 text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-6">
          {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-400">{error}</p>}

          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Dados do Aluno</h3>
            <div className="grid grid-cols-2 gap-3">
              {S_FIELDS.map(f => (
                <div key={f.key} className={f.key === 'full_name' || f.key === 'address' ? 'col-span-2' : ''}>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{f.label}</label>
                  <input type={f.type ?? 'text'} value={form[f.key] ?? ''} onChange={e => setS(f.key as any, e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                </div>
              ))}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Senha *</label>
                <input type="password" value={form.password ?? ''} onChange={e => setS('password', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Responsável</h3>
              {!form.responsible
                ? <button onClick={() => setForm(p => ({ ...p, responsible: emptyResp() }))}
                    className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:underline">
                    <LuUserPlus className="h-3.5 w-3.5" /> Adicionar responsável
                  </button>
                : <button onClick={() => setForm(p => ({ ...p, responsible: null }))}
                    className="text-xs text-red-500 hover:underline">Remover</button>}
            </div>
            {form.responsible && (
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                {R_FIELDS.map(f => (
                  <div key={f.key} className={f.key === 'full_name' || f.key === 'address' ? 'col-span-2' : ''}>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{f.label}</label>
                    <input type={f.type ?? 'text'} value={form.responsible![f.key] ?? ''} onChange={e => setR(f.key, e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300">Cancelar</button>
          <button onClick={submit} disabled={saving} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
            {saving ? 'Salvando...' : 'Cadastrar aluno'}
          </button>
        </div>
      </div>
    </div>
  )
}
