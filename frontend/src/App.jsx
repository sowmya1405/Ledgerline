import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import PublicUser from "./pages/PublicUser";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Dashboard from "./pages/Dashboard";
import TransactionHistory from "./pages/TransactionHistory";
import AdminDashboard from "./pages/AdminDashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";

function ProtectedRoute({ children, allowedRoles }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route
        path="/"
        element={
          <Navigate
            to={
              user?.role === "ADMIN"
                ? "/admin"
                : user
                ? "/dashboard"
                : "/login"
            }
            replace
          />
        }
      />

      <Route
        path="/login"
        element={
          user ? (
            <Navigate
              to={user.role === "ADMIN" ? "/admin" : "/dashboard"}
              replace
            />
          ) : (
            <Login />
          )
        }
      />

      <Route
        path="/register"
        element={user ? <Navigate to="/dashboard" replace /> : <Register />}
      />

      {/* Account Holder Dashboard */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={["ACCOUNT_HOLDER"]}>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      {/* Transaction History */}
      <Route
        path="/transactions/history"
        element={
          <ProtectedRoute allowedRoles={["ACCOUNT_HOLDER"]}>
            <TransactionHistory />
          </ProtectedRoute>
        }
      />

      {/* Admin Dashboard */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="/user/:id" element={<PublicUser />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;