import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import {
  clearPendingGuide,
  isLocalHost,
  isUiOnly,
  markPendingGuide,
  MOCK_OWNER,
  ROLE_PREVIEW_PERSONAS,
} from "@/lib/auth";

const AuthContext = createContext(null);
const PREVIEW_KEY = "ee_role_preview";

function readStoredPreview() {
  if (!isLocalHost) return null;
  try {
    const id = sessionStorage.getItem(PREVIEW_KEY);
    if (!id) return null;
    return ROLE_PREVIEW_PERSONAS.find((p) => p.id === id) || null;
  } catch {
    return null;
  }
}

function applyPreview(baseUser, preview) {
  if (!baseUser || !preview) return baseUser;
  return {
    ...baseUser,
    id: `preview-${preview.id}`,
    name: preview.name,
    email: preview.email,
    role: preview.role,
    must_change_password: false,
    onboarding_completed_at:
      baseUser.onboarding_completed_at || "2026-01-01T00:00:00+00:00",
    product_tour_completed_at:
      baseUser.product_tour_completed_at || "2026-01-01T00:00:00+00:00",
    _rolePreview: preview.id,
  };
}

export function AuthProvider({ children }) {
  const [sessionUser, setSessionUser] = useState(null);
  const [preview, setPreview] = useState(readStoredPreview);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (isUiOnly) {
      setSessionUser(MOCK_OWNER);
      setLoading(false);
      return;
    }
    const token = localStorage.getItem("ee_token");
    if (!token) {
      setSessionUser(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setSessionUser(data);
    } catch {
      localStorage.removeItem("ee_token");
      setSessionUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isLocalHost) {
      setPreview(null);
      return;
    }
    try {
      if (preview?.id) sessionStorage.setItem(PREVIEW_KEY, preview.id);
      else sessionStorage.removeItem(PREVIEW_KEY);
    } catch {
      /* ignore */
    }
  }, [preview]);

  const login = async (email, password) => {
    if (isUiOnly) {
      markPendingGuide();
      setSessionUser(MOCK_OWNER);
      return applyPreview(MOCK_OWNER, preview) || MOCK_OWNER;
    }
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("ee_token", data.token);
    markPendingGuide();
    setSessionUser(data.user);
    return applyPreview(data.user, preview) || data.user;
  };

  const logout = async () => {
    setPreview(null);
    clearPendingGuide();
    try {
      sessionStorage.removeItem(PREVIEW_KEY);
    } catch {
      /* ignore */
    }
    if (isUiOnly) {
      setSessionUser(null);
      return;
    }
    try {
      await api.post("/auth/logout");
    } catch {
      /* ignore */
    }
    localStorage.removeItem("ee_token");
    setSessionUser(null);
  };

  const setRolePreview = useCallback((persona) => {
    if (!isLocalHost) return;
    setPreview(persona || null);
  }, []);

  const clearRolePreview = useCallback(() => {
    setPreview(null);
  }, []);

  const user = applyPreview(sessionUser, isLocalHost ? preview : null);

  return (
    <AuthContext.Provider
      value={{
        user,
        sessionUser,
        loading,
        login,
        logout,
        refresh,
        rolePreview: isLocalHost ? preview : null,
        setRolePreview,
        clearRolePreview,
        canRolePreview: isLocalHost && !!sessionUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
