/**
 * Order State Machine for Mộc Nhiên logistics workflow
 * Enforces strict one-way state transitions:
 * pending -> approved -> shipping -> delivered
 */

export type OrderStatus = "pending" | "approved" | "shipping" | "delivered";

export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["pending", "approved"],
  approved: ["approved", "shipping"],
  shipping: ["shipping", "delivered"],
  delivered: ["delivered"],
};

export const VALID_STATUSES: OrderStatus[] = ["pending", "approved", "shipping", "delivered"];

/**
 * Check if a status transition is permitted
 */
export function canTransition(fromStatus?: string | null, toStatus?: string | null): boolean {
  const from = (fromStatus || "").toLowerCase().trim() as OrderStatus;
  const to = (toStatus || "").toLowerCase().trim() as OrderStatus;
  if (!from || !to) return false;
  if (!VALID_STATUSES.includes(from) || !VALID_STATUSES.includes(to)) return false;
  if (from === to) return true;
  return Boolean(ALLOWED_TRANSITIONS[from]?.includes(to));
}

/**
 * Get next allowed target statuses from a given status
 */
export function getNextAllowedStatuses(currentStatus: OrderStatus): OrderStatus[] {
  return ALLOWED_TRANSITIONS[currentStatus] || [currentStatus];
}
