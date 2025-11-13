import { Navigate} from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";

interface AdminRouteProps {
  children: ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { user } = useAuth();

  // Temporarily disable admin check - all authenticated users can access admin routes
  // TODO: Implement Entra ID group-based permissions
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

