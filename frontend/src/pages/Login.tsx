import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import CerbyonLogo from "../assets/CerbyonLogo";
import ThemeToggle from "../utils/ThemeToggle";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [checkingSso, setCheckingSso] = useState(true);
  const { loginUser } = useAuth();

  // Check if SSO is enabled on component mount
  useEffect(() => {
    checkSSOStatus();
  }, []);

  const checkSSOStatus = async () => {
    try {
      const baseURL = import.meta.env.VITE_API_URL;
      const response = await fetch(`${baseURL}/sso/status/`);
      const data = await response.json();
      setSsoEnabled(data.sso_enabled || false);
    } catch (error) {
      console.error("Failed to check SSO status:", error);
      setSsoEnabled(false);
    } finally {
      setCheckingSso(false);
    }
  };

  const handleSSOLogin = () => {
    const baseURL = import.meta.env.VITE_API_URL;
    // Redirect to OIDC authentication endpoint
    window.location.href = `${baseURL.replace('/api', '')}/oidc/authenticate/`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await loginUser(email, password);
    } catch (error: any) {
      console.error("Login error:", error);
      setError(error.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-full max-w-md p-6 bg-base-100 shadow-lg rounded-lg relative">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="flex justify-center mt-10 mb-5">
          <CerbyonLogo className="h-16" />
        </div>

        {/* SSO Login Button */}
        {!checkingSso && ssoEnabled && (
          <>
            <button
              type="button"
              onClick={handleSSOLogin}
              className="w-full py-3 mb-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.5 12.3c0-.9-.1-1.7-.2-2.5H12v4.8h6.5c-.3 1.5-1.1 2.8-2.3 3.7v3h3.7c2.2-2 3.4-5 3.4-8.5z"/>
                <path d="M12 24c3.2 0 5.9-1 7.9-2.8l-3.7-3c-1 .7-2.4 1.1-4.2 1.1-3.2 0-5.9-2.2-6.9-5.1H1.2v3.1C3.3 21.2 7.3 24 12 24z"/>
                <path d="M5.1 14.2c-.5-1.5-.5-3.1 0-4.5V6.6H1.2C-.4 9.8-.4 14.2 1.2 17.4l3.9-3.2z"/>
                <path d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.4-3.4C18 1.1 15.2 0 12 0 7.3 0 3.3 2.8 1.2 6.6L5.1 9.7c1-2.9 3.7-5 6.9-5z"/>
              </svg>
              Sign in with Microsoft
            </button>
            <div className="divider text-sm text-neutral-content">OR</div>
          </>
        )}

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 text-error text-center text-sm font-semibold">
              {error}
            </div>
          )}
          <div className="mb-4">
            <label
              htmlFor="email"
              className="block text-sm font-semibold text-base-content mb-1"
            >
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder=""
              className="w-full px-4 py-2 mt-1 border border-neutral rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="mb-6">
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-base-content mb-1"
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder=""
              className="w-full px-4 py-2 mt-1 border border-neutral rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <button
            type="submit"
            className={`w-full py-2 bg-primary text-primary-content font-bold rounded-md transition-all ease-in-out duration-300 hover:bg-primary-focus focus:ring-4 focus:ring-primary-content ${
              loading ? "cursor-not-allowed opacity-50" : ""
            }`}
            disabled={loading}
          >
            {loading ? "Loading..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
