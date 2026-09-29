/** Shared shop@ operator presence (floor attribution). */

export const SHARED_SHOP_EMAIL = "shop@elegantexchange.co";

/** Floor presence → intended role label (shop@ login stays Owner/admin for API). */
export const SHARED_OPERATOR_ROLES = {
  youseline: "admin",
  johan: "admin",
  noah: "manager",
  zachary: "retail",
  intern: "retail",
};

export const SHARED_OPERATORS = [
  { id: "youseline", name: "Youseline" },
  { id: "johan", name: "Johan" },
  { id: "noah", name: "Noah" },
  { id: "zachary", name: "Zachary" },
  { id: "intern", name: "Intern" },
];

const SESSION_KEY = "ee_operator";
const PERSIST_KEY = "ee_operator_persist";

/** First token of a typed intern name, safe to show in the greeting. */
export function normalizeGivenName(raw) {
  const token = String(raw || "").trim().split(/\s+/)[0] || "";
  if (!/^[\p{L}][\p{L}'’-]*$/u.test(token) || token.length > 40) return "";
  return token.charAt(0).toLocaleUpperCase() + token.slice(1);
}

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
    const operator = { id: parsed.id, name: parsed.name };
    const givenName =
      parsed.id === "intern" ? normalizeGivenName(parsed.givenName) : "";
    if (givenName) operator.givenName = givenName;
    return operator;
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
  const record = { id: operator.id, name: operator.name };
  const givenName =
    operator.id === "intern" ? normalizeGivenName(operator.givenName) : "";
  if (givenName) record.givenName = givenName;
  const payload = JSON.stringify(record);
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
