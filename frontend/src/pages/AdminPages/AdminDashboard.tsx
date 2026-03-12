import { Navigate } from "react-router";

// A rota /admin não é usada: admin users são redirecionados para / (Home)
// que já exibe o painel correto. Este componente redireciona para evitar 404.
export default function AdminDashboard() {
  return <Navigate to="/" replace />;
}
