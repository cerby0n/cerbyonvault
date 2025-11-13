import React from "react";
import { Link, useLocation } from "react-router-dom";

interface NavItemProps {
  icon: React.ReactNode;
  activeIcon: React.ReactNode;
  label: string;
  link: string;
  isOpen: boolean;
}

export default function NavItem({
  icon,
  activeIcon,
  label,
  link,
}: NavItemProps) {
  const location = useLocation();

  const isActive = location.pathname === link;

  return (
    <div className="flex items-center justify-center w-full relative">
      <Link
        to={link}
        className="group flex items-center justify-center w-full"
      >
        <div
          className={`
            flex items-center justify-center relative
           w-10 h-10 transition-all duration-150
            ${isActive ? "bg-secondary/25 rounded-xl shadow-sm" : ""}
            group-hover:bg-secondary/25 group-hover:rounded-xl
          `}
        >
          <span className={`text-xl ${isActive ? "text-primary" : "text-primary/60"} group-hover:text-primary`}>
            {isActive ? activeIcon : icon}
          </span>
          {/* Tooltip on hover */}
          <div className="absolute left-full ml-2 px-3 py-1 bg-base-300 text-base-content rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
            {label}
          </div>
        </div>
      </Link>
    </div>
  );
}
