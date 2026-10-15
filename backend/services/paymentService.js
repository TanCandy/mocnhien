/**
 * Bank-transfer reconciliation.
 *
 * Flow: customer scans the order's VietQR (amount + "ORD…" content
 * pre-filled) → money lands in the shop account → SePay calls our webhook →
 * recordIncomingTransfer() stores the transfer once (idempotent on the
 * provider transaction id) and adds the amount to the order's paidAmount.
 * Partial payments accumulate; the order flips to "paid" when fully covered.
 * Transfers whose content has no recognisable order code are kept as
 * "unmatched" for an admin to assign by hand.
 */

const mongoose = require("mongoose");
const { logger } = require("../config/logger");
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const { getOrderTotalVND, computePaymentFields } = require("./orderMath");
const sheets = require("./sheetsSync");

const MAX_CAS_RETRIES = 5;

/**
 * Order codes look like ORD-<8 base36>-<4 hex>. Banks strip or replace the
 * hyphens and may wrap the content with their own prefixes, so match on the
 * content with every non-alphanumeric removed. Returns all candidates
 * (overlapping), formatted back to the canonical code.
 */
function extractOrderCodeCandidates(content) {
  const flat = String(content || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const out = [];
  for (let i = flat.indexOf("ORD"); i !== -1; i = flat.indexOf("ORD", i + 1)) {
    const chunk = flat.slice(i, i + 15);
    if (/^ORD[A-Z0-9]{12}$/.test(chunk)) {
      const code = `ORD-${chunk.slice(3, 11)}-${chunk.slice(11, 15)}`;
      if (!out.includes(code)) out.push(code);
    }
  }
  return out;
}

/** Transfer content to put on the QR / show the customer for an order. */
function transferContentFor(orderCode) {
  return String(orderCode || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

async function findOrderFromContent(content) {
  const candidates = extractOrderCodeCandidates(content);
  if (candidates.length === 0) return null;
  const orders = await Order.find({ orderCode: { $in: candidates } });
  // Prefer the earliest candidate in the content
  for (const code of candidates) {
    const hit = orders.find((o) => o.orderCode === code);
    if (hit) return hit;
  }
  return null;
}

/**
 * Add a payment's amount to its order's paidAmount — exactly once.
 * - idempotent: the order remembers applied payment ids, so retries after a
 *   crash (or a webhook redelivery) never double-count
 * - concurrency-safe: compare-and-swap on the previous paidAmount, so
 *   simultaneous transfers / admin edits never lose an update
 * Returns the updated order (lean).
 */
async function applyPaymentToOrder(orderId, payment) {
  const paymentId = payment._id;
  for (let attempt = 0; attempt < MAX_CAS_RETRIES; attempt++) {
    const order = await Order.findById(orderId).lean();
    if (!order) throw new Error(`Order ${orderId} not found`);
    if ((order.appliedPaymentIds || []).some((id) => String(id) === String(paymentId))) {
      return order; // already applied
    }

    const prevPaid = order.paidAmount || 0;
    const fields = computePaymentFields(getOrderTotalVND(order), prevPaid + payment.amount);
    if (order.status === "delivered") fields.paymentStatus = "paid";

    const res = await Order.updateOne(
      {
        _id: order._id,
        // Legacy docs may lack the field entirely — treat missing as 0.
        paidAmount: prevPaid ? prevPaid : { $in: [0, null] },
        appliedPaymentIds: { $ne: paymentId },
      },
      { $set: fields, $push: { appliedPaymentIds: paymentId } }
    );
    if (res.matchedCount === 1) {
      return Order.findById(order._id).lean();
    }
  }
  throw new Error(`Could not apply payment to order ${orderId}: too much contention`);
}

/**
 * Store an incoming transfer and apply it to its order.
 * @returns {{ duplicate: boolean, payment?: object, order?: object }}
 */
async function recordIncomingTransfer({
  provider = "sepay",
  providerTxnId,
  amount,
  content,
  accountNumber,
  gateway,
  referenceCode,
  transactionDate,
  raw,
}) {
  const order = await findOrderFromContent(content);

  let payment;
  try {
    payment = await Payment.create({
      provider,
      providerTxnId: String(providerTxnId),
      order: order?._id,
      orderCode: order?.orderCode,
      amount,
      content: content || "",
      accountNumber: accountNumber || "",
      gateway: gateway || "",
      referenceCode: referenceCode || "",
      transactionDate,
      status: order ? "matched" : "unmatched",
      raw,
    });
  } catch (err) {
    if (err && err.code === 11000) {
      // Redelivery. If the first attempt stored the transfer but died before
      // crediting the order, finish the job now (idempotent).
      const existing = await Payment.findOne({ provider, providerTxnId: String(providerTxnId) });
      if (existing?.status === "matched" && existing.order) {
        try {
          await applyPaymentToOrder(existing.order, existing);
        } catch (applyErr) {
          logger.warn({ err: applyErr.message }, "[Payments] applyPaymentToOrder on duplicate ignored");
        }
      }
      logger.info({ provider, providerTxnId }, "[Payments] duplicate webhook ignored");
      return { duplicate: true };
    }
    throw err;
  }

  if (!order) {
    logger.warn({ providerTxnId, amount, content }, "[Payments] unmatched transfer stored");
    return { duplicate: false, payment };
  }

  const updated = await applyPaymentToOrder(order._id, payment);
  logger.info(
    { providerTxnId, orderCode: updated.orderCode, amount, paidAmount: updated.paidAmount, paymentStatus: updated.paymentStatus },
    "[Payments] transfer applied"
  );
  await sheets.syncOrder(updated);
  return { duplicate: false, payment, order: updated };
}

/** Admin: attach an unmatched transfer to an order and apply it. */
async function assignPayment(paymentId, orderCode, adminUserId) {
  if (!mongoose.Types.ObjectId.isValid(String(paymentId))) {
    const err = new Error("Invalid payment id.");
    err.statusCode = 400;
    throw err;
  }
  const order = await Order.findOne({ orderCode: String(orderCode || "").trim().toUpperCase() });
  if (!order) {
    const err = new Error("Order not found.");
    err.statusCode = 404;
    throw err;
  }

  // Claim the payment atomically so a double-click can't apply it twice.
  const payment = await Payment.findOneAndUpdate(
    { _id: paymentId, status: "unmatched" },
    {
      $set: {
        status: "matched",
        order: order._id,
        orderCode: order.orderCode,
        assignedBy: adminUserId,
        assignedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );
  if (!payment) {
    const existing = await Payment.findById(paymentId);
    if (existing?.status === "matched" && existing.order) {
      // Finish a previous assignment that died before crediting (idempotent).
      try {
        await applyPaymentToOrder(existing.order, existing);
      } catch (applyErr) {
        logger.warn({ err: applyErr.message }, "[Payments] applyPaymentToOrder on existing assignment failed");
      }
    }
    const err = new Error(existing ? "This transfer is already assigned." : "Payment not found.");
    err.statusCode = existing ? 409 : 404;
    throw err;
  }

  const updated = await applyPaymentToOrder(order._id, payment);
  await sheets.syncOrder(updated);
  return { payment, order: updated };
}

module.exports = {
  extractOrderCodeCandidates,
  transferContentFor,
  applyPaymentToOrder,
  recordIncomingTransfer,
  assignPayment,
};
