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
    isVisible: (userType) => userType === "agency" ,
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
  // {
  //   icon: <Media />,
  //   name: "Profile",
  //   path: "/profile",
  //   isVisible: (userType) => userType === "client",
  // },
  // {
  //   icon: <BoxCubeIcon />,
  //   name: "Settings",
  //   path: "/settings",
  //   isVisible: (userType) => userType === "agency" || userType === "client",
  // },
];

const othersItems: NavItem[] = [
  // Additional items can be added here with visibility conditions
  // {
  //   icon: <PlugInIcon />,
  //   name: "Admin",
  //   path: "/admin",
  //   isVisible: (userType) => userType === "agency",
  // },
];

interface AppSidebarProps {
  userType?: string | null;
}

const AppSidebar: React.FC<AppSidebarProps> = ({ userType }) => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const pathname = usePathname();
const {agencyName} = useAppSelector(state=>state.agency)
const {agencyName:fromClient} = useAppSelector(state=>state.client)
  // Get user type from localStorage if not provided as prop
  const [currentUserType, setCurrentUserType] = useState<string | null>(userType || null);

  useEffect(() => {
    if (!userType) {
      // Try to get user type from localStorage
      const storedUserType = localStorage.getItem("userType");
      setCurrentUserType(storedUserType);
    } else {
      setCurrentUserType(userType);
    }
  }, [userType]);

  // Filter navigation items based on user type and visibility conditions
  const getFilteredNavItems = (items: NavItem[]) => {
    return items.filter(item => {
      // If no visibility condition is set, show to all users
      if (!item.isVisible) return true;
      
      // Check visibility condition
      return item.isVisible(currentUserType);
    }).map(item => {
      // Filter subItems if they exist
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

  const renderMenuItems = (
    navItems: NavItem[],
    menuType: "main" | "others"
  ) => (
    <ul className="flex flex-col gap-4">
      {navItems.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(index, menuType)}
              className={`menu-item group  ${
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
                className={` ${
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? "menu-item-icon-active"
                    : "menu-item-icon-inactive"
                }`}
              >
                {nav.icon}
              </span>
              {(isExpanded || isHovered || isMobileOpen) && (
                <span className={`menu-item-text`}>{nav.name}</span>
              )}
              {(isExpanded || isHovered || isMobileOpen) && (
                <div 
                  className={`ml-auto w-5 h-5 transition-transform duration-200  ${
                    openSubmenu?.type === menuType &&
                    openSubmenu?.index === index
                      ? "rotate-180 text-brand-500"
                      : ""
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
                className={`menu-item group ${
                  isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                }`}
              >
                <span
                  className={`${
                    isActive(nav.path)
                      ? "menu-item-icon-active"
                      : "menu-item-icon-inactive"
                  }`}
                >
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className={`menu-item-text`}>{nav.name}</span>
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
              <ul className="mt-2 space-y-1 ml-9">
                {nav.subItems.map((subItem) => (
                  <li key={subItem.name}>
                    <Link
                      href={subItem.path}
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
                            } menu-dropdown-badge `}
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
                            } menu-dropdown-badge `}
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

  const [openSubmenu, setOpenSubmenu] = useState<{
    type: "main" | "others";
    index: number;
  } | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>(
    {}
  );
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isActive = useCallback((path: string) => path === pathname, [pathname]);

  useEffect(() => {
    // Check if the current path matches any submenu item
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

    // If no submenu item matches, close the open submenu
    if (!submenuMatched) {
      setOpenSubmenu(null);
    }
  }, [pathname, isActive, filteredNavItems, filteredOthersItems]);

  useEffect(() => {
    // Set the height of the submenu items when the submenu is opened
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

  // Show loading state while determining user type
  if (currentUserType === undefined) {
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
      >
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
          </div>
        </div>
      </aside>
    );
  }

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
        className={`py-8 flex  ${
          !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
        }`}
      >
        <Link href="/">
          {isExpanded || isHovered || isMobileOpen ? (
            <>
  <span className="text-lg font-semibold text-gray-800 dark:text-white/90">
    {agencyName || fromClient || "Agency"}
  </span>
            </>
          ) : (
  <span className="text-lg font-semibold text-gray-800 dark:text-white/90">
    {agencyName || fromClient || "Agency"}
  </span>
          )}
        </Link>
      </div>
      
      {/* User Type Badge
      {(isExpanded || isHovered || isMobileOpen) && currentUserType && (
        <div className="mb-4 px-2">
          <div className={`px-3 py-4 rounded-full text-xs font-medium text-center ${
            currentUserType === 'agency' 
              ? 'bg-blue-100 text-blue-700  dark:bg-blue-900/30 dark:text-blue-400'
              : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          }`}>
            {currentUserType === 'agency' ? 'Agency Owner' : 'Client'}
          </div>
        </div>
      )} */}

      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
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
                  <HorizontaLDots />
                )}
              </h2>
              {renderMenuItems(filteredNavItems, "main")}
            </div>

            {filteredOthersItems.length > 0 && (
              <div className="">
                <h2
                  className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                    !isExpanded && !isHovered
                      ? "lg:justify-center"
                      : "justify-start"
                  }`}
                >
                  {isExpanded || isHovered || isMobileOpen ? (
                    "Others"
                  ) : (
                    <HorizontaLDots />
                  )}
                </h2>
                {renderMenuItems(filteredOthersItems, "others")}
              </div>
            )}
          </div>
        </nav>
      </div>
    </aside>
  );
};

export default AppSidebar;