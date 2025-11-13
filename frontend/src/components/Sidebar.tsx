import { useEffect, useState } from "react";
import NavItem from "./items/NavItem";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "./items/Avatar";
import {
  AiOutlineSafetyCertificate,
  AiFillSafetyCertificate,
} from "react-icons/ai";
import {
  HiMiniKey,
  HiOutlineKey,
  HiGlobeAlt,
  HiOutlineGlobeAlt,
} from "react-icons/hi2";
import { MdOutlineSpaceDashboard, MdSpaceDashboard } from "react-icons/md";
import { RiTeamLine, RiTeamFill } from "react-icons/ri";
import ThemeToggle from "../utils/ThemeToggle";
//import { MdMenu } from "react-icons/md";

export default function Sidebar() {
  const [isOpen] = useState(() => {
    const savedState = localStorage.getItem("sidebarOpen");
    return savedState === null ? true : JSON.parse(savedState);
  });
  const { logoutUser, userData } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    console.log(userData);
  }, []);
  const handleLogout = async () => {
    await logoutUser();
    navigate("/login");
  };

  useEffect(() => {
    localStorage.setItem("sidebarOpen", JSON.stringify(isOpen));
  }, [isOpen]);

  /*const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };*/
  const NAV_ITEMS = [
    {
      label: "Dashboard",
      icon: MdOutlineSpaceDashboard,
      activeIcon: MdSpaceDashboard,
      to: "/",
    },
    {
      label: "Certificates",
      icon: AiOutlineSafetyCertificate,
      activeIcon: AiFillSafetyCertificate,
      to: "/certificates",
    },
    {
      label: "Private key",
      icon: HiOutlineKey,
      activeIcon: HiMiniKey,
      to: "/private-key",
    },
    {
      label: "Websites",
      icon: HiOutlineGlobeAlt,
      activeIcon: HiGlobeAlt,
      to: "/websites",
    },
    {
      label: "Teams",
      icon: RiTeamLine,
      activeIcon: RiTeamFill,
      to: "/teams",
      adminOnly: true,
    },
  ];

  return (
    <aside className="left-0 h-full z-30 flex flex-col  w-18 shrink-0 sticky top-0 justify-between">
      <div>
        <div className="flex items-center justify-center h-10"></div>
        <nav className="flex flex-1 flex-col gap-y-4">
          {NAV_ITEMS.filter(
            (item) => !item.adminOnly || userData?.is_admin
          ).map((item) => (
            <NavItem
              key={item.to}
              isOpen={isOpen}
              icon={<item.icon size={28} />}
              activeIcon={<item.activeIcon size={28} />}
              label={item.label}
              link={item.to}
            />
          ))}
        </nav>
      </div>
      <div className="flex flex-col items-center "></div>

      {/* User Profile */}
      <div className="p-4 flex flex-col items-center gap-4 mb-8">
        <ThemeToggle />
        <div className="dropdown dropdown-hover dropdown-right dropdown-end">
          <Avatar
            firstname={userData?.first_name}
            lastname={userData?.last_name}
            profileImage={userData?.profile_image}
          />
          <ul
            tabIndex={0}
            className="dropdown-content menu bg-base-100 rounded z-1 w-52  p-2 shadow-sm"
          >
            <li>
              <button onClick={handleLogout}>Logout</button>
            </li>
          </ul>
        </div>
      </div>
    </aside>
  );
}
