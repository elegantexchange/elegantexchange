/** @param {{ role?: string } | null | undefined} user */
export function normalizeRole(role) {
  const key = (role || "").toLowerCase();
  if (key === "owner" || key === "admin") return "admin";
  if (key === "manager") return "manager";
  if (key === "staff" || key === "retail") return "retail";
  return "retail";
}

/** @param {{ role?: string } | null | undefined} user */
export function roleOf(user) {
  return normalizeRole(user?.role);
}

/** @param {{ role?: string } | null | undefined} user */
export function hasRole(user, ...roles) {
  const r = roleOf(user);
  return roles.map(normalizeRole).includes(r);
}

export function isAdmin(user) {
  return hasRole(user, "admin");
}

export function isManagerOrAdmin(user) {
  return hasRole(user, "admin", "manager");
}

/** @deprecated use isAdmin */
export function isOwner(user) {
  return isAdmin(user);
}

export function needsOnboarding(user) {
  if (!user) return false;
  if (user.must_change_password) return true;
  if (!user.onboarding_completed_at) return true;
  return false;
}

export function needsProductTour(user) {
  if (!user) return false;
  if (needsOnboarding(user)) return false;
  return !user.product_tour_completed_at;
}

const PENDING_GUIDE_KEY = "ee_pending_guide";

/** Mark that the in-app guide should open after the next shell load (post-login). */
export function markPendingGuide() {
  try {
    sessionStorage.setItem(PENDING_GUIDE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function hasPendingGuide() {
  try {
    return sessionStorage.getItem(PENDING_GUIDE_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearPendingGuide() {
  try {
    sessionStorage.removeItem(PENDING_GUIDE_KEY);
  } catch {
    /* ignore */
  }
}

export const ROLE_LABELS = {
  admin: "Owner",
  manager: "Manager",
  retail: "Retail",
};

/** Local UI work without a running API (set REACT_APP_UI_ONLY=true). */
export const isUiOnly =
  String(process.env.REACT_APP_UI_ONLY || "").toLowerCase() === "true" ||
  process.env.REACT_APP_UI_ONLY === "1";

/** Role-preview switcher is localhost-only (never on deployed hosts). */
export const isLocalHost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

/** Personas for local sidebar role preview (UI only — API still uses signed-in session). */
export const ROLE_PREVIEW_PERSONAS = [
  {
    id: "admin",
    name: "Youseline",
    role: "admin",
    email: "shop@elegantexchange.co",
  },
  {
    id: "manager",
    name: "Noah",
    role: "manager",
    email: "noah@elegantexchange.co",
  },
  {
    id: "retail",
    name: "Zachary",
    role: "retail",
    email: "zachary@elegantexchange.co",
  },
];

export const MOCK_OWNER = {
  id: "ui-only",
  email: "shop@elegantexchange.co",
  name: "Youseline",
  role: "admin",
  phone: "",
  must_change_password: false,
  onboarding_completed_at: "2026-01-01T00:00:00+00:00",
  product_tour_completed_at: "2026-01-01T00:00:00+00:00",
};
