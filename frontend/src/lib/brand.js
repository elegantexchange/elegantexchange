export const LOGO_URL = "/logo.png";

export const STORE = {
  name: "The Elegant Exchange",
  tagline: "Boutique Consignment",
  address: "38 Central Sq., Bridgewater, MA 02324",
};

export const CATEGORIES = [
  "Dresses",
  "Tops",
  "Bottoms",
  "Denim",
  "Outerwear",
  "Handbags",
  "Shoes",
  "Accessories",
  "Jewelry",
  "Other",
];

/** Letter and dress sizes the floor already uses most. No "One size" — shop rows almost never record it on clothing. */
const APPAREL_SIZES = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "0",
  "2",
  "4",
  "6",
  "8",
  "10",
  "12",
  "14",
  "16",
];

const SHOE_SIZES = Array.from({ length: 15 }, (_, i) => {
  const n = 5 + i * 0.5;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
});

export const ONE_SIZE = "One size";

const APPAREL_CATEGORIES = new Set([
  "Dresses",
  "Tops",
  "Bottoms",
  "Denim",
  "Outerwear",
]);

const ONE_SIZE_CATEGORIES = new Set(["Handbags", "Jewelry", "Accessories"]);

const GENERAL_SIZES = ["XS", "S", "M", "L", "XL", "XXL", ONE_SIZE];

export function sizesForCategory(category) {
  if (APPAREL_CATEGORIES.has(category)) return APPAREL_SIZES;
  if (category === "Shoes") return SHOE_SIZES;
  if (ONE_SIZE_CATEGORIES.has(category)) return [ONE_SIZE];
  return GENERAL_SIZES;
}

/** Other (and a bulk row with no category yet) can take a size that is not on the list. */
export function categoryAllowsCustomSize(category) {
  return (
    !APPAREL_CATEGORIES.has(category) &&
    category !== "Shoes" &&
    !ONE_SIZE_CATEGORIES.has(category)
  );
}

export const CONDITIONS = ["Excellent", "Like New", "Very Good", "Good", "Fair"];

export const PAYOUT_METHODS = [
  "Cash",
  "Check",
  "Zelle",
  "Venmo",
  "Store Credit",
  "Square",
];
