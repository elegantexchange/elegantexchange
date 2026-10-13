/** Category discounts, dated in the boutique's Eastern Time. */

export function shopTodayISO(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function activeDiscountFor(item, discounts, today = shopTodayISO()) {
  const category = (item?.category || "").trim();
  if (!category) return null;
  return (
    (discounts || []).find(
      (d) => d.category === category && d.starts_on <= today && today <= d.ends_on
    ) || null
  );
}

export function discountedPrice(asking, percentOff) {
  const cents = Math.round(Number(asking) * 100);
  if (!Number.isFinite(cents)) return 0;
  const sale = Math.round((cents * (100 - Number(percentOff))) / 100);
  return sale / 100;
}

export function percentLabel(percent) {
  const n = Number(percent);
  if (!Number.isFinite(n)) return "";
  return Number.isInteger(n) ? String(n) : String(n);
}
