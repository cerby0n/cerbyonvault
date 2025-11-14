import { useState, useEffect } from "react";
import { Secret, Team } from "../types";
import useAxios from "../axios/useAxios";
import { useToast } from "./ToastProvider";
import TeamsSelect from "../utils/TeamsSearch";
import SecretNotifications from "./SecretNotifications";
import {
  X,
  Key,
  Info,
  Eye,
  EyeOff,
  Copy,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

interface SidePanelSecretProps {
  secret: Secret;
  onClose: () => void;
  onUpdated: () => void;
}

export default function SidePanelSecret({
  secret,
  onClose,
  onUpdated,
}: SidePanelSecretProps) {
  const [name, setName] = useState(secret.name);
  const [application, setApplication] = useState(secret.application);
  const [expiryDate, setExpiryDate] = useState(secret.expiry_date || "");
  const [comment, setComment] = useState(secret.comment || "");
  const [accessTeams, setAccessTeams] = useState<Team[]>(secret.access_teams);
  const [secretValue, setSecretValue] = useState<string>("");
  const [isRevealed, setIsRevealed] = useState(false);
  const [loading, setLoading] = useState(false);

  const axiosInstance = useAxios();
  const { notify } = useToast();

  useEffect(() => {
    setName(secret.name);
    setApplication(secret.application);
    setExpiryDate(secret.expiry_date || "");
    setComment(secret.comment || "");
    setAccessTeams(secret.access_teams);
    setIsRevealed(false);
    setSecretValue("");
  }, [secret]);

  const handleRevealSecret = async () => {
    if (isRevealed) {
      setIsRevealed(false);
      setSecretValue("");
      return;
    }

    setLoading(true);
    try {
      const response = await axiosInstance.get(`/secrets/${secret.id}/reveal/`);
      setSecretValue(response.data.secret_value || "");
      setIsRevealed(true);
    } catch (error) {
      notify("Failed to reveal secret", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCopySecret = async () => {
    if (!secretValue) {
      notify("Reveal the secret first", "error");
      return;
    }

    try {
      await navigator.clipboard.writeText(secretValue);
      notify("Secret copied to clipboard", "success");
    } catch (error) {
      notify("Failed to copy secret", "error");
    }
  };

  const handleUpdate = async () => {
    try {
      const payload = {
        name,
        application,
        expiry_date: expiryDate || null,
        comment,
        access_teams: accessTeams.map((t) => t.id),
      };

      await axiosInstance.patch(`/secrets/${secret.id}/`, payload);
      notify("Secret updated successfully", "success");
      onUpdated();
      onClose();
    } catch (error) {
      notify("Failed to update secret", "error");
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "No expiry";
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] select-none">
      {/* Header */}
      <div className="flex justify-between items-center p-4 pb-2 flex-shrink-0">
        <h2 className="text-xl font-bold text-base-content">Secret Details</h2>
        <button onClick={onClose} className="all-[unset]">
          <X
            size={24}
            strokeWidth={2.5}
            className="text-base-content/60 cursor-pointer transition-all hover:text-error hover:rotate-90"
          />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
        {/* Name */}
        <div className="bg-base-200/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Key size={18} className="text-primary" />
            <label className="text-xs font-semibold text-base-content/70">
              Name
            </label>
          </div>
          <input
            type="text"
            className="input input-bordered w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* Secret Value - Reveal/Hide */}
        <div className="bg-base-200/50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} className="text-warning" />
              <label className="text-xs font-semibold text-base-content/70">
                Secret Value
              </label>
            </div>
            <div className="flex gap-2">
              {isRevealed && (
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={handleCopySecret}
                  title="Copy to clipboard"
                >
                  <Copy size={16} />
                </button>
              )}
              <button
                className={`btn btn-sm ${isRevealed ? "btn-warning" : "btn-primary"}`}
                onClick={handleRevealSecret}
                disabled={loading}
              >
                {loading ? (
                  "Loading..."
                ) : isRevealed ? (
                  <>
                    <EyeOff size={16} />
                    Hide
                  </>
                ) : (
                  <>
                    <Eye size={16} />
                    Reveal
                  </>
                )}
              </button>
            </div>
          </div>
          {isRevealed ? (
            <textarea
              className="textarea textarea-bordered w-full font-mono text-sm"
              value={secretValue}
              readOnly
              rows={4}
            />
          ) : (
            <div className="text-center py-6 text-base-content/50">
              Click "Reveal" to view the secret value
            </div>
          )}
        </div>

        {/* Secret Information Section */}
        <div className="bg-base-200/50 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-base-300">
            <Info size={18} className="text-info" />
            <h3 className="font-semibold text-sm">Secret Information</h3>
          </div>

          {/* Application */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-base-content/70">
              Application
            </label>
            <input
              type="text"
              className="input input-bordered w-full input-sm"
              value={application}
              onChange={(e) => setApplication(e.target.value)}
            />
          </div>

          {/* Expiry Date */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-base-content/70">
              Expiry Date
            </label>
            <input
              type="date"
              className="input input-bordered w-full input-sm"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
            {secret.expiry_date && (
              <div className="text-xs mt-1">
                <span
                  className={`${
                    secret.is_expired ? "text-error" : "text-success"
                  } font-medium`}
                >
                  {secret.is_expired ? "Expired" : "Valid"}: {formatDate(secret.expiry_date)}
                </span>
              </div>
            )}
          </div>

          {/* Created By */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-base-content/70">
              Created By
            </label>
            <div className="text-sm text-base-content/80">
              {secret.created_by_email}
            </div>
          </div>

          {/* Created At */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-base-content/70">
              Created At
            </label>
            <div className="text-sm text-base-content/80">
              {new Date(secret.created_at).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Additional Information Section */}
        <div className="bg-base-200/50 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-base-300">
            <Info size={18} className="text-info" />
            <h3 className="font-semibold text-sm">Additional Information</h3>
          </div>

          {/* Comment */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-base-content/70">
              Comment
            </label>
            <textarea
              className="textarea textarea-bordered w-full"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Add notes about this secret..."
            />
          </div>

          {/* Teams */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-base-content/70">
              Assigned Teams
            </label>
            <TeamsSelect value={accessTeams} onChange={setAccessTeams} />
          </div>
        </div>

        {/* NOTIFICATIONS SECTION */}
        <SecretNotifications secretId={secret.id} />
      </div>

      {/* Update Button - Fixed at bottom */}
      <div className="flex-shrink-0 bg-base-100 p-4 pt-3 border-t border-base-300">
        <button className="btn btn-primary w-full" onClick={handleUpdate}>
          <ShieldCheck size={18} />
          Update Secret
        </button>
      </div>
    </div>
  );
}
