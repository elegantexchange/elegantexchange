/** Shared shop@ operator presence (floor attribution). */

export const SHARED_SHOP_EMAIL = "shop@elegantexchange.co";

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
