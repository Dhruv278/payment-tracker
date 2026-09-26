/** Your name/business as shown to clients (login page, portal header, emails). */
export const brand = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME || "Payment Tracker",
  tagline: process.env.NEXT_PUBLIC_BRAND_TAGLINE || "Software development",
};

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "P";
}
