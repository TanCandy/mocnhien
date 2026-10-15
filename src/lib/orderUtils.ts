/**
 * Order display helpers — warehouse address fallback and VND calculation
 */
import { parseUSD, ensureUrlProtocol } from "./formatters";

/** Resolve warehouse address with legacy fallback for old orders */
export function getWarehouseAddress(order: {
  warehouseAddress?: string;
  addressFrom?: string;
  addressTo?: string;
  origin?: string;
  destination?: string;
  address?: string;
}): string {
  if (order.warehouseAddress?.trim()) {
    return order.warehouseAddress.trim();
  }
  const from = order.addressFrom || order.origin || "";
  const to = order.addressTo || order.destination || order.address || "";
  if (from && to) return `${from} → ${to}`;
  if (from) return from;
  if (to) return to;
  return "";
}

/** MongoDB _id for API mutations — never use display id (orderCode) */
export function getMongoOrderId(order: { _id?: string }): string {
  if (!order._id) {
    throw new Error("Missing order _id. Please refresh the page and try again.");
  }
  return String(order._id);
}

/** Resolve warehouse address with legacy fallback for old orders */
export type ContactType = "email" | "phone" | "none";

/** Convert DB contact fields to display string */
export function resolveContactDisplay(
  contactType?: string,
  contactValue?: string
): string {
  if (contactType === "none" || contactValue === "NO_CONTACT") return "No Contact";
  if (contactType === "phone" && contactValue) return contactValue;
  if (contactType === "email" && contactValue) return contactValue;
  return "—";
}

export interface CreateOrderForm {
  productType: string;
  productName: string;
  productLink?: string;
  warehouseAddress: string;
  staffName: string;
  priceUSD: string;
  paidAmount?: string | number;
}

/** Body for POST /api/orders. The price field holds "1,299"-style text, so send it as a number. */
export function buildOrderPayload(form: CreateOrderForm, exchangeRate: number) {
  const usd = parseUSD(form.priceUSD);
  const rawLink = form.productLink?.trim();
  return {
    productType: form.productType,
    productName: form.productName,
    productLink: rawLink ? ensureUrlProtocol(rawLink) : undefined,
    warehouseAddress: form.warehouseAddress.trim(),
    staffName: form.staffName.trim(),
    priceUSD: usd > 0 ? usd : undefined,
    exchangeRate,
    paidAmount: form.paidAmount || 0,
  };
}

/** VND = USD × user-provided exchange rate (no external API) */
export function computeOrderVND(
  priceUSD?: number,
  exchangeRate?: number,
  storedVND?: number
): number {
  const usd = Number(priceUSD) || 0;
  const rate = Number(exchangeRate) || 0;
  if (usd > 0 && rate > 0) {
    return Math.round(usd * rate);
  }
  return Number(storedVND) || 0;
}
