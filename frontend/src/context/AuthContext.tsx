import { jwtDecode } from "jwt-decode";
import {
  createContext,
  useState,
  useEffect,
  ReactNode,
  useContext,
} from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

interface AuthProviderProps {
  children: ReactNode;
}

interface AuthTokens {
  access: string;
  refresh: string;
}

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

interface User {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  is_admin: boolean;
  teams: { id: number; name: string }[];
  profile_image?: string | null;
}

interface AuthContextType {
  user: DecodedToken | null;
  userData:User | null;
  setUser: React.Dispatch<React.SetStateAction<DecodedToken | null>>;
  setUserData: React.Dispatch<React.SetStateAction<User | null>>;
  authTokens: AuthTokens | null;
  setAuthTokens: React.Dispatch<React.SetStateAction<AuthTokens | null>>;
  loginUser: (email: string, password: string) => Promise<void>;
  logoutUser: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);



export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [authTokens, setAuthTokens] = useState<AuthTokens | null>(() => {
    const storedTokens = localStorage.getItem("authTokens");
    return storedTokens ? JSON.parse(storedTokens) : null;
  });
  const [userData, setUserData] = useState<User | null>(null);
  const [user, setUser] = useState<DecodedToken | null>(() => {
    const storedTokens = localStorage.getItem("authTokens");
    return storedTokens ? jwtDecode(storedTokens) : null;
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchUser = async (accessToken:string) => {
    try {
      const baseURL = import.meta.env.VITE_API_URL;
      const res = await axios.get(`${baseURL}/users/me/`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      setUserData(res.data);
    } catch (err) {
      setUserData(null);
      logoutUser();
    } finally {
      setLoading(false);
    }
  };

  const loginUser = async (email: string, password: string) => {
    const baseURL = import.meta.env.VITE_API_URL;
    const response = await fetch(`${baseURL}/token/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });
    const data = await response.json();

    if (response.status === 200) {
      setAuthTokens(data);
      setUser(jwtDecode(data.access));
      localStorage.setItem("authTokens", JSON.stringify(data));

      await fetchUser(data.access);
      navigate("/");
    } else if (response.status === 401) {
      throw new Error("Incorrect email or password.");
    }else{
      throw new Error(data.detail || "Something went wrong. Please try again.");
    }
  };

  const logoutUser = () => {
    setAuthTokens(null);
    setUser(null);
    setUserData(null);
    localStorage.removeItem("authTokens");
    navigate("/login");
  };

  const ContextData = {
    user,
    setUser,
    userData,
    setUserData,
    authTokens,
    setAuthTokens,
    loginUser,
    logoutUser,
  };

  useEffect(() => {
    if (authTokens) {
      setUser(jwtDecode(authTokens.access));
      fetchUser(authTokens.access);
    }
    setLoading(false);
  }, [authTokens, loading]);

  return (
    <AuthContext.Provider value={ContextData}>
      {loading ? null : children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("⚠️ useAuth must be used within an <AuthProvider>");
  }
  return ctx;
}
