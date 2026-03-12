import { useCallback } from "react";
import { Link, useLocation } from "react-router";

import {
  GridIcon,
  HorizontaLDots,
  UserCircleIcon,
} from "../icons";
import { LuUsers, LuBookOpen, LuGraduationCap, LuCalendarDays, LuHouse, LuKanban } from "react-icons/lu";
import { useSidebar } from "../context/SidebarContext";
import { useAuth } from "../hooks/useAuth";
import SidebarWidget from "./SidebarWidget";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path: string;
};

// ── Itens comuns a todos os usuários ──────────────────────────────────────────
const commonItems: NavItem[] = [
  { icon: <GridIcon />, name: "Início", path: "/" },
  { icon: <UserCircleIcon />, name: "Meu Perfil", path: "/profile" },
  { icon: <LuCalendarDays />, name: "Calendário", path: "/calendar" },
];

// ── Itens exclusivos do Admin ─────────────────────────────────────────────────
const adminItems: NavItem[] = [
  { icon: <LuGraduationCap />, name: "Gerenciar Alunos",       path: "/admin/students" },
  { icon: <LuUsers />,         name: "Gerenciar Usuários",      path: "/admin/users" },
  { icon: <LuBookOpen />,      name: "Gerenciar Turmas",        path: "/admin/classes" },
  { icon: <LuUsers />,         name: "Gerenciar Responsáveis",  path: "/admin/responsibles" },
  { icon: <LuKanban />,        name: "CRM",                    path: "/admin/crm" },
];

// ── Itens exclusivos da Secretaria ────────────────────────────────────────────
const secretaryItems: NavItem[] = [
  { icon: <LuGraduationCap />, name: "Alunos",        path: "/secretary/students" },
  { icon: <LuBookOpen />,      name: "Turmas",         path: "/secretary/classes" },
  { icon: <LuUsers />,         name: "Responsáveis",   path: "/secretary/responsibles" },
  { icon: <LuKanban />,        name: "CRM",            path: "/secretary/crm" },
];

// ── Itens exclusivos do Professor ─────────────────────────────────────────────
const teacherItems: NavItem[] = [
  { icon: <LuBookOpen />,      name: "Minhas Turmas",    path: "/teacher" },
  { icon: <LuUsers />,         name: "Meus Alunos",      path: "/teacher/students" },
  { icon: <LuCalendarDays />,  name: "Planos de Aula",   path: "/teacher/lesson-plans" },
];

// ── Itens do Responsável ──────────────────────────────────────────────────────
const responsibleItems: NavItem[] = [
  { icon: <LuHouse />,         name: "Painel",      path: "/responsible" },
  { icon: <UserCircleIcon />,  name: "Meu Perfil",  path: "/profile" },
  { icon: <LuCalendarDays />,  name: "Calendário",  path: "/calendar" },
];

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const { user } = useAuth();
  const location = useLocation();

  const role = (user?.role || "").toUpperCase();

  const isActive = useCallback((path: string) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname === '/secretary' || location.pathname === '/responsible';
    }
    return location.pathname === path;
  }, [location.pathname]);

  const renderMenuItems = (items: NavItem[]) => (
    <ul className="flex flex-col gap-4">
      {items.map((nav) => (
        <li key={nav.name}>
          <Link
            to={nav.path}
            className={`menu-item group ${isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"}`}
          >
            <span className={`menu-item-icon-size ${isActive(nav.path) ? "menu-item-icon-active" : "menu-item-icon-inactive"}`}>
              {nav.icon}
            </span>
            {(isExpanded || isHovered || isMobileOpen) && (
              <span className="menu-item-text">{nav.name}</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 ${isExpanded || isMobileOpen ? "w-[290px]" : isHovered ? "w-[290px]" : "w-[90px]"} ${isMobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`py-8 flex ${!isExpanded && !isHovered ? "lg:justify-center" : "justify-start"}`}>
        <Link to="/">
          {isExpanded || isHovered || isMobileOpen ? (
            <>
              <img className="dark:hidden" src="/images/logo/logo.svg" alt="Logo" width={150} height={40} />
              <img className="hidden dark:block" src="/images/logo/logo-dark.svg" alt="Logo" width={150} height={40} />
            </>
          ) : (
            <img src="/images/logo/logo-icon.svg" alt="Logo" width={32} height={32} />
          )}
        </Link>
      </div>

      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2 className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${!isExpanded && !isHovered ? "lg:justify-center" : "justify-start"}`}>
                {isExpanded || isHovered || isMobileOpen ? "Menu" : <HorizontaLDots className="size-6" />}
              </h2>
              {role !== "RESPONSIBLE" && renderMenuItems(commonItems)}
            </div>

            {role === "ADMIN" && (
              <div>{renderMenuItems(adminItems)}</div>
            )}

            {role === "SECRETARY" && (
              <div>{renderMenuItems(secretaryItems)}</div>
            )}

            {role === "TEACHER" && (
              <div>
                <h2 className={`mb-4 text-xs uppercase flex leading-[20px] font-bold ${!isExpanded && !isHovered ? "lg:justify-center" : "justify-start"}`} style={{ color: "#0d9488" }}>
                  {isExpanded || isHovered || isMobileOpen ? (
                    <span className="flex items-center gap-1"><LuBookOpen size={14} /> Professor</span>
                  ) : <HorizontaLDots />}
                </h2>
                {renderMenuItems(teacherItems)}
              </div>
            )}

            {role === "RESPONSIBLE" && (
              <div>
                <h2 className={`mb-4 text-xs uppercase flex leading-[20px] font-bold ${!isExpanded && !isHovered ? "lg:justify-center" : "justify-start"}`} style={{ color: "#7c3aed" }}>
                  {isExpanded || isHovered || isMobileOpen ? (
                    <span className="flex items-center gap-1"><LuGraduationCap size={14} /> Responsável</span>
                  ) : <HorizontaLDots />}
                </h2>
                {renderMenuItems(responsibleItems)}
              </div>
            )}
          </div>
        </nav>
        {(isExpanded || isHovered || isMobileOpen) && <SidebarWidget />}
      </div>
    </aside>
  );
};

export default AppSidebar;
