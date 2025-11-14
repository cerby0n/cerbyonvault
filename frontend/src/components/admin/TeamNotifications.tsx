import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../ToastProvider";

interface TeamNotificationConfig {
  id?: number;
  team: number;
  team_name?: string;
  enabled: boolean;
  recipients: string[];
  notify_expiring: boolean;
  expiry_thresholds: number[];
  notify_expired: boolean;
}

interface TeamNotificationsProps {
  teamId: number;
}

export default function TeamNotifications({ teamId }: TeamNotificationsProps) {
  const { authTokens } = useAuth();
  const { notify } = useToast();
  const baseURL = import.meta.env.VITE_API_URL;

  const [config, setConfig] = useState<TeamNotificationConfig>({
    team: teamId,
    enabled: false,
    recipients: [],
    notify_expiring: true,
    expiry_thresholds: [],
    notify_expired: true,
  });

  const [newRecipient, setNewRecipient] = useState("");
  const [loading, setLoading] = useState(false);

  const availableThresholds = [7, 30, 60, 90];

  useEffect(() => {
    fetchTeamConfig();
  }, [teamId]);

  const fetchTeamConfig = async () => {
    try {
      const response = await axios.get(
        `${baseURL}/notifications/configs/for_team/?team_id=${teamId}`,
        {
          headers: { Authorization: `Bearer ${authTokens?.access}` },
        }
      );

      if (response.data) {
        setConfig(response.data);
      }
    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.error("Failed to fetch team notification config:", error);
      }
    }
  };

  const handleAddRecipient = () => {
    if (!newRecipient) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newRecipient)) {
      notify("Please enter a valid email address", "error");
      return;
    }

    if (config.recipients.includes(newRecipient)) {
      notify("Email already added", "error");
      return;
    }

    setConfig((prev) => ({
      ...prev,
      recipients: [...prev.recipients, newRecipient],
    }));
    setNewRecipient("");
  };

  const handleRemoveRecipient = (email: string) => {
    setConfig((prev) => ({
      ...prev,
      recipients: prev.recipients.filter((r) => r !== email),
    }));
  };

  const handleToggleThreshold = (threshold: number) => {
    setConfig((prev) => {
      const thresholds = prev.expiry_thresholds.includes(threshold)
        ? prev.expiry_thresholds.filter((t) => t !== threshold)
        : [...prev.expiry_thresholds, threshold].sort((a, b) => a - b);

      return { ...prev, expiry_thresholds: thresholds };
    });
  };

  const handleSave = async () => {
    setLoading(true);

    try {
      const method = config.id ? "put" : "post";
      const response = await axios({
        method,
        url: `${baseURL}/notifications/configs/for_team/`,
        data: { ...config, team_id: teamId },
        headers: { Authorization: `Bearer ${authTokens?.access}` },
      });

      notify("✅ Team notification settings saved", "success");
      setConfig(response.data);
    } catch (error: any) {
      notify("❌ Failed to save notification settings", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="form-control">
        <label className="label cursor-pointer justify-start gap-2">
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={config.enabled}
            onChange={(e) => setConfig((prev) => ({ ...prev, enabled: e.target.checked }))}
          />
          <span className="label-text font-semibold">Enable Notifications for this Team</span>
        </label>
        <label className="label">
          <span className="label-text-alt">
            When enabled, team members can receive notifications for certificates and secrets assigned to this team
          </span>
        </label>
      </div>

      {config.enabled && (
        <>
          <div className="divider">Notification Recipients</div>

          <div className="flex gap-2">
            <input
              type="email"
              className="input input-bordered flex-1"
              placeholder="Add email recipient"
              value={newRecipient}
              onChange={(e) => setNewRecipient(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleAddRecipient()}
            />
            <button className="btn btn-primary" onClick={handleAddRecipient}>
              Add
            </button>
          </div>

          <div className="space-y-2">
            {config.recipients.map((email) => (
              <div key={email} className="badge badge-lg gap-2">
                {email}
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() => handleRemoveRecipient(email)}
                >
                  ✕
                </button>
              </div>
            ))}
            {config.recipients.length === 0 && (
              <p className="text-sm text-base-content/60">No recipients added</p>
            )}
          </div>

          <div className="divider">Expiry Thresholds (Days)</div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {availableThresholds.map((threshold) => (
              <label key={threshold} className="label cursor-pointer justify-start gap-2">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary"
                  checked={config.expiry_thresholds.includes(threshold)}
                  onChange={() => handleToggleThreshold(threshold)}
                />
                <span className="label-text">{threshold} days</span>
              </label>
            ))}
          </div>

          <label className="label">
            <span className="label-text-alt">
              Team will be notified when resources are expiring within these thresholds
            </span>
          </label>

          <div className="divider">Notification Types</div>

          <div className="space-y-2">
            <label className="label cursor-pointer justify-start gap-2">
              <input
                type="checkbox"
                className="checkbox checkbox-primary"
                checked={config.notify_expiring}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, notify_expiring: e.target.checked }))
                }
              />
              <span className="label-text">Notify for expiring certificates/secrets</span>
            </label>

            <label className="label cursor-pointer justify-start gap-2">
              <input
                type="checkbox"
                className="checkbox checkbox-primary"
                checked={config.notify_expired}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, notify_expired: e.target.checked }))
                }
              />
              <span className="label-text">Notify for expired certificates/secrets</span>
            </label>
          </div>
        </>
      )}

      <div className="flex justify-end">
        <button
          className={`btn btn-primary ${loading ? "loading" : ""}`}
          onClick={handleSave}
          disabled={loading}
        >
          Save Notification Settings
        </button>
      </div>
    </div>
  );
}
