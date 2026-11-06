import { createContext, useContext, useState } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem("user");
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      localStorage.removeItem("user");
      return null;
    }
  });

  const [loading, setLoading] = useState(false);

  const login = async (email, password) => {
    setLoading(true);

    try {
      const response = await api.post("/auth/login", { email, password });
      const { token, user: loggedInUser } = response.data;

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(loggedInUser));
      setUser(loggedInUser);

      return { success: true, user: loggedInUser };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Login failed",
      };
    } finally {
      setLoading(false);
    }
  };

  const register = async (name, email, password) => {
    setLoading(true);

    try {
      await api.post("/auth/register", { name, email, password });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Registration failed",
      };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  const isAdmin = user?.role === "ADMIN";
  const isAccountHolder = user?.role === "ACCOUNT_HOLDER";

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        isAdmin,
        isAccountHolder,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
