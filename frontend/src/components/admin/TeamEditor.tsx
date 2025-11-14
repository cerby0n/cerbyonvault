import { useEffect, useRef, useState } from "react";
import useAxios from "../../axios/useAxios";
import { useToast } from "../ToastProvider";
import ConfirmModal from "../modals/ConfirmModal";
import TeamNotifications from "./TeamNotifications";
import { Save, Trash2, Minus, ArrowLeft, Users, Bell } from "lucide-react";

export default function TeamEditor({ team, onClose, onSave }: any) {
  const axiosInstance = useAxios();
  const { notify } = useToast();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [members, setMembers] = useState<any[]>(team.members || []);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [teamName, setTeamName] = useState(team.name);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"members" | "notifications">("members");

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await axiosInstance.get("/users/");
        setAllUsers(Array.isArray(res.data) ? res.data : []);
      } catch {
        notify("❌ Failed to fetch users", "error");
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [search]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setSearch("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleAdd = (user: any) => {
    if (!members.find((m) => m.id === user.id)) {
      setMembers((prev) => [...prev, user]);
    }
  };

  const handleRemove = (userId: number) => {
    setMembers((prev) => prev.filter((m) => m.id !== userId));
  };

  const handleSave = async () => {
    try {
      await axiosInstance.put(`/admin/teams/${team.id}/update_members/`, {
        name: teamName,
        user_ids: members.map((m) => m.id),
      });
      notify("✅ Team updated", "success");
      onSave();
      onClose();
    } catch {
      notify("❌ Failed to update team", "error");
    }
  };

  const handleDeleteTeam = async () => {
    try {
      await axiosInstance.delete(`/admin/teams/${team.id}/delete/`);
      notify("✅ Team deleted", "success");
      onSave();
      onClose();
    } catch {
      notify("❌ Failed to delete team", "error");
    }
  };

  const filteredUsers = allUsers.filter(
    (u) =>
      !members.some((m) => m.id === u.id) &&
      `${u.first_name} ${u.last_name} ${u.email}`
        .toLowerCase()
        .includes(search.toLowerCase())
  );

  return (
    <>
      <div className="flex items-center justify-between p-6 bg-base-100 rounded-xl border border-base-100">
        <div className="flex items-center gap-2 group">
          <input
            className="text-xl font-bold rounded px-2  outline-base-300 border-none"
            type="text"
            value={teamName}
            size={(teamName?.length ?? 0) || 1}
            onChange={(e) => setTeamName(e.target.value)}
          />
        </div>
        <div className="space-x-2">
          <button className="btn btn-primary" onClick={handleSave}>
            <Save size={18} />
            Save
          </button>
          <button
            className="btn btn-error"
            onClick={() => setShowConfirmModal(true)}
          >
            <Trash2 size={18} />
            Delete
          </button>
        </div>
      </div>
      {showConfirmModal && (
        <ConfirmModal
          message={
            <>
              Are you sure you want to delete this team ?
              <br />
              This action cannot be undone.
            </>
          }
          onCancel={() => setShowConfirmModal(false)}
          onConfirm={handleDeleteTeam}
        />
      )}

      {/* Tabs */}
      <div className="mt-4">
        <div className="tabs tabs-boxed">
          <button
            className={`tab ${activeTab === "members" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("members")}
          >
            <Users size={18} className="mr-2" />
            Members
          </button>
          <button
            className={`tab ${activeTab === "notifications" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("notifications")}
          >
            <Bell size={18} className="mr-2" />
            Notifications
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "members" && (
        <div className="mt-4 bg-base-100 p-6 rounded-xl space-y-6 h-full">
          {/* Add User Table */}
          <div>
          <div ref={dropdownRef} className="relative mb-4">
            <input
              type="text"
              placeholder="Search users..."
              className="input input-bordered w-[250px]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  setHighlightedIndex(
                    (prev) => (prev + 1) % filteredUsers.length
                  );
                } else if (e.key === "ArrowUp") {
                  setHighlightedIndex(
                    (prev) =>
                      (prev - 1 + filteredUsers.length) % filteredUsers.length
                  );
                } else if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  const user = filteredUsers[highlightedIndex];
                  if (user) {
                    handleAdd(user);
                    setSearch("");
                  }
                }
              }}
            />
            {search && filteredUsers.length > 0 && (
              <ul className="absolute z-10 bg-base-100 border border-base-300 mt-1 w-[250px] rounded shadow max-h-60 overflow-auto">
                {filteredUsers.map((user, index) => (
                  <li
                    key={user.id}
                    className={`px-4 py-2 cursor-pointer hover:bg-base-200 ${
                      highlightedIndex === index
                        ? "bg-base-200 font-semibold"
                        : ""
                    }`}
                    onClick={() => {
                      handleAdd(user);
                      setSearch("");
                    }}
                  >
                    {user.first_name} {user.last_name} ({user.email})
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {/* Members Table */}
        <div>
          <h3 className="text-md font-semibold mb-2">Members</h3>
          <div className="overflow-x-auto">
            <table className="table  table-fixed w-full">
              <thead>
                <tr>
                  <th className="w-1/3">Name</th>
                  <th className="w-1/3">Email</th>
                  <th className="w-[48px]"></th>
                </tr>
              </thead>
              <tbody>
                {members.length > 0 ? (
                  members.map((user) => (
                    <tr key={user.id}>
                      <td className="">
                        {user.first_name} {user.last_name}
                      </td>
                      <td className="">{user.email}</td>
                      <td className="text-right">
                        <button
                          className="btn btn-circle btn-sm btn-error"
                          onClick={() => handleRemove(user.id)}
                        >
                          <Minus size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className=" text-sm text-gray-400">
                      No members yet.
                    </td>
                    <td className="w-[48px]"></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6">
          <button className="btn btn-outline" onClick={onClose}>
            <ArrowLeft size={18} />
            Back to Teams
          </button>
        </div>
      </div>
      )}

      {/* Notifications Tab */}
      {activeTab === "notifications" && (
        <div className="mt-4 bg-base-100 p-6 rounded-xl">
          <TeamNotifications teamId={team.id} />

          <div className="mt-6">
            <button className="btn btn-outline" onClick={onClose}>
              <ArrowLeft size={18} />
              Back to Teams
            </button>
          </div>
        </div>
      )}
    </>
  );
}
