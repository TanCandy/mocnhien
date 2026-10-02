/** Product categories offered by both the customer order form and the admin order form. */
export const PRODUCT_TYPES = [
  { value: "Electronics", label: "Electronics" },
  { value: "Fashion", label: "Fashion & Apparel" },
  { value: "Shoes", label: "Shoes" },
  { value: "Beauty", label: "Beauty & Cosmetics" },
  { value: "Home", label: "Home & Living" },
  { value: "Health", label: "Health & Supplements" },
  { value: "Books", label: "Books & Stationery" },
  { value: "Toys", label: "Toys & Games" },
  { value: "Sports", label: "Sport & Outdoors" },
  { value: "Other", label: "Other" },
] as const;

/**
 * Map a stored value onto its canonical option, ignoring case — the admin form
 * used to save lowercase values ("electronics"). Unknown values are returned
 * unchanged so editing an order never silently drops its category.
 */
export function normalizeProductType(value?: string | null): string {
  const v = (value || "").trim();
  if (!v) return "";
  return PRODUCT_TYPES.find((t) => t.value.toLowerCase() === v.toLowerCase())?.value ?? v;
}

export function isKnownProductType(value: string): boolean {
  return PRODUCT_TYPES.some((t) => t.value === value);
}
