import TeacherDashboard from '../TeacherPages/TeacherDashboard'

export default function AdminClasses() {
  return (
    <TeacherDashboard
      apiBase="/admin"
      detailBasePath="/admin/classes"
      allowedRoles={['ADMIN']}
      title="Turmas da Escola"
    />
  )
}
