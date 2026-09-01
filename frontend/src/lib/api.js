import axios from "axios";
import { isUiOnly } from "@/lib/auth";
import { readOperator } from "@/lib/operator";

const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "");
export const API_BASE = BACKEND_URL ? `${BACKEND_URL}/api` : "";
export const isBackendConfigured = Boolean(BACKEND_URL);

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("ee_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const op = readOperator();
  if (op?.name) {
    config.headers["X-EE-Operator"] = op.name;
  }
  // Local-only mock dataset (frontend/src/lib/uiOnlyMock.js — gitignored)
  if (isUiOnly) {
    config.adapter = async (cfg) => {
      const { uiOnlyMockData } = await import("@/lib/uiOnlyMock");
      return {
        data: uiOnlyMockData(cfg),
        status: 200,
        statusText: "OK (UI-only)",
        headers: {},
        config: cfg,
        request: {},
      };
    };
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (isUiOnly) return Promise.reject(err);
    if (err?.response?.status === 401 && window.location.pathname !== "/login") {
      localStorage.removeItem("ee_token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export function formatApiError(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export const fmtMoney = (n) =>
  (n == null ? 0 : Number(n)).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });

/** US-style phone: (000) 000-0000. Falls back to trimmed original if not 10 digits. */
export const fmtPhone = (raw) => {
  if (raw == null || raw === "") return "";
  const digits = String(raw).replace(/\D/g, "");
  const core =
    digits.length === 11 && digits.startsWith("1")
      ? digits.slice(1)
      : digits;
  if (core.length !== 10) return String(raw).trim();
  return `(${core.slice(0, 3)}) ${core.slice(3, 6)}-${core.slice(6)}`;
};

export const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const fmtDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " · " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};
