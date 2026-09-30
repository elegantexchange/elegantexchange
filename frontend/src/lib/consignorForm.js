/** Shared consignor form helpers (phones, dates, expiry). */

export const PHONE_TYPES = [
  { value: "mobile", label: "Mobile" },
  { value: "home", label: "Home" },
  { value: "work", label: "Work" },
];

export const EXPIRY_OPTIONS = [
  { value: "donate", label: "Donate" },
  { value: "pick-up", label: "Pick up" },
  { value: "return", label: "Return" },
];

export function expiryLabel(value) {
  const raw = (value || "").trim();
  if (!raw) return "";
  const hit = EXPIRY_OPTIONS.find((o) => o.value === raw);
  if (hit) return hit.label;
  const key = raw.toLowerCase().replace(/[\s_]+/g, "-");
  const compact = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (key === "pickup" || compact === "pickup") return "Pick up";
  if (compact === "donate" || compact === "donated") return "Donate";
  if (compact === "return" || compact === "returned") return "Return";
  return raw;
}

/** Show a stored number in the field without mangling values that aren't 10 digits. */
export function phoneFieldValue(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  const core =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (core.length === 10) return formatPhoneInput(core);
  return String(raw || "").trim();
}

export function formatPhoneInput(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  let core = digits;
  if (core.length === 11 && core.startsWith("1")) core = core.slice(1);
  else if (core.length > 10 && core.startsWith("1")) core = core.slice(1);
  core = core.slice(0, 10);
  if (!core) return "";
  if (core.length < 4) return `(${core}`;
  if (core.length < 7) return `(${core.slice(0, 3)}) ${core.slice(3)}`;
  return `(${core.slice(0, 3)}) ${core.slice(3, 6)}-${core.slice(6)}`;
}

export function telHref(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  const core =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (core.length !== 10) return "";
  return `tel:+1${core}`;
}

export function phoneTypeLabel(type) {
  return PHONE_TYPES.find((t) => t.value === type)?.label || "Mobile";
}

export function phonesFromConsignor(consignor) {
  const stored = Array.isArray(consignor?.phones) ? consignor.phones : [];
  const source = stored.filter((p) => (p?.number || "").trim());
  const rows = (source.length ? source : consignor?.phone ? [{ type: "mobile", number: consignor.phone }] : []).map(
    (p) => ({
      type: PHONE_TYPES.some((t) => t.value === p?.type) ? p.type : "mobile",
      number: phoneFieldValue(p?.number || ""),
    })
  );
  return rows.length ? rows : [{ type: "mobile", number: "" }];
}

export function displayPhones(consignor) {
  return phonesFromConsignor(consignor).filter((p) => (p.number || "").trim());
}

export function blankConsignorForm() {
  return {
    consignor_id: "",
    full_name: "",
    phones: [{ type: "mobile", number: "" }],
    email: "",
    address: "",
    payout_method: "Cash",
    payout_details: "",
    expiry_action: "",
    date_of_drop_off: "",
    notes: "",
  };
}

export function draftFromConsignor(consignor) {
  return {
    consignor_id: consignor?.consignor_id || "",
    full_name: consignor?.full_name || "",
    phones: phonesFromConsignor(consignor),
    email: consignor?.email || "",
    address: consignor?.address || "",
    payout_method: consignor?.payout_method || "Cash",
    payout_details: consignor?.payout_details || "",
    expiry_action: normalizeExpiry(consignor?.expiry_action || ""),
    date_of_drop_off: consignor?.date_of_drop_off || "",
    notes: consignor?.notes || "",
  };
}

function normalizeExpiry(value) {
  const raw = (value || "").trim();
  if (!raw) return "";
  const compact = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (compact === "donate" || compact === "donated" || compact === "donation") return "donate";
  if (compact === "pickup") return "pick-up";
  if (compact === "return" || compact === "returned") return "return";
  return raw;
}

export function isoToDisplay(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!m) return "";
  return `${m[2]}-${m[3]}-${m[1]}`;
}

export function displayToIso(text) {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec((text || "").trim());
  if (!m) return "";
  const month = Number(m[1]);
  const day = Number(m[2]);
  const year = Number(m[3]);
  const d = new Date(year, month - 1, day);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return "";
  }
  return `${m[3]}-${m[1]}-${m[2]}`;
}

export function formatDateInput(raw) {
  const digits = String(raw || "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

export function isoToLocalDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!m) return undefined;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return undefined;
  }
  return d;
}

export function localDateToIso(date) {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function buildConsignorBody(form) {
  const consignor_id = (form.consignor_id || "").trim();
  if (!/^\d{4}$/.test(consignor_id)) {
    return { error: "Consignor ID should be 4 digits, like 2047" };
  }
  const full_name = (form.full_name || "").trim();
  if (full_name.length < 2) return { error: "Enter a full name" };
  const email = (form.email || "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email or leave it blank" };
  }

  const phones = [];
  for (const row of form.phones || []) {
    const raw = (row?.number || "").trim();
    if (!raw) continue;
    const digits = raw.replace(/\D/g, "");
    const core =
      digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
    if (core.length !== 10) {
      return { error: "Phone numbers should be 10 digits, like (508) 555-0142" };
    }
    const type = PHONE_TYPES.some((t) => t.value === row.type) ? row.type : "mobile";
    phones.push({ type, number: formatPhoneInput(core) });
  }

  let date_of_drop_off = (form.date_of_drop_off || "").trim();
  if (date_of_drop_off && !/^\d{4}-\d{2}-\d{2}$/.test(date_of_drop_off)) {
    const iso = displayToIso(formatDateInput(date_of_drop_off));
    if (!iso) return { error: "Enter the drop-off date as MM-DD-YYYY" };
    date_of_drop_off = iso;
  }

  return {
    body: {
      consignor_id,
      full_name,
      phones,
      phone: phones[0]?.number || "",
      email,
      address: (form.address || "").trim(),
      payout_method: form.payout_method,
      payout_details: (form.payout_details || "").trim(),
      notes: (form.notes || "").trim(),
      expiry_action: form.expiry_action || "",
      date_of_drop_off,
    },
  };
}
