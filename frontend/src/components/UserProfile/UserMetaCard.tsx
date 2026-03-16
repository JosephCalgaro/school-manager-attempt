import { useAuth } from "../../hooks/useAuth";

export default function UserMetaCard() {
  const { user } = useAuth();

  const roleLabels: Record<string, string> = {
    ADMIN:       "Administrador",
    TEACHER:     "Professor",
    SECRETARY:   "Secretaria",
    STUDENT:     "Aluno",
    RESPONSIBLE: "Responsável",
  };

  return (
    <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col items-center w-full gap-6 xl:flex-row">
          <div className="flex items-center justify-center w-20 h-20 overflow-hidden border border-gray-200 rounded-full bg-gray-100 dark:border-gray-800 dark:bg-gray-800">
            <span className="text-2xl font-semibold text-gray-600 dark:text-white/70">
              {user?.full_name?.charAt(0)?.toUpperCase() || "U"}
            </span>
          </div>
          <div>
            <h4 className="mb-2 text-lg font-semibold text-center text-gray-800 dark:text-white/90 xl:text-left">
              {user?.full_name || "Usuário"}
            </h4>
            <div className="flex flex-col items-center gap-1 text-center xl:flex-row xl:gap-3 xl:text-left">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {roleLabels[user?.role || ""] || user?.role || ""}
              </p>
              <div className="hidden h-3.5 w-px bg-gray-300 dark:bg-gray-700 xl:block"></div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {user?.email || ""}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
