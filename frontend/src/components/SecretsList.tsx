import { useState, useEffect } from "react";
import useAxios from "../axios/useAxios";
import { Secret, Team } from "../types";
import { useToast } from "./ToastProvider";
import SidePanelSecret from "./SidePanelSecret";
import { Key, Plus, Search, Trash2 } from "lucide-react";
import ConfirmModal from "./modals/ConfirmModal";
import TeamsSelect from "../utils/TeamsSearch";

export default function SecretsList() {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [filteredSecrets, setFilteredSecrets] = useState<Secret[]>([]);
  const [selectedSecret, setSelectedSecret] = useState<Secret | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "valid" | "expired">("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const axiosInstance = useAxios();
  const { notify } = useToast();

  const fetchSecrets = async () => {
    try {
      const response = await axiosInstance.get("/secrets/");
      setSecrets(response.data);
    } catch (error) {
      notify("Failed to fetch secrets", "error");
    }
  };

  useEffect(() => {
    fetchSecrets();
  }, []);

  useEffect(() => {
    let filtered = secrets;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (secret) =>
          secret.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          secret.application.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply expiry filter
    if (filter === "valid") {
      filtered = filtered.filter((secret) => !secret.is_expired);
    } else if (filter === "expired") {
      filtered = filtered.filter((secret) => secret.is_expired);
    }

    setFilteredSecrets(filtered);
  }, [secrets, searchTerm, filter]);

  const handleSelectSecret = (secret: Secret) => {
    setSelectedSecret(secret);
  };

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredSecrets.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredSecrets.map((s) => s.id));
    }
  };

  const handleDeleteSelected = async () => {
    try {
      await Promise.all(
        selectedIds.map((id) => axiosInstance.delete(`/secrets/${id}/`))
      );
      notify(`Deleted ${selectedIds.length} secret(s)`, "success");
      setSelectedIds([]);
      setShowDeleteConfirm(false);
      if (selectedSecret && selectedIds.includes(selectedSecret.id)) {
        setSelectedSecret(null);
      }
      fetchSecrets();
    } catch (error) {
      notify("Failed to delete secrets", "error");
      setShowDeleteConfirm(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No expiry";
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="w-full flex h-full">
      <div className="flex flex-col w-full space-y-2">
        {/* Header */}
        <div className="p-6 bg-base-100 rounded flex items-center justify-between">
          <h1 className="text-4xl font-bold text-secondary-content flex items-center gap-3">
            <Key size={36} />
            Secrets
          </h1>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={20} />
            Add Secret
          </button>
        </div>

        {/* Main Content */}
        <div className="flex h-full bg-base-100 rounded">
          {/* Secrets List */}
          <div className="ml-4 mt-4 space-y-2 flex-1 min-w-0">
            {/* Search and Filters */}
            <div className="flex gap-4 mb-4 items-center">
              <div className="relative flex-1 max-w-md">
                <Search
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-base-content/50"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="Search secrets..."
                  className="input input-bordered w-full pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                {["all", "valid", "expired"].map((f) => (
                  <button
                    key={f}
                    className={`btn btn-sm ${
                      filter === f ? "btn-primary" : "btn-outline"
                    }`}
                    onClick={() => setFilter(f as typeof filter)}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>

              {selectedIds.length > 0 && (
                <button
                  className="btn btn-error btn-sm"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 size={16} />
                  {selectedIds.length} Selected
                </button>
              )}
            </div>

            {/* Secrets Table */}
            <div className="overflow-y-auto pr-4" style={{ maxHeight: "calc(100vh - 280px)" }}>
              <table className="table w-full">
                <thead>
                  <tr>
                    <th className="w-8">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={
                          filteredSecrets.length > 0 &&
                          selectedIds.length === filteredSecrets.length
                        }
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th>Name</th>
                    <th>Application</th>
                    <th>Expiry Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSecrets.map((secret) => (
                    <tr
                      key={secret.id}
                      className={`cursor-pointer hover:bg-base-200 ${
                        selectedSecret?.id === secret.id ? "bg-base-200" : ""
                      }`}
                      onClick={() => handleSelectSecret(secret)}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          checked={selectedIds.includes(secret.id)}
                          onChange={() => handleToggleSelect(secret.id)}
                        />
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Key size={18} className="text-primary" />
                          <span className="font-medium">{secret.name}</span>
                        </div>
                      </td>
                      <td>{secret.application}</td>
                      <td>{formatDate(secret.expiry_date)}</td>
                      <td>
                        {secret.is_expired ? (
                          <span className="badge badge-error">Expired</span>
                        ) : secret.expiry_date ? (
                          <span className="badge badge-success">Valid</span>
                        ) : (
                          <span className="badge badge-ghost">No Expiry</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredSecrets.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-base-content/50 py-8">
                        No secrets found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Side Panel */}
          {selectedSecret && (
            <>
              <div className="w-1 my-5 bg-neutral opacity-25" />
              <div className="flex h-full" style={{ width: "32rem" }}>
                <div className="rounded-xl shadow-xl bg-base-100 border-2 border-base-100 flex-grow overflow-hidden">
                  <SidePanelSecret
                    secret={selectedSecret}
                    onClose={() => setSelectedSecret(null)}
                    onUpdated={fetchSecrets}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <ConfirmModal
            message={
              <>
                Are you sure you want to delete{" "}
                <strong>{selectedIds.length}</strong> selected secret(s)?
                <br />
                This action cannot be undone.
              </>
            }
            onCancel={() => setShowDeleteConfirm(false)}
            onConfirm={handleDeleteSelected}
          />
        )}

        {/* Create Secret Modal */}
        {showCreateModal && (
          <CreateSecretModal
            onClose={() => setShowCreateModal(false)}
            onCreated={() => {
              setShowCreateModal(false);
              fetchSecrets();
            }}
          />
        )}
      </div>
    </div>
  );
}

// Simple create secret modal component
function CreateSecretModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [formData, setFormData] = useState({
    name: "",
    secret_value: "",
    application: "",
    expiry_date: "",
    comment: "",
  });
  const [accessTeams, setAccessTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const axiosInstance = useAxios();
  const { notify } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        expiry_date: formData.expiry_date || null,
        access_teams: accessTeams.map((t) => t.id),
      };
      await axiosInstance.post("/secrets/", payload);
      notify("Secret created successfully", "success");
      onCreated();
    } catch (error) {
      notify("Failed to create secret", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <dialog open className="modal backdrop-blur-sm">
      <div className="modal-box max-w-2xl p-0">
        {/* Header */}
        <div className="bg-base-200/50 p-6 border-b border-base-300">
          <h3 className="font-bold text-2xl text-base-content">Create New Secret</h3>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-5">
            {/* Name */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-base-content/70">
                Name <span className="text-error">*</span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., AWS Access Key"
                required
              />
            </div>

            {/* Secret Value */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-base-content/70">
                Secret Value <span className="text-error">*</span>
              </label>
              <textarea
                className="textarea textarea-bordered w-full font-mono text-sm"
                value={formData.secret_value}
                onChange={(e) =>
                  setFormData({ ...formData, secret_value: e.target.value })
                }
                placeholder="Enter the secret value (will be encrypted)"
                required
                rows={4}
              />
            </div>

            {/* Application */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-base-content/70">
                Application <span className="text-error">*</span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full"
                value={formData.application}
                onChange={(e) =>
                  setFormData({ ...formData, application: e.target.value })
                }
                placeholder="e.g., Production API Server"
                required
              />
            </div>

            {/* Expiry Date */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-base-content/70">
                Expiry Date <span className="text-base-content/40">(Optional)</span>
              </label>
              <input
                type="date"
                className="input input-bordered w-full"
                value={formData.expiry_date}
                onChange={(e) =>
                  setFormData({ ...formData, expiry_date: e.target.value })
                }
              />
            </div>

            {/* Teams */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-base-content/70">
                Assigned Teams <span className="text-base-content/40">(Optional)</span>
              </label>
              <TeamsSelect value={accessTeams} onChange={setAccessTeams} />
            </div>

            {/* Comment */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-base-content/70">
                Comment <span className="text-base-content/40">(Optional)</span>
              </label>
              <textarea
                className="textarea textarea-bordered w-full"
                value={formData.comment}
                onChange={(e) =>
                  setFormData({ ...formData, comment: e.target.value })
                }
                placeholder="Add any notes about this secret..."
                rows={3}
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-base-300">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Creating...
                </>
              ) : (
                "Create Secret"
              )}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
