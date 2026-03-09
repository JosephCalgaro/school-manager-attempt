import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";

import {
  ChevronDownIcon,
  GridIcon,
  HorizontaLDots,
  UserCircleIcon,
} from "../icons";
import { LuUsers, LuBookOpen, LuGraduationCap, LuCalendarDays, LuHouse } from "react-icons/lu";
import { useSidebar } from "../context/SidebarContext";
import { useAuth } from "../hooks/useAuth";
import SidebarWidget from "./SidebarWidget";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: { name: string; path: string; pro?: boolean; new?: boolean }[];
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
];

// ── Itens exclusivos da Secretaria ────────────────────────────────────────────
const secretaryItems: NavItem[] = [
  { icon: <LuGraduationCap />, name: "Alunos",        path: "/secretary/students" },
  { icon: <LuBookOpen />,      name: "Turmas",         path: "/secretary/classes" },
  { icon: <LuUsers />,         name: "Responsáveis",   path: "/secretary/responsibles" },
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

type MenuType = "common" | "admin" | "secretary" | "teacher" | "responsible";

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const { user } = useAuth();
  const location = useLocation();

  const [openSubmenu, setOpenSubmenu] = useState<{ type: MenuType; index: number } | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>({});
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const role = (user?.role || "").toUpperCase();
  const isActive = useCallback((path: string) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname === '/secretary' || location.pathname === '/responsible'
    }
    return location.pathname === path
  }, [location.pathname]);

  useEffect(() => {
    let submenuMatched = false;
    const menuGroups: { type: MenuType; items: NavItem[] }[] = [
      { type: "common", items: commonItems },
      { type: "admin", items: adminItems },
      { type: "secretary", items: secretaryItems },
      { type: "teacher", items: teacherItems },
      { type: "responsible", items: responsibleItems },
    ];
    menuGroups.forEach(({ type, items }) => {
      items.forEach((nav, index) => {
        if (nav.subItems) {
          nav.subItems.forEach((subItem) => {
            if (isActive(subItem.path)) { setOpenSubmenu({ type, index }); submenuMatched = true; }
          });
        }
      });
    });
    if (!submenuMatched) setOpenSubmenu(null);
  }, [location, isActive]);

  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prev) => ({ ...prev, [key]: subMenuRefs.current[key]?.scrollHeight || 0 }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (index: number, menuType: MenuType) => {
    setOpenSubmenu((prev) => {
      if (prev && prev.type === menuType && prev.index === index) return null;
      return { type: menuType, index };
    });
  };

  const renderMenuItems = (items: NavItem[], menuType: MenuType) => (
    <ul className="flex flex-col gap-4">
      {items.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(index, menuType)}
              className={`menu-item group ${openSubmenu?.type === menuType && openSubmenu?.index === index ? "menu-item-active" : "menu-item-inactive"} cursor-pointer ${!isExpanded && !isHovered ? "lg:justify-center" : "lg:justify-start"}`}
            >
              <span className={`menu-item-icon-size ${openSubmenu?.type === menuType && openSubmenu?.index === index ? "menu-item-icon-active" : "menu-item-icon-inactive"}`}>{nav.icon}</span>
              {(isExpanded || isHovered || isMobileOpen) && <span className="menu-item-text">{nav.name}</span>}
              {(isExpanded || isHovered || isMobileOpen) && (
                <ChevronDownIcon className={`ml-auto w-5 h-5 transition-transform duration-200 ${openSubmenu?.type === menuType && openSubmenu?.index === index ? "rotate-180 text-brand-500" : ""}`} />
              )}
            </button>
          ) : (
            nav.path && (
              <Link to={nav.path} className={`menu-item group ${isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"}`}>
                <span className={`menu-item-icon-size ${isActive(nav.path) ? "menu-item-icon-active" : "menu-item-icon-inactive"}`}>{nav.icon}</span>
                {(isExpanded || isHovered || isMobileOpen) && <span className="menu-item-text">{nav.name}</span>}
              </Link>
            )
          )}
          {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
            <div
              ref={(el) => { subMenuRefs.current[`${menuType}-${index}`] = el; }}
              className="overflow-hidden transition-all duration-300"
              style={{ height: openSubmenu?.type === menuType && openSubmenu?.index === index ? `${subMenuHeight[`${menuType}-${index}`]}px` : "0px" }}
            >
              <ul className="mt-2 space-y-1 ml-9">
                {nav.subItems.map((subItem) => (
                  <li key={subItem.name}>
                    <Link to={subItem.path} className={`menu-dropdown-item ${isActive(subItem.path) ? "menu-dropdown-item-active" : "menu-dropdown-item-inactive"}`}>
                      {subItem.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
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
              {role !== "RESPONSIBLE" && renderMenuItems(commonItems, "common")}
            </div>

            {role === "ADMIN" && (
              <div>
                {renderMenuItems(adminItems, "admin")}
              </div>
            )}

            {role === "SECRETARY" && (
              <div>
                {renderMenuItems(secretaryItems, "secretary")}
              </div>
            )}

            {role === "TEACHER" && (
              <div>
                <h2 className={`mb-4 text-xs uppercase flex leading-[20px] font-bold ${!isExpanded && !isHovered ? "lg:justify-center" : "justify-start"}`} style={{ color: "#0d9488" }}>
                  {isExpanded || isHovered || isMobileOpen ? (
                    <span className="flex items-center gap-1"><LuBookOpen size={14} /> Professor</span>
                  ) : <HorizontaLDots />}
                </h2>
                {renderMenuItems(teacherItems, "teacher")}
              </div>
            )}

            {role === "RESPONSIBLE" && (
              <div>
                <h2 className={`mb-4 text-xs uppercase flex leading-[20px] font-bold ${!isExpanded && !isHovered ? "lg:justify-center" : "justify-start"}`} style={{ color: "#7c3aed" }}>
                  {isExpanded || isHovered || isMobileOpen ? (
                    <span className="flex items-center gap-1"><LuGraduationCap size={14} /> Responsável</span>
                  ) : <HorizontaLDots />}
                </h2>
                {renderMenuItems(responsibleItems, "responsible")}
              </div>
            )}
          </div>
        </nav>
        {isExpanded || isHovered || isMobileOpen ? <SidebarWidget /> : null}
      </div>
    </aside>
  );
};

export default AppSidebar;
