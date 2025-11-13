import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { useAuth } from "../context/AuthContext";

interface DecodedToken {
  token_type: string;
  exp: number;
  iat: number;
  jti: string;
  user_id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  teams: { id: number; name: string }[];
}

/**
 * SSO Callback page that receives JWT tokens from the backend after successful SSO authentication.
 * The tokens are passed in the URL query parameters and stored in localStorage.
 */
function SSOCallback() {
  const navigate = useNavigate();
  const { setAuthTokens, setUser } = useAuth();

  useEffect(() => {
    const handleSSOCallback = async () => {
      try {
        // Get URL parameters
        const params = new URLSearchParams(window.location.search);
        const accessToken = params.get("access");
        const refreshToken = params.get("refresh");

        if (!accessToken || !refreshToken) {
          console.error("Missing tokens in SSO callback");
          navigate("/login");
          return;
        }

        // Store tokens
        const tokens = {
          access: accessToken,
          refresh: refreshToken,
        };

        setAuthTokens(tokens);
        localStorage.setItem("authTokens", JSON.stringify(tokens));

        // Decode and set user
        const decodedToken = jwtDecode<DecodedToken>(accessToken);
        setUser(decodedToken);

        console.log("SSO login successful:", decodedToken);

        // Redirect to home page
        navigate("/");
      } catch (error) {
        console.error("Error during SSO callback:", error);
        navigate("/login");
      }
    };

    handleSSOCallback();
  }, [navigate, setAuthTokens, setUser]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="loading loading-spinner loading-lg"></div>
        <p className="mt-4">Completing sign-in...</p>
      </div>
    </div>
  );
}

export default SSOCallback;
