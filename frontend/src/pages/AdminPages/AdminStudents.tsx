import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { ChevronDownIcon } from '../../icons';
import { LuSearch, LuX } from 'react-icons/lu';

interface Student {
  id: number;
  full_name: string;
  cpf: string;
  email: string;
  birth_date: string;
  address: string;
  created_at: string;
}

interface StudentDetails extends Student {
  rg: string;
  responsible_id: number;
  responsible?: {
    full_name: string;
    email: string;
    phone: string;
  };
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

  useEffect(() => {
    fetchStudents();
  }, [search, page]);

  const fetchStudents = async () => {
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
  };

  const fetchStudentDetails = async (studentId: number) => {
    try {
      setDetailsLoading(true);

      // Buscar detalhes básicos
      const detailsRes = await authFetch(`/admin/students/${studentId}`);
      const details = await detailsRes.json();
      setSelectedStudent(details);

      // Buscar turmas
      const classesRes = await authFetch(`/admin/students/${studentId}/classes`);
      const classes = await classesRes.json();
      setStudentClasses(classes);

      // Buscar frequência
      const attendanceRes = await authFetch(`/admin/students/${studentId}/attendance`);
      const attendance = await attendanceRes.json();
      setStudentAttendance(attendance);

      // Buscar atividades
      const assignmentsRes = await authFetch(`/admin/students/${studentId}/assignments`);
      const assignments = await assignmentsRes.json();
      setStudentAssignments(assignments);

      setActiveTab('info');
    } catch (error) {
      console.error('Erro ao buscar detalhes:', error);
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedStudent(null);
    setStudentClasses([]);
    setStudentAttendance(null);
    setStudentAssignments([]);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Gerenciar Alunos</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Total de alunos: <span className="font-semibold">{total}</span>
        </p>
      </div>

      {/* Busca */}
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

      {/* Tabela */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500 mx-auto"></div>
          </div>
        ) : students.length === 0 ? (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
            Nenhum aluno encontrado
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Nome
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      CPF
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Data de Nascimento
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Ação
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {students.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {student.full_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {student.email}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {student.cpf}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {new Date(student.birth_date).toLocaleDateString('pt-BR')}
                      </td>
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

            {/* Paginação */}
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

      {/* Modal de Detalhes */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header do Modal */}
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {selectedStudent.full_name}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <LuX className="w-6 h-6" />
              </button>
            </div>

            {/* Tabs */}
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
              </div>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-6">
              {detailsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500 mx-auto"></div>
                </div>
              ) : (
                <>
                  {/* Aba: Informações */}
                  {activeTab === 'info' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
                          <p className="text-gray-900 dark:text-white font-medium">{selectedStudent.email}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">CPF</p>
                          <p className="text-gray-900 dark:text-white font-medium">{selectedStudent.cpf}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">RG</p>
                          <p className="text-gray-900 dark:text-white font-medium">{selectedStudent.rg}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Data de Nascimento</p>
                          <p className="text-gray-900 dark:text-white font-medium">
                            {new Date(selectedStudent.birth_date).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-sm text-gray-600 dark:text-gray-400">Endereço</p>
                          <p className="text-gray-900 dark:text-white font-medium">{selectedStudent.address}</p>
                        </div>
                      </div>

                      {selectedStudent.responsible && (
                        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                            Responsável
                          </h3>
                          <div className="space-y-2">
                            <p className="text-gray-900 dark:text-white">{selectedStudent.responsible.full_name}</p>
                            <p className="text-gray-600 dark:text-gray-400">{selectedStudent.responsible.email}</p>
                            <p className="text-gray-600 dark:text-gray-400">{selectedStudent.responsible.phone}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Aba: Turmas */}
                  {activeTab === 'classes' && (
                    <div className="space-y-3">
                      {studentClasses.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400">Nenhuma turma encontrada</p>
                      ) : (
                        studentClasses.map((cls) => (
                          <div
                            key={cls.id}
                            className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                          >
                            <h4 className="font-semibold text-gray-900 dark:text-white">{cls.name}</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              Professor: {cls.teacher_name}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Horário: {cls.schedule}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Aba: Frequência */}
                  {activeTab === 'attendance' && studentAttendance && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-4 gap-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                          <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {studentAttendance.statistics.total}
                          </p>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                          <p className="text-sm text-gray-600 dark:text-gray-400">Presentes</p>
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {studentAttendance.statistics.present}
                          </p>
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                          <p className="text-sm text-gray-600 dark:text-gray-400">Ausentes</p>
                          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                            {studentAttendance.statistics.absent}
                          </p>
                        </div>
                        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                          <p className="text-sm text-gray-600 dark:text-gray-400">Percentual</p>
                          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                            {studentAttendance.statistics.percentage}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 max-h-64 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                            <tr>
                              <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-300">Data</th>
                              <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-300">Turma</th>
                              <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-300">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {studentAttendance.attendance.map((att) => (
                              <tr key={att.id}>
                                <td className="px-4 py-2 text-gray-900 dark:text-white">
                                  {new Date(att.date).toLocaleDateString('pt-BR')}
                                </td>
                                <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                                  {att.class_name}
                                </td>
                                <td className="px-4 py-2">
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                                      att.present
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                                        : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                                    }`}
                                  >
                                    {att.present ? 'Presente' : 'Ausente'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Aba: Atividades */}
                  {activeTab === 'assignments' && (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {studentAssignments.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400">Nenhuma atividade encontrada</p>
                      ) : (
                        studentAssignments.map((assignment) => (
                          <div
                            key={assignment.id}
                            className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="font-semibold text-gray-900 dark:text-white">
                                  {assignment.title}
                                </h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  Turma: {assignment.class_name}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  Tipo: {assignment.type}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  Vencimento: {new Date(assignment.due_date).toLocaleDateString('pt-BR')}
                                </p>
                              </div>
                              <div className="text-right">
                                {assignment.score !== null ? (
                                  <div>
                                    <p className="text-2xl font-bold text-brand-600 dark:text-brand-400">
                                      {assignment.score}
                                    </p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">
                                      de {assignment.max_score}
                                    </p>
                                  </div>
                                ) : (
                                  <p className="text-gray-500 dark:text-gray-400 text-sm">Sem nota</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
