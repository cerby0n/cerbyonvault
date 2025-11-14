import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useToast } from "./ToastProvider";
import { Bell, ChevronDown, ChevronRight } from "lucide-react";

interface CertificateNotificationConfig {
  id?: number;
  certificate: number;
  override_enabled: boolean;
  recipients: string[];
  notify_expiring: boolean;
  expiry_thresholds: number[];
  notify_expired: boolean;
}

interface CertificateNotificationsProps {
  certificateId: number;
}

export default function CertificateNotifications({ certificateId }: CertificateNotificationsProps) {
  const { authTokens } = useAuth();
  const { notify } = useToast();
  const baseURL = import.meta.env.VITE_API_URL;

  const [config, setConfig] = useState<CertificateNotificationConfig>({
    certificate: certificateId,
    override_enabled: false,
    recipients: [],
    notify_expiring: true,
    expiry_thresholds: [],
    notify_expired: true,
  });

  const [newRecipient, setNewRecipient] = useState("");
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const availableThresholds = [7, 30, 60, 90];

  useEffect(() => {
    fetchCertificateConfig();
  }, [certificateId]);

  const fetchCertificateConfig = async () => {
    try {
      const response = await axios.get(
        `${baseURL}/notifications/certificate-configs/for_certificate/?certificate_id=${certificateId}`,
        {
          headers: { Authorization: `Bearer ${authTokens?.access}` },
        }
      );

      if (response.data) {
        setConfig(response.data);
        if (response.data.override_enabled) {
          setIsExpanded(true);
        }
      }
    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.error("Failed to fetch certificate notification config:", error);
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
        url: `${baseURL}/notifications/certificate-configs/for_certificate/`,
        data: { ...config, certificate_id: certificateId },
        headers: { Authorization: `Bearer ${authTokens?.access}` },
      });

      notify("✅ Certificate notification settings saved", "success");
      setConfig(response.data);
    } catch (error: any) {
      notify("❌ Failed to save notification settings", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-base-200/30 rounded-lg p-4">
      <div
        className="flex items-center justify-between cursor-pointer mb-3 pb-2 border-b border-base-300"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Bell size={18} className="text-primary" />
          <h3 className="text-sm font-bold text-base-content uppercase tracking-wide">
            Custom Notifications
          </h3>
        </div>
        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
      </div>

      {isExpanded && (
        <div className="space-y-3">
          <div className="form-control">
            <label className="label cursor-pointer justify-start gap-2 py-1">
              <input
                type="checkbox"
                className="toggle toggle-primary toggle-sm"
                checked={config.override_enabled}
                onChange={(e) => setConfig((prev) => ({ ...prev, override_enabled: e.target.checked }))}
              />
              <span className="label-text text-xs font-semibold">Override team/global settings</span>
            </label>
            <label className="label py-0">
              <span className="label-text-alt text-xs">
                Enable custom notifications for this certificate only
              </span>
            </label>
          </div>

          {config.override_enabled && (
            <>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-base-content/70">Recipients</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    className="input input-bordered input-sm flex-1 text-xs"
                    placeholder="Add email"
                    value={newRecipient}
                    onChange={(e) => setNewRecipient(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleAddRecipient()}
                  />
                  <button className="btn btn-primary btn-sm text-xs" onClick={handleAddRecipient}>
                    Add
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {config.recipients.map((email) => (
                    <div key={email} className="badge badge-sm gap-1">
                      <span className="text-xs">{email}</span>
                      <button
                        className="btn btn-ghost btn-xs p-0 h-auto min-h-0"
                        onClick={() => handleRemoveRecipient(email)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {config.recipients.length === 0 && (
                    <p className="text-xs text-base-content/60">No recipients added</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-base-content/70">Expiry Thresholds</label>
                <div className="grid grid-cols-2 gap-2">
                  {availableThresholds.map((threshold) => (
                    <label key={threshold} className="label cursor-pointer justify-start gap-2 py-1">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-primary checkbox-xs"
                        checked={config.expiry_thresholds.includes(threshold)}
                        onChange={() => handleToggleThreshold(threshold)}
                      />
                      <span className="label-text text-xs">{threshold} days</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="label cursor-pointer justify-start gap-2 py-1">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary checkbox-xs"
                    checked={config.notify_expiring}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, notify_expiring: e.target.checked }))
                    }
                  />
                  <span className="label-text text-xs">Notify when expiring</span>
                </label>

                <label className="label cursor-pointer justify-start gap-2 py-1">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary checkbox-xs"
                    checked={config.notify_expired}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, notify_expired: e.target.checked }))
                    }
                  />
                  <span className="label-text text-xs">Notify when expired</span>
                </label>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  className={`btn btn-primary btn-sm ${loading ? "loading" : ""}`}
                  onClick={handleSave}
                  disabled={loading}
                >
                  Save Notifications
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
