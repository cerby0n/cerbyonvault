import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Certifiates from "./pages/Certificates";
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";
import PrivateKey from "./pages/PrivateKey";
import Dashboard from "./pages/Dashboard";
import { AuthProvider } from "./context/AuthContext";
import { PrivateRoute } from "./utils/PrivateRoute";
import Register from "./pages/Register";
import TeamDetail from "./pages/TeamDetail";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Websites from "./pages/Websites";
import { AdminRoute } from "./utils/AdminRoute";
import SSOCallback from "./pages/SSOCallback";
import Secrets from "./pages/Secrets";

const queryClient = new QueryClient();

function App() {
  return (
    <div className="bg-base-200/50 ">
      <Router>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/sso/callback" element={<SSOCallback />} />
              <Route path="*" element={<NotFound />} />
              <Route
                path="/certificates"
                element={
                  <PrivateRoute>
                    <Certifiates />
                  </PrivateRoute>
                }
              />
              <Route
                path="/teams"
                element={
                  <AdminRoute>
                    <Admin />
                  </AdminRoute>
                }
              />
              <Route
                path="/private-key"
                element={
                  <PrivateRoute>
                    <PrivateKey />
                  </PrivateRoute>
                }
              />
              <Route
                path="/websites"
                element={
                  <PrivateRoute>
                    <Websites />
                  </PrivateRoute>
                }
              />
              <Route
                path="/secrets"
                element={
                  <PrivateRoute>
                    <Secrets />
                  </PrivateRoute>
                }
              />
              <Route
                path="/"
                element={
                  <PrivateRoute>
                    <Dashboard />
                  </PrivateRoute>
                }
              />
              <Route path="/register/:token" element={<Register />} />
              <Route
                path="/admin/teams/:id"
                element={
                  <AdminRoute>
                    <TeamDetail />
                  </AdminRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </QueryClientProvider>
      </Router>
    </div>
  );
}

export default App;
