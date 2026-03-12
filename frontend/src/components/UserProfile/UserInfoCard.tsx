import { useAuth } from "../../hooks/useAuth";

export default function UserInfoCard() {
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
      <div>
        <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-6">
          Informações Pessoais
        </h4>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-7 2xl:gap-x-32">
          <div>
            <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
              Nome Completo
            </p>
            <p className="text-sm font-medium text-gray-800 dark:text-white/90">
              {user?.fullName || "-"}
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
              Email
            </p>
            <p className="text-sm font-medium text-gray-800 dark:text-white/90">
              {user?.email || "-"}
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
              Cargo
            </p>
            <p className="text-sm font-medium text-gray-800 dark:text-white/90">
              {roleLabels[user?.role || ""] || user?.role || "-"}
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
              ID
            </p>
            <p className="text-sm font-medium text-gray-800 dark:text-white/90">
              {user?.id || "-"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
