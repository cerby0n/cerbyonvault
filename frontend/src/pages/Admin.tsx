import UserList from "../components/admin/UserList";
import Sidebar from "../components/Sidebar";
import TeamList from "../components/admin/TeamList";
import SSOSettings from "../components/admin/SSOSettings";
import NotificationSettings from "../components/admin/NotificationSettings";
import { RiTeamFill } from "react-icons/ri";
import { FaUser } from "react-icons/fa6";
import { MdSecurity } from "react-icons/md";
import { Bell } from "lucide-react";
import { useSearchParams } from "react-router-dom";


export default function Admin() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "members";

  return (
    <div className="flex min-h-screen overflow-hidden">
      <div className="shrink-0">
        <Sidebar />
      </div>
      <div className="flex min-w-0 w-full p-4 pl-0 ">
        <div className="tabs tabs-border tabs-x rounded w-full bg-base-100 mb-4">
          <label className="tab text-xl">
            <input
              type="radio"
              name="admin_tabs"
              checked={currentTab === "members"}
              onChange={() => setSearchParams({ tab: "members" })}
            />
            <FaUser className="me-2" size={20} />
            Members
          </label>

          <div className="tab-content">
            {currentTab === "members" && <UserList />}
          </div>
          <label className="tab text-xl">
            <input
              type="radio"
              name="admin_tabs"
              checked={currentTab === "teams"}
              onChange={() => setSearchParams({ tab: "teams" })}
            />
            <RiTeamFill className="me-2" size={23} />
            Teams
          </label>
          <div className="tab-content">
            {currentTab === "teams" && <TeamList />}
          </div>
          <label className="tab text-xl">
            <input
              type="radio"
              name="admin_tabs"
              checked={currentTab === "sso"}
              onChange={() => setSearchParams({ tab: "sso" })}
            />
            <MdSecurity className="me-2" size={23} />
            SSO Settings
          </label>
          <div className="tab-content">
            {currentTab === "sso" && <SSOSettings />}
          </div>
          <label className="tab text-xl">
            <input
              type="radio"
              name="admin_tabs"
              checked={currentTab === "notifications"}
              onChange={() => setSearchParams({ tab: "notifications" })}
            />
            <Bell className="me-2" size={23} />
            Notifications
          </label>
          <div className="tab-content">
            {currentTab === "notifications" && <NotificationSettings />}
          </div>
        </div>
      </div>
    </div>
  );
}
