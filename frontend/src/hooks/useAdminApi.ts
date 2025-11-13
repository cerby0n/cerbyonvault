import { useState } from "react";
import useAxios from "../axios/useAxios"; // your axios wrapper
import { useToast } from "../components/ToastProvider";

interface User {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  is_admin: boolean;
  profile_image?: string | null;
}

interface Team {
  id: number;
  name: string;
}

interface UserFormPayload {
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  is_admin: boolean;
}

export function useAdminApi() {
  const axiosInstance = useAxios();
  const { notify } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  {
    /*=== Users ===*/
  }

  const fetchUsers = async () => {
    try {
      const res = await axiosInstance.get<User[]>("/users/");
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch {
      notify("❌ Failed to fetch users", "error");
    }
  };

  const createUser = async (data: UserFormPayload) => {
    try {
      await axiosInstance.post("/admin/users/", data);
      notify("✅ User created!", "success");
      fetchUsers();
    } catch {
      notify("❌ Failed to create user", "error");
    }
  };

  const deleteUser = async (id: number) => {
    try {
      await axiosInstance.delete(`/admin/users/${id}/delete/`);
      notify("✅ User deleted", "success");
      fetchUsers();
    } catch {
      notify("❌ Could not delete user", "error");
    }
  };

  const sendResetLink = async (id: number) => {
    try {
      const res = await axiosInstance.post(
        `/admin/users/${id}/send_reset_link/`
      );
      if (res.data.status === "manual") {
        notify("ℹ️ Copy this reset link manually.", "info");
        alert(`Reset Link: ${res.data.link}`);
      } else {
        notify("✅ Reset link sent!", "success");
      }
    } catch {
      notify("❌ Failed to send reset link", "error");
    }
  };

  {
    /*=== Users ===*/
  }

  const fetchTeams = async () => {
    try {
      const res = await axiosInstance.get<Team[]>("/teams/");
      setTeams(Array.isArray(res.data) ? res.data : []);
    } catch {
      notify("❌ Failed to fetch teams", "error");
    }
  };

  const createTeam = async (name: string) => {
    try {
      await axiosInstance.post("/admin/teams/", { name });
      notify("✅ Team created!", "success");
      fetchTeams();
    } catch {
      notify("❌ Could not create team", "error");
    }
  };

  const deleteTeam = async (id: number) => {
    try {
      await axiosInstance.delete(`/admin/teams/${id}/delete/`);
      notify("✅ Team deleted", "success");
      fetchTeams();
    } catch {
      notify("❌ Could not delete team", "error");
    }
  };

  const addUserToTeam = async (teamId: number, userId: number) => {
    try {
      await axiosInstance.post(`/admin/teams/${teamId}/add_user/`, {
        user_id: userId,
      });
      notify("✅ User added to team", "success");
      fetchTeams();
    } catch {
      notify("❌ Could not add user to team", "error");
    }
  };

  const updateUser = async (id: number, data: any) => {
    try {
      await axiosInstance.patch(`/admin/users/${id}/update/`, data);
      notify("✅ User updated", "success");
      fetchUsers();
    } catch {
      notify("❌ Failed to update user", "error");
    }
  };

  return {
    users,
    fetchUsers,
    createUser,
    deleteUser,
    sendResetLink,
    updateUser,

    teams,
    fetchTeams,
    createTeam,
    deleteTeam,
    addUserToTeam,
  };
}
