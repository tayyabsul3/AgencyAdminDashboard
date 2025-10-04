"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSidebar } from "../context/SidebarContext";
import {
  BoxCubeIcon,
  CalenderIcon,
  ChevronDownIcon,
  GridIcon,
  HorizontaLDots,
  ListIcon,
  Media,
  PageIcon,
  PieChartIcon,
  PlugInIcon,
  TableIcon,
} from "../icons/index";
import { useAppSelector } from "@/redux/hooks";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  isVisible?: (userType: string | null) => boolean;
  subItems?: { 
    name: string; 
    path: string; 
    pro?: boolean; 
    new?: boolean;
    isVisible?: (userType: string | null) => boolean;
  }[];
};

// Define navigation items with visibility conditions
const navItems: NavItem[] = [
  {
    icon: <GridIcon />,
    name: "Agency",
    path: "/",
    isVisible: (userType) => userType === "agency",
  },
  {
    icon: <TableIcon />,
    name: "Usage",
    path: "/usage",
    isVisible: (userType) => userType === "agency",
  },
  {
    icon: <PieChartIcon />,
    name: "Seats",
    path: "/seats",
    isVisible: (userType) => userType === "agency",
  },
  {
    icon: <PageIcon />,
    name: "Profile",
    path: "/",
    isVisible: (userType) => userType === "client",
  },
  {
    icon: <CalenderIcon />,
    name: "Articles",
    path: "/articles",
    isVisible: (userType) => userType === "client",
  },
];

const othersItems: NavItem[] = [
  // Additional items can be added here with visibility conditions
];

interface AppSidebarProps {
  userType?: string | null;
}

const AppSidebar: React.FC<AppSidebarProps> = ({ userType }) => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const pathname = usePathname();
  const { agencyName } = useAppSelector(state => state.agency);
  const { agencyName: fromClient } = useAppSelector(state => state.client);
  
  const [currentUserType, setCurrentUserType] = useState<string | null>(userType || null);
  const [openSubmenu, setOpenSubmenu] = useState<{
    type: "main" | "others";
    index: number;
  } | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>({});
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!userType) {
      const storedUserType = localStorage.getItem("userType");
      setCurrentUserType(storedUserType);
    } else {
      setCurrentUserType(userType);
    }
  }, [userType]);

  // Filter navigation items based on user type and visibility conditions
  const getFilteredNavItems = (items: NavItem[]) => {
    return items.filter(item => {
      if (!item.isVisible) return true;
      return item.isVisible(currentUserType);
    }).map(item => {
      if (item.subItems) {
        return {
          ...item,
          subItems: item.subItems.filter(subItem => {
            if (!subItem.isVisible) return true;
            return subItem.isVisible(currentUserType);
          })
        };
      }
      return item;
    });
  };

  const filteredNavItems = getFilteredNavItems(navItems);
  const filteredOthersItems = getFilteredNavItems(othersItems);

  const isActive = useCallback((path: string) => path === pathname, [pathname]);

  useEffect(() => {
    let submenuMatched = false;
    ["main", "others"].forEach((menuType) => {
      const items = menuType === "main" ? filteredNavItems : filteredOthersItems;
      items.forEach((nav, index) => {
        if (nav.subItems) {
          nav.subItems.forEach((subItem) => {
            if (isActive(subItem.path)) {
              setOpenSubmenu({
                type: menuType as "main" | "others",
                index,
              });
              submenuMatched = true;
            }
          });
        }
      });
    });

    if (!submenuMatched) {
      setOpenSubmenu(null);
    }
  }, [pathname, isActive, filteredNavItems, filteredOthersItems]);

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

  const handleSubmenuToggle = (index: number, menuType: "main" | "others") => {
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

 const renderMenuItems = (
  navItems: NavItem[],
  menuType: "main" | "others"
) => (
  <ul className="flex flex-col gap-1">
    {navItems.map((nav, index) => (
      <li key={nav.name}>
        {nav.subItems ? (
          <button
            onClick={() => handleSubmenuToggle(index, menuType)}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group ${
              openSubmenu?.type === menuType && openSubmenu?.index === index
                ? "bg-gradient-to-r from-blue-500 to-cyan-500 shadow-lg"
                : "hover:bg-gray-50 border border-transparent"
            } ${
              !isExpanded && !isHovered
                ? "lg:justify-center"
                : "justify-start"
            }`}
          >
            <span
              className={`flex-shrink-0 transition-colors ${
                openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? "text-white"
                  : "text-gray-600 group-hover:text-blue-600"
              }`}
            >
              {nav.icon}
            </span>
            {(isExpanded || isHovered || isMobileOpen) && (
              <span className={`font-semibold flex-1 text-left ${
                openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? "text-white"
                  : "text-gray-700 group-hover:text-gray-900"
              }`}>
                {nav.name}
              </span>
            )}
            {(isExpanded || isHovered || isMobileOpen) && (
              <div 
                className={`w-5 h-5 transition-transform duration-200 ${
                  openSubmenu?.type === menuType &&
                  openSubmenu?.index === index
                    ? "rotate-180 text-white"
                    : "text-gray-400"
                }`}
              >
                <ChevronDownIcon />
              </div>
            )}
          </button>
        ) : (
          nav.path && (
            <Link
              href={nav.path}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive(nav.path)
                  ? "bg-gradient-to-r from-blue-500 to-cyan-500 shadow-lg"
                  : "hover:bg-gray-50 border border-transparent"
              } ${
                !isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "justify-start"
              }`}
            >
              <span
                className={`flex-shrink-0 transition-colors ${
                  isActive(nav.path)
                    ? "text-white"
                    : "text-gray-600 group-hover:text-blue-600"
                }`}
              >
                {nav.icon}
              </span>
              {(isExpanded || isHovered || isMobileOpen) && (
                <span className={`font-semibold ${
                  isActive(nav.path)
                    ? "text-white"
                    : "text-gray-700 group-hover:text-gray-900"
                }`}>
                  {nav.name}
                </span>
              )}
            </Link>
          )
        )}
        {nav.subItems && 
         nav.subItems.length > 0 && 
         (isExpanded || isHovered || isMobileOpen) && (
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
            <ul className="mt-2 space-y-1 ml-6">
              {nav.subItems.map((subItem) => (
                <li key={subItem.name}>
                  <Link
                    href={subItem.path}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                      isActive(subItem.path)
                        ? "bg-blue-50 text-blue-700 font-semibold border border-blue-200"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full transition-colors ${
                      isActive(subItem.path)
                        ? "bg-blue-500"
                        : "bg-gray-300 group-hover:bg-gray-400"
                    }`} />
                    <span className="flex-1">{subItem.name}</span>
                    <span className="flex items-center gap-1 ml-auto">
                      {subItem.new && (
                        <span
                          className={`px-2 py-1 rounded-full font-semibold ${
                            isActive(subItem.path)
                              ? "bg-blue-100 text-blue-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          New
                        </span>
                      )}
                      {subItem.pro && (
                        <span
                          className={`px-2 py-1 rounded-full font-semibold ${
                            isActive(subItem.path)
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
                          }`}
                        >
                          Pro
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

  if (currentUserType === undefined) {
    return (
      <aside
        className={`fixed mt-16 flex flex-col lg:mt-0 top-0 left-0 bg-white h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 
          ${
            isExpanded || isMobileOpen
              ? "w-[280px]"
              : isHovered
              ? "w-[280px]"
              : "w-[80px]"
          }
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0`}
      >
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-sm text-gray-500">Loading...</p>
          </div>
        </div>
      </aside>
    );
  }

return (
  <aside
    className={`fixed mt-16 flex flex-col lg:mt-0 top-0 left-0 bg-white h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 shadow-lg
      ${
        isExpanded || isMobileOpen
          ? "w-72"
          : isHovered
          ? "w-72"
          : "w-20"
      }
      ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
      lg:translate-x-0`}
    onMouseEnter={() => !isExpanded && setIsHovered(true)}
    onMouseLeave={() => setIsHovered(false)}
  >
    {/* Header */}
    <div className={`py-6 px-4 border-b border-gray-100 ${
      !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
    }`}>
      <Link href="/" className="flex items-center gap-3">
        {(isExpanded || isHovered || isMobileOpen) ? (
          <>
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold">Q</span>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-gray-900">
                {agencyName || fromClient || "Queryfuel"}
              </span>
              <span className="text-gray-500 capitalize font-medium">
                {currentUserType || "Dashboard"}
              </span>
            </div>
          </>
        ) : (
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-white font-bold">Q</span>
          </div>
        )}
      </Link>
    </div>

    {/* Navigation */}
    <div className="flex flex-col flex-1 overflow-y-auto duration-300 ease-linear no-scrollbar py-6">
      <nav className="flex-1">
        <div className="flex flex-col gap-2 px-4">
          {/* Main Menu */}
          <div>
            <h2
              className={`mb-4 font-semibold uppercase tracking-wider flex text-gray-500 ${
                !isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "justify-start"
              }`}
            >
              {isExpanded || isHovered || isMobileOpen ? (
                "Menu"
              ) : (
                <div className="w-6 h-1 bg-gray-400 rounded-full" />
              )}
            </h2>
            {renderMenuItems(filteredNavItems, "main")}
          </div>

          {/* Others Menu */}
          {filteredOthersItems.length > 0 && (
            <div className="mt-6">
              <h2
                className={`mb-4 font-semibold uppercase tracking-wider flex text-gray-500 ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Tools"
                ) : (
                  <div className="w-6 h-1 bg-gray-400 rounded-full" />
                )}
              </h2>
              {renderMenuItems(filteredOthersItems, "others")}
            </div>
          )}
        </div>
      </nav>

      {/* User Info Footer */}
      {(isExpanded || isHovered || isMobileOpen) && (
        <div className="mt-auto px-4 pb-6">
          <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-white font-bold">
                  {(agencyName || fromClient || "U").charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 truncate">
                  {agencyName || fromClient || "User"}
                </p>
                <p className="text-gray-600 capitalize font-medium">
                  {currentUserType || "Account"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  </aside>
);
};

export default AppSidebar;