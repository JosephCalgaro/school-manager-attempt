import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";

import {
  BoxCubeIcon,
  CalenderIcon,
  ChevronDownIcon,
  GridIcon,
  HorizontaLDots,
  ListIcon,
  PageIcon,
  PieChartIcon,
  PlugInIcon,
  TableIcon,
  UserCircleIcon,
  ShootingStarIcon,
  DocsIcon,
  TaskIcon,
  FolderIcon,
} from "../icons";
import { LuUsers } from "react-icons/lu";
import { useSidebar } from "../context/SidebarContext";
import SidebarWidget from "./SidebarWidget";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: { name: string; path: string; pro?: boolean; new?: boolean }[];
};

const navItems: NavItem[] = [
  {
    icon: <GridIcon />,
    name: "Dashboard",
    subItems: [{ name: "Ecommerce", path: "/", pro: false }],
  },
  {
    icon: <CalenderIcon />,
    name: "Calendário",
    path: "/calendar",
  },
  {
    icon: <UserCircleIcon />,
    name: "Perfil do Usuário",
    path: "/profile",
  },
  {
    name: "Formulários",
    icon: <ListIcon />,
    subItems: [{ name: "Elementos de Formulário", path: "/form-elements", pro: false }],
  },
  {
    name: "Tabelas",
    icon: <TableIcon />,
    subItems: [{ name: "Tabelas Básicas", path: "/basic-tables", pro: false }],
  },
  {
    name: "Páginas",
    icon: <PageIcon />,
    subItems: [
      { name: "Página em Branco", path: "/blank", pro: false },
      { name: "Erro 404", path: "/error-404", pro: false },
    ],
  },
];

// Categoria "Exemplo" - todas as páginas do template
const exemploItems: NavItem[] = [
  {
    icon: <PieChartIcon />,
    name: "Gráficos",
    subItems: [
      { name: "Gráfico de Linha", path: "/line-chart", pro: false },
      { name: "Gráfico de Barras", path: "/bar-chart", pro: false },
    ],
  },
  {
    icon: <BoxCubeIcon />,
    name: "Elementos UI",
    subItems: [
      { name: "Alertas", path: "/alerts", pro: false },
      { name: "Avatar", path: "/avatars", pro: false },
      { name: "Badge", path: "/badge", pro: false },
      { name: "Botões", path: "/buttons", pro: false },
      { name: "Imagens", path: "/images", pro: false },
      { name: "Vídeos", path: "/videos", pro: false },
    ],
  },
  {
    icon: <PlugInIcon />,
    name: "Autenticação",
    subItems: [
      { name: "Sign In", path: "/signin", pro: false },
    ],
  },
  {
    icon: <DocsIcon />,
    name: "Formulários",
    subItems: [
      { name: "Elementos de Formulário", path: "/form-elements", pro: false },
    ],
  },
  {
    icon: <TableIcon />,
    name: "Tabelas",
    subItems: [
      { name: "Tabelas Básicas", path: "/basic-tables", pro: false },
    ],
  },
  {
    icon: <CalenderIcon />,
    name: "Calendário",
    path: "/calendar",
  },
  {
    icon: <UserCircleIcon />,
    name: "Perfil",
    path: "/profile",
  },
  {
    icon: <PageIcon />,
    name: "Páginas",
    subItems: [
      { name: "Página em Branco", path: "/blank", pro: false },
    ],
  },
];

// Categoria "Admin"
const adminItems: NavItem[] = [
  {
    icon: <BoxCubeIcon />,
    name: "Painel Admin",
    path: "/admin",
  },
  {
    icon: <UserCircleIcon />,
    name: "Gerenciar Alunos",
    path: "/admin/students",
  },
  {
    icon: <LuUsers />,
    name: "Gerenciar Usuários",
    path: "/admin/users",
  },
];

// Categoria "VIP"
const vipItems: NavItem[] = [
  {
    icon: <ShootingStarIcon />,
    name: "Área VIP",
    subItems: [
      { name: "Dashboard VIP", path: "/", pro: false, new: true },
      { name: "Relatórios VIP", path: "/basic-tables", pro: false, new: true },
    ],
  },
  {
    icon: <TaskIcon />,
    name: "Tarefas VIP",
    subItems: [
      { name: "Minhas Tarefas", path: "/blank", pro: false, new: true },
      { name: "Calendário VIP", path: "/calendar", pro: false, new: true },
    ],
  },
  {
    icon: <FolderIcon />,
    name: "Recursos VIP",
    subItems: [
      { name: "Gráficos Avançados", path: "/line-chart", pro: false, new: true },
      { name: "Análises", path: "/bar-chart", pro: false, new: true },
    ],
  },
];

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const location = useLocation();

  const [openSubmenu, setOpenSubmenu] = useState<{
    type: "main" | "others" | "exemplo" | "vip" | "admin";
    index: number;
  } | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>(
    {}
  );
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isActive = useCallback(
    (path: string) => location.pathname === path,
    [location.pathname]
  );

  useEffect(() => {
    let submenuMatched = false;
    const menuGroups: { type: "main" | "others" | "exemplo" | "vip" | "admin"; items: NavItem[] }[] = [
      { type: "main", items: navItems },
      { type: "admin", items: adminItems },
      { type: "exemplo", items: exemploItems },
      { type: "vip", items: vipItems },
    ];

    menuGroups.forEach(({ type, items }) => {
      items.forEach((nav, index) => {
        if (nav.subItems) {
          nav.subItems.forEach((subItem) => {
            if (isActive(subItem.path)) {
              setOpenSubmenu({ type, index });
              submenuMatched = true;
            }
          });
        }
      });
    });

    if (!submenuMatched) {
      setOpenSubmenu(null);
    }
  }, [location, isActive]);

  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prevHeights) => ({
          ...prevHeights,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (index: number, menuType: "main" | "others" | "exemplo" | "vip" | "admin") => {
    setOpenSubmenu((prevOpenSubmenu) => {
      if (
        prevOpenSubmenu &&
        prevOpenSubmenu.type === menuType &&
        prevOpenSubmenu.index === index
      ) {
        return null;
      }
      return { type: menuType, index };
    });
  };

  const renderMenuItems = (items: NavItem[], menuType: "main" | "others" | "exemplo" | "vip" | "admin") => (
    <ul className="flex flex-col gap-4">
      {items.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(index, menuType)}
              className={`menu-item group ${
                openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? "menu-item-active"
                  : "menu-item-inactive"
              } cursor-pointer ${
                !isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "lg:justify-start"
              }`}
            >
              <span
                className={`menu-item-icon-size  ${
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? "menu-item-icon-active"
                    : "menu-item-icon-inactive"
                }`}
              >
                {nav.icon}
              </span>
              {(isExpanded || isHovered || isMobileOpen) && (
                <span className="menu-item-text">{nav.name}</span>
              )}
              {(isExpanded || isHovered || isMobileOpen) && (
                <ChevronDownIcon
                  className={`ml-auto w-5 h-5 transition-transform duration-200 ${
                    openSubmenu?.type === menuType &&
                    openSubmenu?.index === index
                      ? "rotate-180 text-brand-500"
                      : ""
                  }`}
                />
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                to={nav.path}
                className={`menu-item group ${
                  isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                }`}
              >
                <span
                  className={`menu-item-icon-size ${
                    isActive(nav.path)
                      ? "menu-item-icon-active"
                      : "menu-item-icon-inactive"
                  }`}
                >
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className="menu-item-text">{nav.name}</span>
                )}
              </Link>
            )
          )}
          {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
            <div
              ref={(el) => {
                subMenuRefs.current[`${menuType}-${index}`] = el;
              }}
              className="overflow-hidden transition-all duration-300"
              style={{
                height:
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? `${subMenuHeight[`${menuType}-${index}`]}px`
                    : "0px",
              }}
            >
              <ul className="mt-2 space-y-1 ml-9">
                {nav.subItems.map((subItem) => (
                  <li key={subItem.name}>
                    <Link
                      to={subItem.path}
                      className={`menu-dropdown-item ${
                        isActive(subItem.path)
                          ? "menu-dropdown-item-active"
                          : "menu-dropdown-item-inactive"
                      }`}
                    >
                      {subItem.name}
                      <span className="flex items-center gap-1 ml-auto">
                        {subItem.new && (
                          <span
                            className={`ml-auto ${
                              isActive(subItem.path)
                                ? "menu-dropdown-badge-active"
                                : "menu-dropdown-badge-inactive"
                            } menu-dropdown-badge`}
                          >
                            new
                          </span>
                        )}
                        {subItem.pro && (
                          <span
                            className={`ml-auto ${
                              isActive(subItem.path)
                                ? "menu-dropdown-badge-active"
                                : "menu-dropdown-badge-inactive"
                            } menu-dropdown-badge`}
                          >
                            pro
                          </span>
                        )}
                      </span>
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
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 
        ${
          isExpanded || isMobileOpen
            ? "w-[290px]"
            : isHovered
            ? "w-[290px]"
            : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`py-8 flex ${
          !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
        }`}
      >
        <Link to="/">
          {isExpanded || isHovered || isMobileOpen ? (
            <>
              <img
                className="dark:hidden"
                src="/images/logo/logo.svg"
                alt="Logo"
                width={150}
                height={40}
              />
              <img
                className="hidden dark:block"
                src="/images/logo/logo-dark.svg"
                alt="Logo"
                width={150}
                height={40}
              />
            </>
          ) : (
            <img
              src="/images/logo/logo-icon.svg"
              alt="Logo"
              width={32}
              height={32}
            />
          )}
        </Link>
      </div>
      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            {/* Categoria: Menu Principal */}
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Menu"
                ) : (
                  <HorizontaLDots className="size-6" />
                )}
              </h2>
              {renderMenuItems(navItems, "main")}
            </div>

            {/* Categoria: Admin */}
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] font-bold ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "justify-start"
                }`}
                style={{ color: "#ef4444" }}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  <span className="flex items-center gap-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#ef4444" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
                    </svg>
                    Admin
                  </span>
                ) : (
                  <HorizontaLDots />
                )}
              </h2>
              {renderMenuItems(adminItems, "admin")}
            </div>

            {/* Categoria: Exemplo */}
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Exemplo"
                ) : (
                  <HorizontaLDots />
                )}
              </h2>
              {renderMenuItems(exemploItems, "exemplo")}
            </div>

            {/* Categoria: VIP */}
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] font-bold ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "justify-start"
                }`}
                style={{ color: "#f59e0b" }}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  <span className="flex items-center gap-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                    </svg>
                    VIP
                  </span>
                ) : (
                  <HorizontaLDots />
                )}
              </h2>
              {renderMenuItems(vipItems, "vip")}
            </div>
          </div>
        </nav>
        {isExpanded || isHovered || isMobileOpen ? <SidebarWidget /> : null}
      </div>
    </aside>
  );
};

export default AppSidebar;
