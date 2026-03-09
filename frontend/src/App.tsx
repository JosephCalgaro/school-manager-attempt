import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthProvider";
import { useAuth } from "./hooks/useAuth";
import SignIn from "./pages/AuthPages/SignIn";
import NotFound from "./pages/OtherPage/NotFound";
import UserProfiles from "./pages/UserProfiles";
import Calendar from "./pages/Calendar";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import Home from "./pages/Dashboard/Home";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import AdminDashboard from "./pages/AdminPages/AdminDashboard";
import AdminStudents from "./pages/AdminPages/AdminStudents";
import AdminUsers from "./pages/AdminPages/AdminUsers";
import AdminClasses from "./pages/AdminPages/AdminClasses";
import AdminClassDetail from "./pages/AdminPages/AdminClassDetail";
import TeacherDashboard from "./pages/TeacherPages/TeacherDashboard";
import TeacherClassDetail from "./pages/TeacherPages/TeacherClassDetail";
import TeacherStudents from "./pages/TeacherPages/TeacherStudents";
import TeacherLessonPlans from "./pages/TeacherPages/TeacherLessonPlans";
import SecretaryStudents from "./pages/SecretaryPages/SecretaryStudents";
import SecretaryHome from "./pages/SecretaryPages/SecretaryHome";
import SecretaryClasses from "./pages/SecretaryPages/SecretaryClasses";
import SecretaryResponsibles from "./pages/SecretaryPages/SecretaryResponsibles";
import StudentDashboard from "./pages/StudentPages/StudentDashboard";
import ResponsibleDashboard from "./pages/ResponsiblePages/ResponsibleDashboard";

// Redireciona alunos para /student, demais usuários ficam no Home padrão
function HomeRedirect() {
  const { user } = useAuth()
  if (user?.role === 'STUDENT')    return <Navigate to="/student" replace />
  if (user?.role === 'SECRETARY')  return <Navigate to="/secretary" replace />
  if (user?.role === 'RESPONSIBLE') return <Navigate to="/responsible" replace />
  return <Home />
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <ScrollToTop />
        <Routes>
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index path="/" element={<HomeRedirect />} />

            {/* Student */}
            <Route path="/student" element={<StudentDashboard />} />

            {/* Responsible */}
            <Route path="/responsible" element={<ResponsibleDashboard />} />

            {/* Common */}
            <Route path="/profile" element={<UserProfiles />} />
            <Route path="/calendar" element={<Calendar />} />

            {/* Admin */}
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/students" element={<AdminStudents />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/classes" element={<AdminClasses />} />
            <Route path="/admin/classes/:id" element={<AdminClassDetail />} />
            <Route path="/admin/responsibles" element={<SecretaryResponsibles apiBase="/admin" />} />

            {/* Secretary */}
            <Route path="/secretary" element={<SecretaryHome />} />
            <Route path="/secretary/students" element={<SecretaryStudents />} />
            <Route path="/secretary/classes" element={<SecretaryClasses />} />
            <Route path="/secretary/responsibles" element={<SecretaryResponsibles />} />

            {/* Teacher */}
            <Route path="/teacher" element={<TeacherDashboard />} />
            <Route path="/teacher/students" element={<TeacherStudents />} />
            <Route path="/teacher/classes/:id" element={<TeacherClassDetail />} />
            <Route path="/teacher/lesson-plans" element={<TeacherLessonPlans />} />
          </Route>

          <Route path="/signin" element={<SignIn />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}
