import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";

interface SSOConfig {
  id?: number;
  tenant_id: string;
  client_id: string;
  client_secret?: string;
  is_enabled: boolean;
  redirect_uri?: string;
  client_secret_set?: boolean;
}

export default function SSOSettings() {
  const { authTokens } = useAuth();
  const baseURL = import.meta.env.VITE_API_URL;

  const [config, setConfig] = useState<SSOConfig>({
    tenant_id: "",
    client_id: "",
    client_secret: "",
    is_enabled: false,
    redirect_uri: "",
  });

  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [hasExistingConfig, setHasExistingConfig] = useState(false);

  useEffect(() => {
    fetchSSOConfig();
  }, []);

  const fetchSSOConfig = async () => {
    try {
      const response = await axios.get(`${baseURL}/admin/sso-settings/`, {
        headers: {
          Authorization: `Bearer ${authTokens?.access}`,
        },
      });

      if (response.data) {
        setConfig({
          ...response.data,
          client_secret: "", // Don't populate the secret field
        });
        setHasExistingConfig(true);
      }
    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.error("Failed to fetch SSO config:", error);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setConfig((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleTestConnection = async () => {
    if (!config.tenant_id || !config.client_id) {
      setMessage({ type: "error", text: "Please enter Tenant ID and Client ID" });
      return;
    }

    setTesting(true);
    setMessage(null);

    try {
      const response = await axios.post(
        `${baseURL}/admin/sso-settings/test/`,
        {
          tenant_id: config.tenant_id,
          client_id: config.client_id,
        },
        {
          headers: {
            Authorization: `Bearer ${authTokens?.access}`,
          },
        }
      );

      if (response.data.success) {
        setMessage({ type: "success", text: "Connection successful! Entra ID tenant is reachable." });
      } else {
        setMessage({ type: "error", text: response.data.message || "Connection test failed" });
      }
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to test connection",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await axios.post(`${baseURL}/admin/sso-settings/`, config, {
        headers: {
          Authorization: `Bearer ${authTokens?.access}`,
        },
      });

      setMessage({ type: "success", text: response.data.message || "SSO configuration saved successfully" });
      setHasExistingConfig(true);
      // Refetch to get updated data
      setTimeout(() => fetchSSOConfig(), 1000);
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error.response?.data?.error || "Failed to save SSO configuration",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold mb-6">SSO Configuration (Entra ID / Azure AD)</h2>

        {message && (
          <div
            className={`alert mb-4 ${
              message.type === "success" ? "alert-success" : "alert-error"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <form onSubmit={handleSaveConfig}>
              {/* Tenant ID */}
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text font-semibold">Tenant ID</span>
                </label>
                <input
                  type="text"
                  name="tenant_id"
                  value={config.tenant_id}
                  onChange={handleInputChange}
                  placeholder="e.g., xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="input input-bordered w-full"
                  required
                />
                <label className="label">
                  <span className="label-text-alt">
                    Found in Azure Portal → Azure Active Directory → Overview
                  </span>
                </label>
              </div>

              {/* Client ID */}
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text font-semibold">Client ID (Application ID)</span>
                </label>
                <input
                  type="text"
                  name="client_id"
                  value={config.client_id}
                  onChange={handleInputChange}
                  placeholder="e.g., xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="input input-bordered w-full"
                  required
                />
                <label className="label">
                  <span className="label-text-alt">
                    Found in Azure Portal → App Registration → Application (client) ID
                  </span>
                </label>
              </div>

              {/* Client Secret */}
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text font-semibold">Client Secret</span>
                  {config.client_secret_set && (
                    <span className="label-text-alt text-success">✓ Secret is set</span>
                  )}
                </label>
                <input
                  type="password"
                  name="client_secret"
                  value={config.client_secret}
                  onChange={handleInputChange}
                  placeholder={
                    config.client_secret_set
                      ? "Leave blank to keep existing secret"
                      : "Enter client secret"
                  }
                  className="input input-bordered w-full"
                  required={!hasExistingConfig}
                />
                <label className="label">
                  <span className="label-text-alt">
                    Found in Azure Portal → App Registration → Certificates & secrets
                  </span>
                </label>
              </div>

              {/* Redirect URI (optional) */}
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text font-semibold">Redirect URI (Optional)</span>
                </label>
                <input
                  type="url"
                  name="redirect_uri"
                  value={config.redirect_uri || ""}
                  onChange={handleInputChange}
                  placeholder="https://your-domain.com/auth/callback"
                  className="input input-bordered w-full"
                />
                <label className="label">
                  <span className="label-text-alt">
                    Must match the redirect URI configured in Azure App Registration
                  </span>
                </label>
              </div>

              {/* Enable SSO Toggle */}
              <div className="form-control mb-6">
                <label className="label cursor-pointer justify-start gap-4">
                  <input
                    type="checkbox"
                    name="is_enabled"
                    checked={config.is_enabled}
                    onChange={handleInputChange}
                    className="checkbox checkbox-primary"
                  />
                  <span className="label-text font-semibold">Enable SSO Authentication</span>
                </label>
                <label className="label">
                  <span className="label-text-alt text-warning">
                    ⚠️ Enabling this will allow users to login via Microsoft Entra ID
                  </span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  className={`btn btn-outline ${testing ? "loading" : ""}`}
                  disabled={testing || !config.tenant_id || !config.client_id}
                >
                  {testing ? "Testing..." : "Test Connection"}
                </button>

                <button
                  type="submit"
                  className={`btn btn-primary ${loading ? "loading" : ""}`}
                  disabled={loading}
                >
                  {loading ? "Saving..." : "Save Configuration"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Documentation Section */}
        <div className="mt-8 card bg-base-200">
          <div className="card-body">
            <h3 className="card-title text-lg">Setup Instructions</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Go to Azure Portal → Azure Active Directory</li>
              <li>Navigate to App registrations → New registration</li>
              <li>Give your app a name (e.g., "CerbyonVault SSO")</li>
              <li>
                Select "Accounts in this organizational directory only" for supported account
                types
              </li>
              <li>Add a redirect URI (Web platform): https://your-domain.com/auth/callback</li>
              <li>After registration, copy the Application (client) ID and Tenant ID</li>
              <li>Go to Certificates & secrets → New client secret → Copy the secret value</li>
              <li>Paste the values above and test the connection</li>
              <li>Enable SSO when ready</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
