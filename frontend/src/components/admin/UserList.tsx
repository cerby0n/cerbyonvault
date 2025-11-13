import { useEffect, useState } from "react";
import { useAdminApi } from "../../hooks/useAdminApi";
import { Avatar } from "../items/Avatar";
import useAxios from "../../axios/useAxios";
import { useToast } from "../ToastProvider";
import ConfirmModal from "../modals/ConfirmModal";

export default function UserList() {
  const { users, fetchUsers, updateUser } = useAdminApi();
  const axiosInstance = useAxios();
  const { notify } = useToast();
  const [editMode, setEditMode] = useState(false);
  const [editedUsers, setEditedUsers] = useState<Record<number, boolean>>({});
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [inviteEmail, setInviteEmail] = useState<string>("");
  const [inviteLink, setInviteLink] = useState<string>("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [adminFilter, setAdminFilter] = useState<"all" | "admin" | "non-admin">(
    "all"
  );

  useEffect(() => {
    fetchUsers();
  }, []);

  const toggleSelection = (id: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((uid) => uid !== id) : [...prev, id]
    );
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      `${user.first_name} ${user.last_name}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesAdmin =
      adminFilter === "all" ||
      (adminFilter === "admin" && user.is_admin) ||
      (adminFilter === "non-admin" && !user.is_admin);

    return matchesSearch && matchesAdmin;
  });

  const handleConfirmDelete = async () => {
    try {
      await Promise.all(
        selectedUserIds.map((id) =>
          axiosInstance.delete(`/admin/users/${id}/delete/`)
        )
      );
      notify(`✅ Deleted ${selectedUserIds.length} users`, "success");
      setSelectedUserIds([]);
      setShowDeleteConfirm(false); 
      fetchUsers();
    } catch {
      notify("❌ Failed to delete selected users", "error");
      setShowDeleteConfirm(false); 
    }
  };

  const sendInvite = async (email: string) => {
    try {
      const res = await axiosInstance.post("/admin/invite/", { email: email });
      const link = typeof res.data?.link === "string" ? res.data.link : "";
      setInviteLink(link);
      setInviteEmail("");
    } catch {
      notify("❌ Failed to generate invite", "error");
      setInviteLink("");
    }
  };

  const toggleEditMode = async () => {
    if (editMode) {
      const changes = Object.entries(editedUsers);

      try {
        await Promise.all(
          changes.map(([id, is_admin]) => updateUser(Number(id), { is_admin }))
        );
        setEditedUsers({});
      } catch {
        notify("❌ Failed to update users", "error");
      }
    }

    setEditMode((prev) => !prev);
  };

  const copyAndClose = async () => {
    await navigator.clipboard.writeText(inviteLink);
    notify("✅ Invite link copied", "success");
  };

  const cancelInvite = () => {
    setShowInviteModal(false);
    setInviteEmail("");
    setInviteLink("");
  };

  return (
    <div className="card p-4 w-full h-full">
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <div className=" flex justify-start">
          <input
            type="text"
            placeholder="Search users..."
            className="input input-bordered"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="select select-bordered ml-4"
            value={adminFilter}
            onChange={(e) =>
              setAdminFilter(e.target.value as "all" | "admin" | "non-admin")
            }
          >
            <option value="all">All Users</option>
            <option value="admin">Admins</option>
            <option value="non-admin">Non-admins</option>
          </select>
        </div>
        <div className="flex gap-2">
          {selectedUserIds.length > 0 && (
            <div className="" onClick={() => setShowDeleteConfirm(true)}>
              <button className="btn btn-error">
                🗑️ {selectedUserIds.length} Selected
              </button>
            </div>
          )}
          <button className="btn btn-primary" onClick={toggleEditMode}>
            {editMode ? "💾" : "✏️"}
          </button>
        </div>
      </div>
      <div className="w-full overflow-x-auto max-h-[calc(100vh-150px)] overflow-y-auto">
        <table className="table w-full ">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Admin</th>
              <th>
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={
                    selectedUserIds.length === filteredUsers.length &&
                    filteredUsers.length > 0
                  }
                  onChange={() => {
                    setSelectedUserIds(
                      selectedUserIds.length === filteredUsers.length
                        ? []
                        : filteredUsers.map((u) => u.id)
                    );
                  }}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => {
              return (
                <tr key={user.id}>
                  <td>
                    <div className="flex items-center gap-4">
                      <Avatar
                        firstname={user.first_name}
                        lastname={user.last_name}
                        size={44}
                        textSize={18}
                        profileImage={user.profile_image}
                      />
                      <div className="text-md">
                        {user.first_name + " " + user.last_name}
                      </div>
                    </div>
                  </td>
                  <td>{user.email}</td>
                  <td>
                    {editMode ? (
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={editedUsers[user.id] ?? user.is_admin}
                        onChange={(e) =>
                          setEditedUsers((prev) => ({
                            ...prev,
                            [user.id]: e.target.checked,
                          }))
                        }
                      />
                    ) : (
                      <input
                        type="checkbox"
                        className="checkbox cursor-default"
                        checked={user.is_admin}
                        readOnly
                      />
                    )}
                  </td>

                  <td>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={selectedUserIds.includes(user.id)}
                      onChange={() => toggleSelection(user.id)}
                    />
                  </td>
                </tr>
              );
            })}
            <tr>
              <td>
                <div className="flex items-center gap-4">
                  <button
                    className="btn  rounded-full w-[44px] h-[44px] flex items-center justify-center text-4xl font-light"
                    onClick={() => setShowInviteModal(true)}
                  >
                    +
                  </button>
                  <div className="font-semibold">Invite new members</div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        {showInviteModal && (
          <dialog open className="modal backdrop-blur-xs">
            <div className="modal-box">
              <h3 className="font-bold text-lg">Invite New User</h3>
              <input
                type="email"
                placeholder="Enter email"
                className="input input-bordered w-full my-4"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <div className="modal-action">
                <button className="btn" onClick={cancelInvite}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => sendInvite(inviteEmail)}
                >
                  Generate Link
                </button>
              </div>
              {inviteLink && (
                <div className="mt-2">
                  <p className="text-sm">Invite link:</p>
                  <div className="flex items-center space-x-2">
                    <input
                      className="input input-bordered cursor-copy w-full truncate"
                      value={inviteLink}
                      disabled
                      readOnly
                    />
                    <button className="btn btn-accent" onClick={copyAndClose}>
                      📋
                    </button>
                  </div>
                </div>
              )}
            </div>
          </dialog>
        )}
        {showDeleteConfirm && (
                <ConfirmModal
                  message={
                    <>
                      Are you sure you want to delete <strong>{selectedUserIds.length}</strong> selected user(s)?
                      <br />
                      This action cannot be undone.
                    </>
                  }
                  onCancel={() => setShowDeleteConfirm(false)}
                  onConfirm={handleConfirmDelete}
                />
              )}
      </div>
    </div>
  );
}
