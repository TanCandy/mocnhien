const crypto = require("crypto");
const mongoose = require("mongoose");
const { logger } = require("../config/logger");
const { calculateQuote } = require("../utils/quoteCalculator");
const Order = require("../models/Order");
const { parseUSD, parseExchangeRate, formatVND, formatUSD } = require("../services/exchangeRateService");
const { getOrderTotalUSD, getOrderTotalVND, computePaymentFields } = require("../services/orderMath");
const sheets = require("../services/sheetsSync");
const { canTransition, VALID_STATUSES } = require("../utils/orderStateMachine");

const syncOrderToGoogleSheets = sheets.syncOrder;

/** Mongoose validation / cast problems are the caller's fault → 400, not 500. */
function isClientDbError(err) {
  return err && (err.name === "ValidationError" || err.name === "CastError");
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Owner = the account that placed it, or the customer email it's addressed to. */
function isOrderOwner(order, user) {
  const email = String(user.email || "").toLowerCase().trim();
  const ownerId = order.user?._id ?? order.user;
  return (ownerId && String(ownerId) === String(user._id)) || (!!email && order.userEmail === email);
}

/**
 * Resolve the payment fields to store, given what an admin sent.
 * - delivered ⇒ fully paid (any overpayment is kept)
 * - paidAmount is the source of truth; paymentPercent is only used when no
 *   paidAmount was sent
 * - an explicit paymentStatus "paid" settles the balance (e.g. cash received)
 * - an explicit paymentStatus "pending" is kept as a manual override
 */
function resolvePaymentUpdate({ totalVND, currentPaid, status, paidAmount, paymentPercent, paymentStatus }) {
  let paid = currentPaid;
  if (paidAmount !== undefined && paidAmount !== null && paidAmount !== "") {
    paid = Math.max(0, Number(paidAmount) || 0);
  } else if (paymentPercent !== undefined && paymentPercent !== null && paymentPercent !== "") {
    const pct = Math.min(100, Math.max(0, Number(paymentPercent) || 0));
    paid = Math.round((pct / 100) * totalVND);
  }

  const explicit = paymentStatus ? String(paymentStatus).toLowerCase() : undefined;
  if (status === "delivered" || explicit === "paid") {
    paid = Math.max(paid, totalVND);
  }

  const fields = computePaymentFields(totalVND, paid);
  if (status === "delivered" || explicit === "paid") {
    fields.paymentStatus = "paid";
  } else if (explicit === "pending") {
    fields.paymentStatus = "pending";
  }
  return fields;
}

/** Re-derive stored payment fields on a document after its total changed. */
function applyDerivedPaymentFields(doc) {
  const fields = computePaymentFields(getOrderTotalVND(doc), doc.paidAmount);
  doc.paymentPercent = fields.paymentPercent;
  doc.remainingAmount = fields.remainingAmount;
  if (doc.status !== "delivered") doc.paymentStatus = fields.paymentStatus;
}

function generateTrackingId() {
  const now = Date.now().toString().slice(-6);
  const rand = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `MN-${now}-${rand}`;
}

function generateOrderCode() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `ORD-${timestamp}-${rand}`;
}

function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(date) {
  const d = new Date(date);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function toWeightLabel(weightKg) {
  const n = Number(weightKg);
  const rounded = Number.isFinite(n) ? Math.round(n * 10) / 10 : weightKg;
  return `${rounded} kg`;
}

/** Find order by MongoDB _id, orderCode, or tracking code */
async function findOrderByIdentifier(id) {
  if (!id) return null;
  const trimmed = String(id).trim();

  if (mongoose.Types.ObjectId.isValid(trimmed)) {
    const byObjectId = await Order.findById(trimmed);
    if (byObjectId) return byObjectId;
  }

  return Order.findOne({
    $or: [
      { orderCode: trimmed },
      { tracking_code: trimmed },
      { trackingId: trimmed },
    ],
  });
}

// ─── Contact helpers ────────────────────────────────────────────────────────────

const VALID_CONTACT_TYPES = ["email", "phone", "none"];

/** Normalise raw contact payload into { contactType, contactValue }.
 *  Accepts: { contactType, contactValue } or a plain email string (legacy compat). */
function normaliseContact(raw) {
  if (!raw) return { contactType: "none", contactValue: "NO_CONTACT" };

  if (typeof raw === "object" && "contactType" in raw) {
    const ct = String(raw.contactType || "none").toLowerCase();
    const cv = String(raw.contactValue ?? "").trim();
    if (ct === "none") return { contactType: "none", contactValue: "NO_CONTACT" };
    if (ct === "phone") return { contactType: "phone", contactValue: cv.replace(/[^\d+]/g, "") };
    if (ct === "email") return { contactType: "email", contactValue: cv.toLowerCase().trim() };
    // Unknown type: keep it so the caller's VALID_CONTACT_TYPES check rejects it.
    return { contactType: ct, contactValue: cv };
  }

  // Legacy plain email string (string passed instead of object)
  const str = String(raw).trim().toLowerCase();
  if (!str) return { contactType: "none", contactValue: "NO_CONTACT" };
  return { contactType: "email", contactValue: str };
}

/** Resolve contact display label for API responses */
function resolveContact(order) {
  const ct = order.contactType;
  const cv = order.contactValue || "";
  if (ct === "none" || cv === "NO_CONTACT") return null;
  if (ct === "phone") return cv;
  if (ct === "email") return cv;
  return null;
}

/** Resolve warehouse address; fallback for legacy addressFrom/addressTo */
function getWarehouseAddress(order) {
  if (order.warehouseAddress && String(order.warehouseAddress).trim()) {
    return String(order.warehouseAddress).trim();
  }
  const from = order.addressFrom || order.origin || "";
  const to = order.addressTo || order.destination || order.address || "";
  if (from && to) return `${from} → ${to}`;
  return from || to || "";
}

function buildTimeline(order) {
  const createdAt = new Date(order.createdAt || order.order_date || Date.now());
  const tier = String(order.serviceTier || "standard").toLowerCase();
  const baseDays = tier === "express" ? 5 : 7;
  const extraDays = Math.min(3, Math.floor(Number(order.weightKg || 1) * 0.2));
  const totalDays = baseDays + extraDays;
  const deliveryAt = new Date(createdAt.getTime() + totalDays * 24 * 60 * 60 * 1000);

  const placedAt = new Date(createdAt.getTime() + 60 * 60 * 1000);
  const customsAt = new Date(createdAt.getTime() + 2 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000);
  const transitAt = new Date(createdAt.getTime() + 3 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000);
  const arrivedAt = new Date(deliveryAt.getTime() - 1 * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000);

  const status = String(order.status || "pending").toLowerCase();
  const approved = order.status === "approved";
  const stageCompleted = (idx) => {
    if (status === "delivered") return true;
    if (status === "shipping") return idx <= 2;
    if (status === "approved") return idx <= 1;
    if (approved || status === "pending") return idx === 0;
    return idx === 0;
  };

  const warehouse = getWarehouseAddress(order);

  const events = [
    {
      status: "Order Placed",
      location: warehouse || "Warehouse",
      time: stageCompleted(0) ? formatDateTime(placedAt) : "Pending",
      description: "Order submitted and awaiting approval.",
      completed: true,
    },
    {
      status: "Order Approved",
      location: "Mộc Nhiên HQ",
      time: order.approvedAt ? formatDateTime(order.approvedAt) : (approved ? "Approved" : "Pending"),
      description: "Order approved and processing started.",
      completed: approved || status === "approved" || status === "shipping" || status === "delivered",
    },
    {
      status: "Customs Cleared",
      location: "Customs Station",
      time: stageCompleted(2) ? formatDateTime(customsAt) : "Pending",
      description: "Export documentation approved.",
      completed: stageCompleted(2),
    },
    {
      status: "In Transit",
      location: "International Air",
      time: stageCompleted(3) ? formatDateTime(transitAt) : "Pending",
      description: "Departed from origin hub.",
      completed: stageCompleted(3),
    },
    {
      status: "Arrived at Destination",
      location: warehouse || "Warehouse",
      time: stageCompleted(4) ? formatDateTime(arrivedAt) : "Pending",
      description: "Awaiting local customs clearance.",
      completed: stageCompleted(4),
    },
    {
      status: "Delivered",
      location: "Final Destination",
      time: stageCompleted(5) ? formatDateTime(deliveryAt) : "Pending",
      description: "Handover to recipient.",
      completed: stageCompleted(5),
    },
  ];

  return events;
}

function mapOrderForApi(order) {
  let price = "$0.00";
  const priceUSD = getOrderTotalUSD(order);
  const exchangeRate = order.exchangeRate || 0;

  // ALWAYS recalculate VND from USD to avoid stale values
  const priceVND = getOrderTotalVND(order);
  const payment = computePaymentFields(priceVND, order.paidAmount);

  if (priceUSD > 0) {
    price = formatUSD(priceUSD);
  } else if (order.weightKg) {
    const q = calculateQuote({
      weightKg: order.weightKg,
      serviceTier: order.serviceTier || "standard",
      packageCategory: order.packageCategory || "general",
    });
    price = formatUSD(q.breakdown.totalUsd);
  }

  const orderDate = order.order_date || order.createdAt;
  const warehouseAddress = getWarehouseAddress(order);

  const mongoId = order._id?.toString?.() || String(order._id || "");

  return {
    id: order.orderCode || order.tracking_code || order.trackingId || mongoId,
    _id: mongoId,
    orderCode: order.orderCode,
    trackingId: order.tracking_code || order.trackingId,
    userId: order.user?._id?.toString() || order.user?.toString(),
    status: order.status,
    date: formatDate(orderDate),
    warehouseAddress,
    staffName: order.staffName ?? "",
    origin: warehouseAddress,
    destination: warehouseAddress,
    weight: toWeightLabel(order.weightKg || 0),
    weightKg: order.weightKg,
    category: order.packageCategory || "general",
    price,
    total_price: order.total_price,
    productType: order.productType,
    productName: order.productName || order.product_name,
    tracking_code: order.tracking_code,
    address: order.address,
    order_date: order.order_date,
    sold_by: order.sold_by,
    serviceTier: order.serviceTier,
    packageCategory: order.packageCategory,
    customerName: order.customerName,
    contactType: order.contactType || "email",
    contactValue: order.contactValue || "",
    customerContact: resolveContact(order) || "",
    productLink: order.productLink,
    uspsTracking: order.uspsTracking,
    priceUSD: priceUSD,
    priceVND: priceVND,  // Always recalculated from USD * rate
    exchangeRate: exchangeRate,
    priceVNDFormatted: formatVND(priceVND),
    priceUSDFormatted: formatUSD(priceUSD),
    totalUSD: priceUSD,
    totalVND: priceVND,
    paymentStatus: order.paymentStatus || payment.paymentStatus,
    // Derived, never read from the stored copies — those default to 0 and
    // were stale for most legacy orders.
    paymentPercent: payment.paymentPercent,
    paidAmount: payment.paidAmount,
    remainingAmount: payment.remainingAmount,
    approvedAt: order.approvedAt,
    approvedBy: order.approvedBy,
    createdAt: order.createdAt,
  };
}

// ============================================
// USER CREATE ORDER (New simplified version)
// ============================================
async function createOrder(req, res) {
  try {
    const userId = req.user._id;
    const userEmail = req.user.email.toLowerCase();
    const userName = req.user.name;

    const {
      productType,
      productName,
      productLink,
      warehouseAddress,
      staffName,
      contactType,
      contactValue,
      priceUSD,
      exchangeRate,
    } = req.body || {};

    if (
      !productType ||
      !productName ||
      !warehouseAddress ||
      !String(warehouseAddress).trim() ||
      !staffName ||
      !String(staffName).trim()
    ) {
      return res.status(400).json({ message: "Please fill all required fields." });
    }

    const exchangeRateValue = exchangeRate ? parseExchangeRate(exchangeRate) : 0;
    // Exchange rate is only required when a USD price is also provided
    // parseUSD strips thousands separators ("1,299" → 1299); parseFloat would stop at the comma
    const parsedPrice = parseUSD(priceUSD);
    if (parsedPrice > 0 && (isNaN(exchangeRateValue) || exchangeRateValue <= 0)) {
      return res.status(400).json({ message: "Exchange rate must be greater than 0 when price USD is provided." });
    }

    // Use provided contact or default to the logged-in user's email
    const contact = normaliseContact(
      contactType && contactValue ? { contactType, contactValue } : null
    ) || { contactType: "email", contactValue: userEmail };

    const orderCode = generateOrderCode();

    let priceUSDValue = 0;
    let priceVNDValue = 0;

    if (parsedPrice > 0) {
      priceUSDValue = parsedPrice;
      if (exchangeRateValue > 0) {
        priceVNDValue = Math.round(priceUSDValue * exchangeRateValue);
      }
    }

    const order = await Order.create({
      user: userId,
      userEmail,
      orderCode,
      productType: String(productType).trim(),
      productName: String(productName).trim(),
      productLink: productLink ? String(productLink).trim() : "",
      warehouseAddress: String(warehouseAddress).trim(),
      staffName: String(staffName).trim(),
      address: String(warehouseAddress).trim(),
      customerName: userName,
      contactType: contact.contactType,
      contactValue: contact.contactValue,
      priceUSD: priceUSDValue,
      priceVND: priceVNDValue,
      exchangeRate: exchangeRateValue,
      totalUSD: priceUSDValue,
      totalVND: priceVNDValue,
      status: "pending",
      paymentStatus: "pending",
    });

    logger.info({ orderId: String(order._id), orderCode, userId: String(userId) }, "[CreateOrder] order created");

    await syncOrderToGoogleSheets(order);

    return res.status(201).json({
      order: mapOrderForApi(order),
      message: "Order submitted, waiting for approval",
    });
  } catch (error) {
    logger.error({ err: error.message }, "[CreateOrder] failed");
    return res.status(500).json({ message: "Failed to create order" });
  }
}

// ============================================
// GET MY ORDERS (User's own orders by email)
// ============================================
async function getMyOrders(req, res) {
  try {
    const userEmail = req.user.email.toLowerCase().trim();

    const orders = await Order.find({ userEmail })
      .sort({ createdAt: -1 })
      .lean();

    logger.info({ userId: String(req.user._id), count: orders.length }, "[GetMyOrders] fetched");

    return res.status(200).json({
      orders: orders.map(mapOrderForApi),
      count: orders.length,
    });
  } catch (error) {
    logger.error({ err: error.message }, "[GetMyOrders] failed");
    return res.status(500).json({ message: "Failed to fetch your orders" });
  }
}

// ============================================
// ADMIN CREATE ORDER (Legacy with price)
// ============================================
async function adminCreateOrder(req, res) {
  const {
    tracking_code,
    product_name,
    productName,
    productType,
    warehouseAddress,
    staffName,
    total_price,
    order_date,
    sold_by,
    status,
    paymentStatus,
    paymentPercent,
    paidAmount,
    user_id,
    customerName,
    contactType,
    contactValue,
    productLink,
    uspsTracking,
    priceUSD,
    exchangeRate,
  } = req.body || {};

  const finalProductName = productName || product_name;
  const finalWarehouse = warehouseAddress ? String(warehouseAddress).trim() : "";
  const finalStaffName = staffName ? String(staffName).trim() : "";
  const userEmail = req.user.email.toLowerCase();

  if (!finalProductName) {
    return res.status(400).json({ message: "productName is required." });
  }
  if (!finalWarehouse) {
    return res.status(400).json({ message: "warehouseAddress is required." });
  }
  if (!finalStaffName) {
    return res.status(400).json({ message: "staffName is required." });
  }
  if (!customerName) {
    return res.status(400).json({ message: "customerName is required." });
  }

  // Contact is required (any of email / phone / none)
  const contact = normaliseContact({ contactType, contactValue });
  if (!contact.contactType || !VALID_CONTACT_TYPES.includes(contact.contactType)) {
    return res.status(400).json({ message: "contactType must be email, phone, or none." });
  }

  // Generate tracking code if not provided
  const finalTrackingCode = tracking_code ? String(tracking_code).trim() : generateTrackingId();

  // Check for duplicate tracking code (only if user provided one)
  if (tracking_code) {
    const existing = await Order.findOne({
      $or: [
        { tracking_code: finalTrackingCode },
        { trackingId: finalTrackingCode }
      ]
    });
    if (existing) {
      return res.status(409).json({ message: "Tracking code already exists." });
    }
  }

  // Parse priceUSD and exchangeRate
  const parsedPriceUSD = parseUSD(priceUSD);
  const parsedExchangeRate = exchangeRate ? parseExchangeRate(exchangeRate) : 0;

  // Exchange rate is only required when a USD price is also provided
  if (parsedPriceUSD > 0 && (isNaN(parsedExchangeRate) || parsedExchangeRate <= 0)) {
    return res.status(400).json({ message: "Exchange rate must be greater than 0 when price USD is provided." });
  }

  // Calculate VND price using user-provided exchange rate
  let priceVND = 0;
  if (parsedPriceUSD > 0 && parsedExchangeRate > 0) {
    priceVND = Math.round(parsedPriceUSD * parsedExchangeRate);
  }

  // Always generate a fresh orderCode — never reuse tracking_code
  const orderCode = generateOrderCode();

  const orderData = {
    orderCode,
    trackingId: finalTrackingCode,
    tracking_code: finalTrackingCode,
    product_name: String(finalProductName).trim(),
    productName: String(finalProductName).trim(),
    productType: productType || "",
    warehouseAddress: finalWarehouse,
    staffName: finalStaffName,
    address: finalWarehouse,
    total_price: total_price !== undefined ? Number(total_price) : 0,
    order_date: order_date ? new Date(order_date) : new Date(),
    sold_by: sold_by ? String(sold_by).trim() : "",
    status: status || "pending",
    customerName: String(customerName).trim(),
    contactType: contact.contactType,
    contactValue: contact.contactValue,
    userEmail: contact.contactType === "email" ? contact.contactValue : userEmail,
    productLink: productLink ? String(productLink).trim() : "",
    uspsTracking: uspsTracking ? String(uspsTracking).trim() : "",
    priceUSD: parsedPriceUSD,
    priceVND: priceVND,
    totalUSD: parsedPriceUSD,
    totalVND: priceVND,
    exchangeRate: parsedExchangeRate,
    ...resolvePaymentUpdate({
      totalVND: priceVND,
      currentPaid: 0,
      status: status || "pending",
      paidAmount,
      paymentPercent,
      paymentStatus,
    }),
  };

  // If user_id provided, use it; otherwise use admin's id (for self-orders)
  if (user_id) {
    orderData.user = user_id;
  } else {
    orderData.user = req.user._id;
  }

  const order = await Order.create(orderData);

  logger.info({ orderId: String(order._id), orderCode: order.orderCode, status: order.status }, "[AdminCreateOrder] order created");

  await syncOrderToGoogleSheets(order);

  return res.status(201).json({
    order: mapOrderForApi(order),
    message: "Order created successfully.",
  });
}

// ============================================
// ADMIN UPDATE ORDER
// ============================================
async function adminUpdateOrder(req, res) {
  try {
    const { id } = req.params;

    // ── 0. Normalise req.body: coerce empty strings → undefined ────────────
    //    Frontend sends "" for blank fields; we treat those as "not set"
    //    so they don't override existing DB values.
    const raw = {};
    for (const [k, v] of Object.entries(req.body || {})) {
      raw[k] = v === "" ? undefined : v;
    }

    // ── 1. Resolve real MongoDB _id ──────────────────────────────────────
    const currentOrder = await findOrderByIdentifier(id);
    if (!currentOrder) {
      return res.status(404).json({ message: "Order not found." });
    }

    const mongoId = currentOrder._id;

    // ── 2. Selective validation that requires the DB (not from req.body) ───

    // Tracking code uniqueness check
    if (raw.tracking_code !== undefined && String(raw.tracking_code).trim()) {
      const tc = String(raw.tracking_code).trim();
      const existing = await Order.findOne({
        _id: { $ne: mongoId },
        $or: [{ tracking_code: tc }, { trackingId: tc }],
      });
      if (existing) {
        return res.status(409).json({ message: "Tracking code already exists." });
      }
    }

    // Warehouse address non-empty check
    if (raw.warehouseAddress !== undefined) {
      const wh = String(raw.warehouseAddress).trim();
      if (!wh) {
        return res.status(400).json({ message: "warehouseAddress cannot be empty." });
      }
    }

    // Exchange rate > 0 check
    if (raw.exchangeRate !== undefined) {
      const rate = parseExchangeRate(raw.exchangeRate);
      if (isNaN(rate) || rate <= 0) {
        return res.status(400).json({ message: "Exchange rate must be greater than 0." });
      }
    }

    // ── 3. Build updateData from req.body directly ──────────────────────────
    //    Every field the frontend sends lands in the DB — no manual omissions.
    const updateData = { ...raw };

    // ── 3b. NEVER change orderCode on update ───────────────────────────────
    //    orderCode is the permanent sheet key. Restore from DB so that even
    //    if the frontend sends a stale/empty value, the DB value is preserved.
    updateData.orderCode = currentOrder.orderCode;

    // Normalise contact fields from req.body
    const ct = raw.contactType;
    const cv = raw.contactValue;
    if (ct !== undefined || cv !== undefined) {
      const resolved = normaliseContact({ contactType: ct, contactValue: cv });
      updateData.contactType = resolved.contactType;
      updateData.contactValue = resolved.contactValue;
      // userEmail stays as-is for order isolation
      updateData.userEmail =
        resolved.contactType === "email" ? resolved.contactValue : currentOrder.userEmail;
    }

    // Sync address mirror only when a non-empty value was provided
    if (raw.warehouseAddress !== undefined && String(raw.warehouseAddress).trim()) {
      updateData.address = String(raw.warehouseAddress).trim();
    }

    // ── 4. Server-computed price + payment fields ─────────────────────────
    //    Money fields are never taken from the body as-is: the total is
    //    derived server-side (the form's totalVND goes stale when the price is
    //    edited) and payment fields are recomputed from it.
    for (const k of [
      "priceUSD", "totalUSD", "exchangeRate", "priceVND", "totalVND",
      "paidAmount", "paymentPercent", "paymentStatus", "remainingAmount",
    ]) {
      delete updateData[k];
    }

    const sentPriceUSD = raw.priceUSD !== undefined;
    const sentExchangeRate = raw.exchangeRate !== undefined;
    const priceUSD = sentPriceUSD ? parseUSD(raw.priceUSD) : (currentOrder.priceUSD || 0);
    if (sentPriceUSD) {
      updateData.priceUSD = priceUSD;
      updateData.totalUSD = priceUSD;
    }
    if (sentExchangeRate) {
      updateData.exchangeRate = parseExchangeRate(raw.exchangeRate);
    }

    // Clearing the USD price clears the VND price too (no stale fallback).
    const cleared = sentPriceUSD && priceUSD === 0 ? { priceVND: 0, totalVND: 0 } : {};
    const totalVND = getOrderTotalVND({ ...currentOrder.toObject(), ...updateData, ...cleared });
    if (sentPriceUSD || sentExchangeRate) {
      updateData.priceVND = totalVND;
      updateData.totalVND = totalVND;
    }

    // ── 4b. Order State Machine Transition Validation ────────────────────
    if (raw.status !== undefined) {
      const targetStatus = String(raw.status).toLowerCase().trim();
      if (!VALID_STATUSES.includes(targetStatus)) {
        return res.status(400).json({ message: "Invalid status value." });
      }
      if (!canTransition(currentOrder.status, targetStatus)) {
        return res.status(400).json({
          message: `Cannot transition order status from '${currentOrder.status}' to '${targetStatus}'.`,
        });
      }
    }

    const normalizedStatus = raw.status ? String(raw.status).toLowerCase().trim() : currentOrder.status;
    const paymentInputSent =
      raw.paidAmount !== undefined || raw.paymentPercent !== undefined || raw.paymentStatus !== undefined;
    const totalChanged = totalVND !== getOrderTotalVND(currentOrder);

    // The edit form also sends the paidAmount it was opened with; if a bank
    // transfer was credited since, refuse instead of overwriting it.
    if (
      paymentInputSent &&
      raw.expectedPaidAmount !== undefined &&
      Number(raw.expectedPaidAmount) !== (currentOrder.paidAmount || 0)
    ) {
      return res.status(409).json({
        message: "A payment was recorded for this order while you were editing. Reload and try again.",
      });
    }

    updateData.status = normalizedStatus;
    if (paymentInputSent || totalChanged || normalizedStatus !== currentOrder.status) {
      Object.assign(updateData, resolvePaymentUpdate({
        totalVND,
        currentPaid: currentOrder.paidAmount || 0,
        status: normalizedStatus,
        paidAmount: raw.paidAmount,
        paymentPercent: raw.paymentPercent,
        paymentStatus: raw.paymentStatus,
      }));
    }

    // ── 6. Strip mongo-only / non-editable fields ───────────────────────────
    //    `user` (order ownership) must never be reassignable from this
    //    generic update payload — it's not a field the admin edit form sends.
    delete updateData._id;
    delete updateData.__v;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    delete updateData.user;
    delete updateData.appliedPaymentIds; // owned by the payment service
    delete updateData.expectedPaidAmount;

    // ── 7. Persist to DB ───────────────────────────────────────────────────
    //    When payment fields are rewritten, only apply if paidAmount is still
    //    what we computed from — otherwise a bank transfer landed meanwhile.
    const filter = { _id: mongoId };
    if (updateData.paidAmount !== undefined) {
      filter.paidAmount = currentOrder.paidAmount ? currentOrder.paidAmount : { $in: [0, null] };
    }
    const order = await Order.findOneAndUpdate(
      filter,
      { $set: updateData },
      { returnDocument: "after", runValidators: true }
    ).lean();

    if (!order) {
      const stillExists = await Order.exists({ _id: mongoId });
      if (stillExists) {
        return res.status(409).json({
          message: "A payment was recorded for this order while you were editing. Reload and try again.",
        });
      }
      return res.status(404).json({ message: "Order not found after update." });
    }

    logger.info({ orderId: String(order._id), orderCode: order.orderCode, status: order.status }, "[AdminUpdateOrder] order updated");

    await syncOrderToGoogleSheets(order);

    return res.status(200).json({
      order: mapOrderForApi(order),
      message: "Order updated successfully.",
    });
  } catch (error) {
    if (isClientDbError(error)) {
      return res.status(400).json({ message: error.message });
    }
    logger.error({ err: error.message }, "[AdminUpdateOrder] failed");
    return res.status(500).json({ message: "Failed to update order." });
  }
}

// ============================================
// ADMIN APPROVE ORDER
// ============================================
async function approveOrder(req, res) {
  const { id } = req.params;

  try {
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (order.status !== "pending") {
      return res.status(400).json({ message: "Only pending orders can be approved." });
    }

    order.status = "approved";
    order.approvedAt = new Date();
    order.approvedBy = req.user._id;

    if (order.priceUSD && order.priceUSD > 0) {
      if (order.exchangeRate && order.exchangeRate > 0) {
        order.priceVND = Math.round(order.priceUSD * order.exchangeRate);
        order.totalVND = order.priceVND;
        order.totalUSD = order.priceUSD;
      }
    }
    applyDerivedPaymentFields(order);

    await order.save();
    logger.info(
      { orderId: String(order._id), orderCode: order.orderCode, approvedBy: String(req.user._id) },
      "[ApproveOrder] order approved"
    );

    await syncOrderToGoogleSheets(order);

    return res.status(200).json({
      order: mapOrderForApi(order),
      message: "Order approved successfully.",
    });
  } catch (err) {
    if (isClientDbError(err)) return res.status(400).json({ message: "Invalid order id." });
    logger.error({ err: err.message }, "[ApproveOrder] failed");
    return res.status(500).json({ message: "Failed to approve order." });
  }
}

// ============================================
// RECALCULATE VND PRICE
// ============================================
async function recalculateVND(req, res) {
  const { id } = req.params;

  try {
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (!order.priceUSD || order.priceUSD <= 0) {
      return res.status(400).json({ message: "Order has no USD price to calculate." });
    }

    if (!order.exchangeRate || order.exchangeRate <= 0) {
      return res.status(400).json({ message: "Order has no exchange rate. Please set exchange rate first." });
    }

    // Use stored exchange rate
    order.priceVND = Math.round(order.priceUSD * order.exchangeRate);
    order.totalVND = order.priceVND;
    order.totalUSD = order.priceUSD;
    applyDerivedPaymentFields(order);

    await order.save();

    logger.info({ orderId: String(order._id), orderCode: order.orderCode, priceVND: order.priceVND }, "[RecalculateVND] recalculated");
    await syncOrderToGoogleSheets(order);

    // Always return the updated order
    return res.status(200).json({
      order: mapOrderForApi(order),
      message: "VND price recalculated successfully.",
    });
  } catch (err) {
    if (isClientDbError(err)) return res.status(400).json({ message: "Invalid order id." });
    logger.error({ err: err.message }, "[RecalculateVND] failed");
    return res.status(500).json({ message: "Failed to recalculate VND." });
  }
}

// ============================================
// LIST ORDERS (filtered by user for non-admins)
// ============================================
async function listOrders(req, res) {
  try {
    const userEmail = req.user.email.toLowerCase().trim();

    // Non-admins see their own orders (by email or userId)
    // Admins can see all or filter by user_id
    let filter = {};

    if (req.user.role !== "admin") {
      filter = {
        $or: [
          { userEmail: userEmail },
          { user: req.user._id }
        ]
      };
    } else if (req.query.user_id) {
      filter = { user: req.query.user_id };
    }

    // Optional status filter
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const orders = await Order.find(filter).sort({ createdAt: -1 }).lean();
    logger.info({ userId: String(req.user._id), role: req.user.role, count: orders.length }, "[ListOrders] fetched");

    return res.status(200).json({
      orders: orders.map(mapOrderForApi),
    });
  } catch (error) {
    logger.error({ err: error.message }, "[ListOrders] failed");
    return res.status(500).json({ message: "Failed to fetch orders" });
  }
}

// ============================================
// GET SINGLE ORDER
// ============================================
async function getOrder(req, res) {
  const { id } = req.params;

  const found = await findOrderByIdentifier(id);
  if (!found) {
    return res.status(404).json({ message: "Order not found." });
  }

  const order = found.toObject ? found.toObject() : found;

  // Non-admins can only view their own orders — matched by account id or
  // by email (admin-created orders belong to the admin account but are
  // addressed to the customer's email, which is how getMyOrders finds them).
  if (req.user.role !== "admin" && !isOrderOwner(order, req.user)) {
    return res.status(403).json({ message: "Access denied." });
  }

  return res.status(200).json({ order: mapOrderForApi(order) });
}

// ============================================
// TRACKING BY orderCode (AUTHENTICATION REQUIRED)
// ============================================
async function trackOrder(req, res) {
  const userEmail = req.user.email.toLowerCase().trim();
  const isAdmin = req.user.role === "admin";

  const { code } = req.query || {};
  const searchCode = code || req.query.trackingId;

  if (!searchCode) {
    return res.status(400).json({ message: "Tracking code is required." });
  }

  const trimmed = String(searchCode).trim();
  const or = [
    { orderCode: trimmed },
    { tracking_code: trimmed },
    { trackingId: trimmed },
  ];
  if (mongoose.isValidObjectId(trimmed)) {
    or.push({ _id: trimmed });
  }

  // Build query - admin can find any order, users only see their own
  const query = { $or: or };

  // Non-admin users must match their userEmail or user ID (order isolation)
  if (!isAdmin) {
    query.$and = [
      {
        $or: [
          { userEmail: userEmail },
          { user: req.user._id },
        ],
      },
    ];
  }

  const order = await Order.findOne(query).lean();

  if (!order) {
    logger.info({ userId: String(req.user._id) }, "[TrackOrder] not found");
    return res.status(404).json({ message: "Order not found." });
  }

  logger.info({ orderId: String(order._id), userId: String(req.user._id), isAdmin }, "[TrackOrder] found");

  const timeline = buildTimeline(order);
  const mapped = mapOrderForApi(order);

  return res.status(200).json({
    order: {
      ...mapped,
      timeline,
    },
  });
}

// ============================================
// SEARCH ORDERS (by orderCode OR customerName)
// ============================================
async function searchOrders(req, res) {
  try {
    const userEmail = req.user.email.toLowerCase().trim();
    const isAdmin = req.user.role === "admin";
    const keyword = String(req.query.q || "").trim().slice(0, 100);

    if (!keyword || keyword.length < 1) {
      return res.status(200).json([]);
    }

    // Escaped: a raw user string as $regex allows ReDoS / pattern injection.
    const pattern = escapeRegex(keyword);
    const query = {
      $or: [
        { orderCode: { $regex: pattern, $options: "i" } },
        { customerName: { $regex: pattern, $options: "i" } },
      ],
    };

    // Non-admin users must match their userEmail (order isolation)
    if (!isAdmin) {
      query.$and = [{ userEmail: userEmail }];
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const mapped = orders.map(mapOrderForApi);

    logger.info({ userId: String(req.user._id), count: mapped.length }, "[SearchOrders] results");

    return res.status(200).json(mapped);
  } catch (error) {
    logger.error({ err: error.message }, "[SearchOrders] failed");
    return res.status(500).json({ message: "Search failed." });
  }
}

// ============================================
// DELETE ORDER
// ============================================
async function deleteOrder(req, res) {
  try {
    const { id } = req.params;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    // Sheet errors are logged inside and never block DB deletion
    await sheets.deleteOrderRow(order);

    // Unlink any payments associated with this order so they are not orphaned
    const Payment = require("../models/Payment");
    await Payment.updateMany(
      { order: order._id },
      { $set: { status: "unmatched", order: null, orderCode: null } }
    );

    // Delete from database
    await Order.findByIdAndDelete(id);
    logger.info({ orderId: id }, "[DeleteOrder] deleted");

    return res.status(200).json({ message: "Order deleted successfully." });
  } catch (error) {
    logger.error({ err: error.message }, "[DeleteOrder] failed");
    if (isClientDbError(error)) {
      return res.status(400).json({ message: "Invalid order id." });
    }
    return res.status(500).json({ message: "Delete failed." });
  }
}

module.exports = {
  createOrder,
  getMyOrders,
  adminCreateOrder,
  adminUpdateOrder,
  deleteOrder,
  approveOrder,
  recalculateVND,
  listOrders,
  getOrder,
  trackOrder,
  searchOrders,
};
