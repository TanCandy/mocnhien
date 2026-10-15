const crypto = require("crypto");
const mongoose = require("mongoose");
const QRCode = require("qrcode");
const { env } = require("../config/env");
const { logger } = require("../config/logger");
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const { buildVietQRPayload } = require("../services/vietqr");
const { getOrderTotalVND, computePaymentFields } = require("../services/orderMath");
const paymentService = require("../services/paymentService");

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** SePay sends local Vietnam time without an offset: "2024-05-01 14:02:37". */
function parseSepayDate(value) {
  if (!value) return undefined;
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/.exec(String(value).trim());
  const d = m ? new Date(`${m[1]}T${m[2]}+07:00`) : new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function bankInfo() {
  return {
    bin: env.PAYMENT_BANK_BIN,
    bankName: env.PAYMENT_BANK_NAME,
    accountNumber: env.PAYMENT_ACCOUNT_NUMBER,
    accountName: env.PAYMENT_ACCOUNT_NAME,
  };
}

// ============================================
// SePay webhook — POST /api/payments/webhook/sepay
// Configure in SePay: URL https://<domain>/api/payments/webhook/sepay,
// auth type "API Key", key = SEPAY_WEBHOOK_API_KEY.
// Must answer 2xx quickly; any non-2xx makes SePay retry (which is safe —
// processing is idempotent on the SePay transaction id).
// ============================================
async function sepayWebhook(req, res) {
  if (!env.SEPAY_WEBHOOK_API_KEY) {
    return res.status(503).json({ success: false, message: "Payment webhook is not configured." });
  }

  const header = String(req.headers.authorization || "");
  const [scheme, key] = header.split(/\s+/, 2);
  if (!/^(apikey|bearer)$/i.test(scheme || "") || !key || !safeEqual(key, env.SEPAY_WEBHOOK_API_KEY)) {
    logger.warn({ ip: req.ip }, "[SePay] rejected webhook with bad API key");
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const body = req.body || {};
  const txnId = body.id;
  const amount = Math.round(Number(body.transferAmount));
  if (txnId === undefined || txnId === null || String(txnId) === "") {
    return res.status(400).json({ success: false, message: "Missing transaction id" });
  }

  // Money going out of the account is not a customer payment.
  if (body.transferType !== "in") {
    return res.status(200).json({ success: true, ignored: "outgoing" });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(200).json({ success: true, ignored: "non-positive amount" });
  }

  // If several accounts are linked to the SePay workspace, only count the
  // one this shop displays on its QR codes.
  const expected = String(env.PAYMENT_ACCOUNT_NUMBER || "");
  const accounts = [body.accountNumber, body.subAccount].filter(Boolean).map(String);
  if (expected && accounts.length > 0 && !accounts.includes(expected)) {
    logger.info({ txnId, accounts }, "[SePay] transfer to another account ignored");
    return res.status(200).json({ success: true, ignored: "other account" });
  }

  const result = await paymentService.recordIncomingTransfer({
    provider: "sepay",
    providerTxnId: txnId,
    amount,
    content: body.content || body.description || "",
    accountNumber: body.accountNumber || "",
    gateway: body.gateway || "",
    referenceCode: body.referenceCode || "",
    transactionDate: parseSepayDate(body.transactionDate),
    raw: body,
  });

  return res.status(200).json({
    success: true,
    duplicate: result.duplicate || undefined,
    matched: result.order ? result.order.orderCode : undefined,
  });
}

// ============================================
// Payment instructions for one order — GET /api/payments/orders/:id
// Owner or admin. Returns bank details, the exact transfer content, the
// outstanding amount and a dynamic VietQR (PNG data URL).
// ============================================
async function getOrderPaymentInfo(req, res) {
  const { id } = req.params;
  const trimmed = String(id || "").trim();
  let order = null;
  if (mongoose.Types.ObjectId.isValid(trimmed)) {
    order = await Order.findById(trimmed).lean();
  }
  if (!order) {
    order = await Order.findOne({
      $or: [
        { orderCode: trimmed },
        { tracking_code: trimmed },
        { trackingId: trimmed },
      ],
    }).lean();
  }
  if (!order) return res.status(404).json({ message: "Order not found." });

  const isAdmin = req.user.role === "admin";
  const email = String(req.user.email || "").toLowerCase();
  const isOwner = String(order.user) === String(req.user._id) || order.userEmail === email;
  if (!isAdmin && !isOwner) return res.status(403).json({ message: "Access denied." });

  const total = getOrderTotalVND(order);
  const payment = computePaymentFields(total, order.paidAmount);
  const isPaid = order.status === "delivered" || order.paymentStatus === "paid" || payment.paymentStatus === "paid";
  const transferContent = paymentService.transferContentFor(order.orderCode);

  let state = "due";
  if (isPaid) state = "paid";
  else if (total <= 0) state = "no_price";
  else if (payment.paidAmount > 0) state = "partial";

  // No price yet → QR carries only the content (customer types the amount
  // agreed with staff); fully paid → no QR at all.
  let qr = null;
  if (state !== "paid" && order.orderCode) {
    const amount = state === "no_price" ? 0 : payment.remainingAmount;
    const payload = buildVietQRPayload({
      bankBin: env.PAYMENT_BANK_BIN,
      accountNumber: env.PAYMENT_ACCOUNT_NUMBER,
      amount,
      description: transferContent,
    });
    qr = {
      payload,
      amount,
      dataUrl: await QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 1, width: 360 }),
    };
  }

  return res.status(200).json({
    orderId: String(order._id),
    orderCode: order.orderCode,
    state,
    status: order.status,
    totalVND: total,
    paidAmount: payment.paidAmount,
    remainingAmount: isPaid ? 0 : payment.remainingAmount,
    paymentPercent: isPaid ? 100 : payment.paymentPercent,
    transferContent,
    bank: bankInfo(),
    qr,
    autoConfirm: Boolean(env.SEPAY_WEBHOOK_API_KEY),
  });
}

// ============================================
// Admin — GET /api/payments?status=unmatched|matched&limit=
// ============================================
async function listPayments(req, res) {
  const filter = {};
  if (["matched", "unmatched"].includes(req.query.status)) filter.status = req.query.status;
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));

  const [payments, unmatchedCount] = await Promise.all([
    Payment.find(filter).select("-raw").sort({ createdAt: -1 }).limit(limit).lean(),
    Payment.countDocuments({ status: "unmatched" }),
  ]);
  return res.status(200).json({
    payments: payments.map((p) => ({ ...p, _id: String(p._id), order: p.order ? String(p.order) : null })),
    unmatchedCount,
    webhookConfigured: Boolean(env.SEPAY_WEBHOOK_API_KEY),
  });
}

// ============================================
// Admin — POST /api/payments/:id/assign { orderCode }
// ============================================
async function assignPayment(req, res) {
  const orderCode = String(req.body?.orderCode || "").trim();
  if (!orderCode) return res.status(400).json({ message: "orderCode is required." });

  const { payment, order } = await paymentService.assignPayment(req.params.id, orderCode, req.user._id);
  logger.info(
    { paymentId: String(payment._id), orderCode: order.orderCode, by: String(req.user._id) },
    "[Payments] unmatched transfer assigned"
  );
  return res.status(200).json({
    message: `Transfer assigned to ${order.orderCode}.`,
    orderCode: order.orderCode,
    paidAmount: order.paidAmount,
    paymentStatus: order.paymentStatus,
  });
}

module.exports = { sepayWebhook, getOrderPaymentInfo, listPayments, assignPayment, parseSepayDate };
