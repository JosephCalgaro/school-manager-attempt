import { Link } from "react-router";
import { LuCalendarDays } from "react-icons/lu";

export default function SidebarWidget() {
  const today = new Date();
  const dateStr = today.toLocaleDateString("pt-BR", {
    weekday: "short", day: "numeric", month: "short",
  });

  return (
    <div className="mx-auto mb-10 w-full max-w-60 rounded-2xl bg-gray-50 px-4 py-5 text-center dark:bg-white/[0.03]">
      <div className="mb-2 flex items-center justify-center gap-2 text-brand-500">
        <LuCalendarDays className="h-5 w-5" />
        <span className="text-sm font-semibold capitalize">{dateStr}</span>
      </div>
      <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
        Sistema de Gestão Escolar
      </p>
      <Link
        to="/calendar"
        className="flex items-center justify-center rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
      >
        Ver calendário
      </Link>
    </div>
  );
}
