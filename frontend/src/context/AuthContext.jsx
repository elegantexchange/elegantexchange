import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { isUiOnly, MOCK_OWNER } from "@/lib/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (isUiOnly) {
      setUser(MOCK_OWNER);
      setLoading(false);
      return;
    }
    const token = localStorage.getItem("ee_token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      localStorage.removeItem("ee_token");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email, password) => {
    if (isUiOnly) {
      setUser(MOCK_OWNER);
      return MOCK_OWNER;
    }
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("ee_token", data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    if (isUiOnly) {
      setUser(null);
      return;
    }
    try {
      await api.post("/auth/logout");
    } catch {
      /* ignore */
    }
    localStorage.removeItem("ee_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
