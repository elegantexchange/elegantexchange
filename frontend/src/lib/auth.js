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

export const ROLE_LABELS = {
  admin: "Admin",
  manager: "Manager",
  retail: "Retail",
};

/** Local UI work without a running API (set REACT_APP_UI_ONLY=true). */
export const isUiOnly =
  String(process.env.REACT_APP_UI_ONLY || "").toLowerCase() === "true" ||
  process.env.REACT_APP_UI_ONLY === "1";

export const MOCK_OWNER = {
  id: "ui-only",
  email: "shop@elegantexchange.co",
  name: "Youseline S.",
  role: "admin",
  phone: "",
  must_change_password: false,
  onboarding_completed_at: "2026-01-01T00:00:00+00:00",
  product_tour_completed_at: "2026-01-01T00:00:00+00:00",
};
