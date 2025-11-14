import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { Mail, Bell, Send, Check, AlertCircle } from "lucide-react";

interface EmailConfig {
  id?: number;
  method: "smtp" | "graph";
  smtp_host?: string;
  smtp_port?: number;
  smtp_username?: string;
  smtp_password?: string;
  smtp_use_tls?: boolean;
  smtp_from_email?: string;
  graph_tenant_id?: string;
  graph_client_id?: string;
  graph_client_secret?: string;
  graph_from_email?: string;
  daily_check_time?: string;
  smtp_password_set?: boolean;
  graph_client_secret_set?: boolean;
}

interface NotificationConfig {
  id?: number;
  is_global: boolean;
  enabled: boolean;
  recipients: string[];
  notify_expiring: boolean;
  expiry_thresholds: number[];
  notify_expired: boolean;
}

export default function NotificationSettings() {
  const { authTokens } = useAuth();
  const baseURL = import.meta.env.VITE_API_URL;

  const [emailConfig, setEmailConfig] = useState<EmailConfig>({
    method: "smtp",
    smtp_port: 587,
    smtp_use_tls: true,
    daily_check_time: "09:00",
  });

  const [globalConfig, setGlobalConfig] = useState<NotificationConfig>({
    is_global: true,
    enabled: false,
    recipients: [],
    notify_expiring: true,
    expiry_thresholds: [],
    notify_expired: true,
  });

  const [newRecipient, setNewRecipient] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingDailyCheck, setTestingDailyCheck] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const availableThresholds = [7, 30, 60, 90];

  useEffect(() => {
    fetchEmailConfig();
    fetchGlobalConfig();
  }, []);

  const fetchEmailConfig = async () => {
    try {
      const response = await axios.get(`${baseURL}/notifications/email-config/`, {
        headers: { Authorization: `Bearer ${authTokens?.access}` },
      });

      if (response.data && response.data.id) {
        setEmailConfig(response.data);
      }
    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.error("Failed to fetch email config:", error);
      }
    }
  };

  const fetchGlobalConfig = async () => {
    try {
      const response = await axios.get(`${baseURL}/notifications/configs/global_config/`, {
        headers: { Authorization: `Bearer ${authTokens?.access}` },
      });

      if (response.data) {
        setGlobalConfig(response.data);
      }
    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.error("Failed to fetch global notification config:", error);
      }
    }
  };

  const handleEmailConfigChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setEmailConfig((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : type === "number" ? parseInt(value) : value,
    }));
  };

  const handleSaveEmailConfig = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const method = emailConfig.id ? "put" : "post";
      const url = emailConfig.id
        ? `${baseURL}/notifications/email-config/${emailConfig.id}/`
        : `${baseURL}/notifications/email-config/`;

      await axios({
        method,
        url,
        data: emailConfig,
        headers: { Authorization: `Bearer ${authTokens?.access}` },
      });

      setMessage({ type: "success", text: "Email configuration saved successfully" });
      fetchEmailConfig();
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error.response?.data?.error || "Failed to save email configuration",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail) {
      setMessage({ type: "error", text: "Please enter a test email address" });
      return;
    }

    setTesting(true);
    setMessage(null);

    try {
      await axios.post(
        `${baseURL}/notifications/email-config/test_connection/`,
        { test_email: testEmail },
        { headers: { Authorization: `Bearer ${authTokens?.access}` } }
      );

      setMessage({ type: "success", text: `Test email sent successfully to ${testEmail}` });
      setTestEmail("");
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error.response?.data?.error || "Failed to send test email",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleTestDailyCheck = async () => {
    setTestingDailyCheck(true);
    setMessage(null);

    try {
      const response = await axios.post(
        `${baseURL}/notifications/email-config/test_daily_check/`,
        {},
        { headers: { Authorization: `Bearer ${authTokens?.access}` } }
      );

      const results = response.data.results;
      const message = `Daily check completed: ${results.certificates_checked} certificates and ${results.secrets_checked} secrets checked. ${results.notifications_sent} notifications sent${results.notifications_failed > 0 ? `, ${results.notifications_failed} failed` : ''}.`;

      setMessage({ type: "success", text: message });
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error.response?.data?.error || "Failed to run daily check",
      });
    } finally {
      setTestingDailyCheck(false);
    }
  };

  const handleAddRecipient = () => {
    if (!newRecipient) return;

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newRecipient)) {
      setMessage({ type: "error", text: "Please enter a valid email address" });
      return;
    }

    if (globalConfig.recipients.includes(newRecipient)) {
      setMessage({ type: "error", text: "Email already added" });
      return;
    }

    setGlobalConfig((prev) => ({
      ...prev,
      recipients: [...prev.recipients, newRecipient],
    }));
    setNewRecipient("");
    setMessage(null);
  };

  const handleRemoveRecipient = (email: string) => {
    setGlobalConfig((prev) => ({
      ...prev,
      recipients: prev.recipients.filter((r) => r !== email),
    }));
  };

  const handleToggleThreshold = (threshold: number) => {
    setGlobalConfig((prev) => {
      const thresholds = prev.expiry_thresholds.includes(threshold)
        ? prev.expiry_thresholds.filter((t) => t !== threshold)
        : [...prev.expiry_thresholds, threshold].sort((a, b) => a - b);

      return { ...prev, expiry_thresholds: thresholds };
    });
  };

  const handleSaveGlobalConfig = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const method = globalConfig.id ? "put" : "post";
      const url = globalConfig.id
        ? `${baseURL}/notifications/configs/${globalConfig.id}/`
        : `${baseURL}/notifications/configs/`;

      await axios({
        method,
        url,
        data: globalConfig,
        headers: { Authorization: `Bearer ${authTokens?.access}` },
      });

      setMessage({ type: "success", text: "Notification settings saved successfully" });
      fetchGlobalConfig();
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error.response?.data?.error || "Failed to save notification settings",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Messages */}
      {message && (
        <div
          className={`alert ${message.type === "success" ? "alert-success" : "alert-error"}`}
        >
          {message.type === "success" ? <Check size={20} /> : <AlertCircle size={20} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Email Configuration */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-2xl mb-4">
            <Mail size={24} />
            Email Configuration
          </h2>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Email Delivery Method</span>
            </label>
            <select
              name="method"
              className="select select-bordered"
              value={emailConfig.method}
              onChange={handleEmailConfigChange}
            >
              <option value="smtp">SMTP</option>
              <option value="graph">Microsoft Graph API</option>
            </select>
          </div>

          {emailConfig.method === "smtp" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">SMTP Host</span>
                  </label>
                  <input
                    type="text"
                    name="smtp_host"
                    className="input input-bordered w-full"
                    value={emailConfig.smtp_host || ""}
                    onChange={handleEmailConfigChange}
                    placeholder="smtp.example.com"
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">SMTP Port</span>
                  </label>
                  <input
                    type="number"
                    name="smtp_port"
                    className="input input-bordered w-full"
                    value={emailConfig.smtp_port || 587}
                    onChange={handleEmailConfigChange}
                  />
                </div>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">From Email Address</span>
                </label>
                <input
                  type="email"
                  name="smtp_from_email"
                  className="input input-bordered w-full"
                  value={emailConfig.smtp_from_email || ""}
                  onChange={handleEmailConfigChange}
                  placeholder="noreply@example.com"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Username (optional)</span>
                  </label>
                  <input
                    type="text"
                    name="smtp_username"
                    className="input input-bordered w-full"
                    value={emailConfig.smtp_username || ""}
                    onChange={handleEmailConfigChange}
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Password (optional)</span>
                    {emailConfig.smtp_password_set && (
                      <span className="label-text-alt text-success">✓ Set</span>
                    )}
                  </label>
                  <input
                    type="password"
                    name="smtp_password"
                    className="input input-bordered w-full"
                    value={emailConfig.smtp_password || ""}
                    onChange={handleEmailConfigChange}
                    placeholder={emailConfig.smtp_password_set ? "••••••••" : ""}
                  />
                </div>
              </div>

              <div className="form-control">
                <label className="label cursor-pointer justify-start gap-2">
                  <input
                    type="checkbox"
                    name="smtp_use_tls"
                    className="checkbox"
                    checked={emailConfig.smtp_use_tls || false}
                    onChange={handleEmailConfigChange}
                  />
                  <span className="label-text">Use TLS</span>
                </label>
              </div>
            </div>
          )}

          {emailConfig.method === "graph" && (
            <div className="space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Tenant ID</span>
                </label>
                <input
                  type="text"
                  name="graph_tenant_id"
                  className="input input-bordered w-full"
                  value={emailConfig.graph_tenant_id || ""}
                  onChange={handleEmailConfigChange}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Client ID</span>
                </label>
                <input
                  type="text"
                  name="graph_client_id"
                  className="input input-bordered w-full"
                  value={emailConfig.graph_client_id || ""}
                  onChange={handleEmailConfigChange}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Client Secret</span>
                  {emailConfig.graph_client_secret_set && (
                    <span className="label-text-alt text-success">✓ Set</span>
                  )}
                </label>
                <input
                  type="password"
                  name="graph_client_secret"
                  className="input input-bordered w-full"
                  value={emailConfig.graph_client_secret || ""}
                  onChange={handleEmailConfigChange}
                  placeholder={emailConfig.graph_client_secret_set ? "••••••••" : ""}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">From Email Address</span>
                </label>
                <input
                  type="email"
                  name="graph_from_email"
                  className="input input-bordered w-full"
                  value={emailConfig.graph_from_email || ""}
                  onChange={handleEmailConfigChange}
                  placeholder="notifications@example.com"
                />
              </div>
            </div>
          )}

          <div className="divider my-6">Schedule</div>

          <div className="form-control max-w-xs">
            <label className="label">
              <span className="label-text font-semibold">Daily Check Time</span>
            </label>
            <input
              type="time"
              name="daily_check_time"
              className="input input-bordered w-full"
              value={emailConfig.daily_check_time || "09:00"}
              onChange={handleEmailConfigChange}
            />
            <label className="label">
              <span className="label-text-alt">Time when daily expiry checks will run</span>
            </label>
          </div>

          {/* Test Email Section */}
          <div className="divider my-6">Test Configuration</div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              className="input input-bordered flex-1"
              placeholder="Enter email to test"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
            />
            <button
              className={`btn btn-secondary ${testing ? "loading" : ""}`}
              onClick={handleTestEmail}
              disabled={testing}
            >
              <Send size={18} />
              Send Test Email
            </button>
          </div>

          <div className="mt-4 p-4 bg-base-200 rounded-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex-1">
                <h4 className="font-semibold text-sm mb-1">Test Daily Expiry Check</h4>
                <p className="text-xs text-base-content/70">
                  Run the daily expiry check immediately to test certificate and secret notifications.
                  This will check all configured items and send notifications based on your settings.
                </p>
              </div>
              <button
                className={`btn btn-accent btn-sm ${testingDailyCheck ? "loading" : ""}`}
                onClick={handleTestDailyCheck}
                disabled={testingDailyCheck}
              >
                <Bell size={16} />
                {testingDailyCheck ? "Running..." : "Run Check Now"}
              </button>
            </div>
          </div>

          <div className="card-actions justify-end mt-6">
            <button
              className={`btn btn-primary ${loading ? "loading" : ""}`}
              onClick={handleSaveEmailConfig}
              disabled={loading}
            >
              Save Email Configuration
            </button>
          </div>
        </div>
      </div>

      {/* Global Notification Settings */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-2xl mb-4">
            <Bell size={24} />
            Global Notification Settings
          </h2>

          <div className="form-control">
            <label className="label cursor-pointer justify-start gap-2">
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={globalConfig.enabled}
                onChange={(e) =>
                  setGlobalConfig((prev) => ({ ...prev, enabled: e.target.checked }))
                }
              />
              <span className="label-text font-semibold">Enable Global Notifications</span>
            </label>
            <label className="label">
              <span className="label-text-alt">
                Global notifications apply to all resources without specific team or custom settings
              </span>
            </label>
          </div>

          {globalConfig.enabled && (
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
                {globalConfig.recipients.map((email) => (
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
                {globalConfig.recipients.length === 0 && (
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
                      checked={globalConfig.expiry_thresholds.includes(threshold)}
                      onChange={() => handleToggleThreshold(threshold)}
                    />
                    <span className="label-text">{threshold} days</span>
                  </label>
                ))}
              </div>

              <label className="label">
                <span className="label-text-alt">
                  Notifications will be sent when resources are expiring within these thresholds
                </span>
              </label>

              <div className="divider">Notification Types</div>

              <div className="space-y-2">
                <label className="label cursor-pointer justify-start gap-2">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary"
                    checked={globalConfig.notify_expiring}
                    onChange={(e) =>
                      setGlobalConfig((prev) => ({ ...prev, notify_expiring: e.target.checked }))
                    }
                  />
                  <span className="label-text">Notify for expiring certificates/secrets</span>
                </label>

                <label className="label cursor-pointer justify-start gap-2">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary"
                    checked={globalConfig.notify_expired}
                    onChange={(e) =>
                      setGlobalConfig((prev) => ({ ...prev, notify_expired: e.target.checked }))
                    }
                  />
                  <span className="label-text">Notify for expired certificates/secrets</span>
                </label>
              </div>
            </>
          )}

          <div className="card-actions justify-end mt-4">
            <button
              className={`btn btn-primary ${loading ? "loading" : ""}`}
              onClick={handleSaveGlobalConfig}
              disabled={loading}
            >
              Save Notification Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
