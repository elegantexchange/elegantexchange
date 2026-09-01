/** Shared shop@ operator presence (floor attribution). */

export const SHARED_SHOP_EMAIL = "shop@elegantexchange.co";

/** Floor presence → intended role label (shop@ login stays Owner/admin for API). */
export const SHARED_OPERATOR_ROLES = {
  youseline: "admin",
  johan: "admin",
  noah: "manager",
  zachary: "retail",
};

export const SHARED_OPERATORS = [
  { id: "youseline", name: "Youseline" },
  { id: "johan", name: "Johan" },
  { id: "noah", name: "Noah" },
  { id: "zachary", name: "Zachary" },
];

const SESSION_KEY = "ee_operator";
const PERSIST_KEY = "ee_operator_persist";

export function needsOperatorPick(user) {
  const email = (user?.email || "").toLowerCase();
  return email === SHARED_SHOP_EMAIL;
}

export function readOperator() {
  try {
    const raw =
      sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(PERSIST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.id || !parsed?.name) return null;
    if (!SHARED_OPERATORS.some((o) => o.id === parsed.id)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Name shown in chrome / Settings: floor presence when on shop@. */
export function displayNameFor(user) {
  if (needsOperatorPick(user)) {
    const op = readOperator();
    if (op?.name) return op.name;
  }
  const name = (user?.name || "").trim();
  if (!name || /^owner$/i.test(name) || /^admin$/i.test(name)) {
    return needsOperatorPick(user) ? "Boutique" : name || "Account";
  }
  return name;
}

/** Role key for badges: presence role on shop@, else account role. */
export function displayRoleFor(user) {
  if (needsOperatorPick(user)) {
    const op = readOperator();
    if (op?.id && SHARED_OPERATOR_ROLES[op.id]) {
      return SHARED_OPERATOR_ROLES[op.id];
    }
  }
  const key = (user?.role || "").toLowerCase();
  if (key === "owner" || key === "admin") return "admin";
  if (key === "manager") return "manager";
  return "retail";
}

export function writeOperator(operator, { persist = false } = {}) {
  if (!operator) {
    clearOperator();
    return;
  }
  const payload = JSON.stringify({ id: operator.id, name: operator.name });
  sessionStorage.setItem(SESSION_KEY, payload);
  if (persist) localStorage.setItem(PERSIST_KEY, payload);
  else localStorage.removeItem(PERSIST_KEY);
}

export function clearOperator() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(PERSIST_KEY);
  } catch {
    /* ignore */
  }
}
