/**
 * Order State Machine for Mộc Nhiên logistics workflow
 * Enforces strict one-way state transitions:
 * pending -> approved -> shipping -> delivered
 */

const ALLOWED_TRANSITIONS = {
  pending: ["pending", "approved"],
  approved: ["approved", "shipping"],
  shipping: ["shipping", "delivered"],
  delivered: ["delivered"],
};

const VALID_STATUSES = ["pending", "approved", "shipping", "delivered"];

/**
 * Check if a status transition is permitted
 * @param {string} fromStatus Current status in database
 * @param {string} toStatus Target status requested
 * @returns {boolean} True if transition is valid or idempotent
 */
function canTransition(fromStatus, toStatus) {
  const from = String(fromStatus || "").toLowerCase().trim();
  const to = String(toStatus || "").toLowerCase().trim();
  if (!from || !to) return false;
  if (!VALID_STATUSES.includes(from) || !VALID_STATUSES.includes(to)) return false;
  if (from === to) return true; // Idempotent same-state updates are allowed
  return Boolean(ALLOWED_TRANSITIONS[from] && ALLOWED_TRANSITIONS[from].includes(to));
}

/**
 * Get next allowed target statuses from a given status
 * @param {string} currentStatus
 * @returns {string[]}
 */
function getNextAllowedStatuses(currentStatus) {
  const from = String(currentStatus || "").toLowerCase().trim();
  return ALLOWED_TRANSITIONS[from] || [];
}

module.exports = {
  ALLOWED_TRANSITIONS,
  VALID_STATUSES,
  canTransition,
  getNextAllowedStatuses,
};
