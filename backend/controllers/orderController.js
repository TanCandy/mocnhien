const crypto = require("crypto");
const mongoose = require("mongoose");
const { calculateQuote } = require("../utils/quoteCalculator");
const Order = require("../models/Order");
const { parseUSD, formatVND, formatUSD } = require("../services/exchangeRateService");

const WEBHOOK_URL =
  "https://script.google.com/macros/s/AKfycbypPB4voV6Ko1QAUKmsanqnBTnGQs_9yNeidZ1MqiMm94EVCzpNrJkSnHzOXVjiGGao/exec";

async function syncOrderToGoogleSheets(order) {
  // CRITICAL: orderCode MUST exist — skip sync (not throw) so DB write is never blocked
  if (!order.orderCode) {
    console.error("❌ Missing orderCode, skipping sync. Order:", JSON.stringify(order));
    return;
  }

  const orderId = order._id ? String(order._id) : "";
  const payload = {
    date:            new Date(order.createdAt).toLocaleDateString("vi-VN"),
    orderCode:       order.orderCode || "",
    orderId:         orderId,
    staffName:       order.staffName ?? "",
    productName:     order.productName || "",
    productLink:     order.productLink || "",
    warehouse:       order.warehouseAddress || "",
    customerName:    order.customerName || "",
    contactType:     order.contactType || "",
    contactValue:    order.contactValue || "",
    usd:             order.priceUSD ?? 0,
    exchangeRate:    order.exchangeRate ?? 0,
    vnd:             order.priceVND ?? 0,
    paidAmount:      order.paidAmount ?? 0,
    paymentPercentage: order.paymentPercent ?? 0,
    remainingAmount:   order.remainingAmount ?? 0,
    status:         order.status || "",
    trackingNumber: order.uspsTracking || "",
    createdAt:       order.createdAt ? new Date(order.createdAt).toISOString() : "",
    updatedAt:       order.updatedAt ? new Date(order.updatedAt).toISOString() : "",
  };

  console.log(
    "Sending order:",
    payload.orderCode,
    "paidAmount=" + payload.paidAmount,
    "remainingAmount=" + payload.remainingAmount,
    "paymentPercent=" + payload.paymentPercentage,
    "vnd=" + payload.vnd
  );

  try {
    const res = await fetch(WEBHOOK_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });
    const text = await res.text();
    console.log(`[SheetsWebhook] ✓ synced orderCode=${payload.orderCode}  orderId=${payload.orderId}  status=${res.status}  body=${text}`);
  } catch (err) {
    console.error(`[SheetsWebhook] ✗ failed for orderCode=${payload.orderCode}  orderId=${payload.orderId}:`, err.message);
  }
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
    return { contactType: "email", contactValue: cv.toLowerCase().trim() };
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
  const priceUSD = order.totalUSD || order.priceUSD || order.total_price || 0;
  const exchangeRate = order.exchangeRate || 0;
  
  // ALWAYS recalculate VND from USD to avoid stale values
  const priceVND = exchangeRate > 0 ? Math.round(priceUSD * exchangeRate) : (order.totalVND || order.priceVND || 0);

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
    paymentStatus: order.paymentStatus,
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
    paymentStatus: order.paymentStatus,
    paymentPercent: order.paymentPercent ?? 0,
    paidAmount:     order.paidAmount     ?? 0,
    remainingAmount: order.remainingAmount ?? (priceVND - (order.paidAmount ?? 0)),
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

    const exchangeRateValue = exchangeRate ? parseFloat(exchangeRate) : 0;
    // Exchange rate is only required when a USD price is also provided
    const parsedPrice = parseFloat(priceUSD) || 0;
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

    if (priceUSD && parseFloat(priceUSD) > 0) {
      priceUSDValue = parseFloat(priceUSD);
      if (exchangeRateValue > 0) {
        priceVNDValue = Math.round(priceUSDValue * exchangeRateValue);
        console.log(`[CreateOrder] Price conversion: $${priceUSDValue} × ${exchangeRateValue} = ${priceVNDValue} VND`);
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

    console.log(`[CreateOrder] User ${userEmail} created order ${orderCode}`);
    console.log("ORDER BEFORE SYNC:", JSON.stringify({
      orderCode: order.orderCode,
      paidAmount: order.paidAmount,
      remainingAmount: order.remainingAmount,
      paymentPercent: order.paymentPercent,
      totalVND: order.totalVND,
      status: order.status,
    }));

    await syncOrderToGoogleSheets(order);

    return res.status(201).json({
      order: mapOrderForApi(order),
      message: "Order submitted, waiting for approval",
    });
  } catch (error) {
    console.error("[CreateOrder] Error:", error);
    return res.status(500).json({ message: "Failed to create order" });
  }
}

// ============================================
// GET MY ORDERS (User's own orders by email)
// ============================================
async function getMyOrders(req, res) {
  try {
    const userEmail = req.user.email.toLowerCase().trim();
    console.log(`[GetMyOrders] Fetching orders for: "${userEmail}"`);

    const orders = await Order.find({ userEmail })
      .sort({ createdAt: -1 })
      .lean();

    console.log(`[GetMyOrders] Found ${orders.length} orders for ${userEmail}`);
    if (orders.length > 0) {
      console.log(`[GetMyOrders] Found ${orders.length} order(s) for ${userEmail}`);
    }

    return res.status(200).json({
      orders: orders.map(mapOrderForApi),
      count: orders.length,
    });
  } catch (error) {
    console.error("[GetMyOrders] Error:", error);
    return res.status(500).json({ message: "Failed to fetch your orders" });
  }
}

// ============================================
// ADMIN CREATE ORDER (Legacy with price)
// ============================================
async function adminCreateOrder(req, res) {
  console.log("[AdminCreateOrder] Request body:", req.body);

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
  const parsedExchangeRate = exchangeRate ? parseFloat(exchangeRate) : 0;

  // Exchange rate is only required when a USD price is also provided
  if (parsedPriceUSD > 0 && (isNaN(parsedExchangeRate) || parsedExchangeRate <= 0)) {
    return res.status(400).json({ message: "Exchange rate must be greater than 0 when price USD is provided." });
  }

  // Calculate VND price using user-provided exchange rate
  let priceVND = 0;
  if (parsedPriceUSD > 0 && parsedExchangeRate > 0) {
    priceVND = Math.round(parsedPriceUSD * parsedExchangeRate);
    console.log(`[AdminCreateOrder] Price conversion: $${parsedPriceUSD} × ${parsedExchangeRate} = ${priceVND} VND`);
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
    // Payment fields
    paymentPercent:
      paymentPercent !== undefined ? Math.min(100, Math.max(0, Number(paymentPercent) || 0)) : 0,
    paidAmount:
      paidAmount !== undefined
        ? Math.max(0, Number(paidAmount) || 0)
        : (paymentPercent !== undefined
            ? Math.round((Math.min(100, Math.max(0, Number(paymentPercent) || 0)) / 100) * priceVND)
            : 0),
    remainingAmount: 0,
  };

  // If user_id provided, use it; otherwise use admin's id (for self-orders)
  if (user_id) {
    orderData.user = user_id;
  } else {
    orderData.user = req.user._id;
  }

  console.log("CREATE:", JSON.stringify(orderData, null, 2));

  const order = await Order.create(orderData);

  console.log("ORDER BEFORE SYNC:", JSON.stringify({
    orderCode: order.orderCode,
    paidAmount: order.paidAmount,
    remainingAmount: order.remainingAmount,
    paymentPercent: order.paymentPercent,
    totalVND: order.totalVND,
    status: order.status,
  }));

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
    console.log("[AdminUpdateOrder] id:", id);
    console.log("[AdminUpdateOrder] body:", JSON.stringify(req.body, null, 2));

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
      const rate = parseFloat(raw.exchangeRate);
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

    // ── 4. Server-computed price fields ────────────────────────────────────
    const sentPriceUSD    = raw.priceUSD    !== undefined;
    const sentExchangeRate = raw.exchangeRate !== undefined;

    const priceUSD =
      sentPriceUSD ? parseUSD(raw.priceUSD) : (currentOrder.priceUSD || 0);
    const exchangeRate =
      sentExchangeRate ? parseFloat(raw.exchangeRate) : (currentOrder.exchangeRate || 0);

    // Recompute VND when USD or exchange rate changes
    const totalVNDChanged = sentPriceUSD || sentExchangeRate;
    if (priceUSD > 0 && exchangeRate > 0) {
      updateData.priceUSD  = priceUSD;
      updateData.totalUSD  = priceUSD;
      updateData.priceVND  = Math.round(priceUSD * exchangeRate);
      updateData.totalVND  = updateData.priceVND;
    } else if (sentPriceUSD && priceUSD === 0) {
      updateData.priceUSD = 0;
      updateData.totalUSD = 0;
      updateData.priceVND = 0;
      updateData.totalVND = 0;
    }

    // ── 5. Payment fields ──────────────────────────────────────────────────
    const sentPaid    = raw.paidAmount     !== undefined;
    const sentPercent = raw.paymentPercent !== undefined;

    // Trust totalVND from frontend when sent; fall back to server-computed value
    const totalVND =
      raw.totalVND !== undefined
        ? Math.max(0, Number(raw.totalVND) || 0)
        : (updateData.totalVND !== undefined ? updateData.totalVND : (currentOrder.totalVND || currentOrder.priceVND || 0));

    const normalizedStatus = raw.status ? String(raw.status).toLowerCase() : currentOrder.status;

    if (normalizedStatus === "delivered") {
      updateData.status         = "delivered";
      updateData.paymentStatus = "paid";
      updateData.paymentPercent = 100;
      updateData.paidAmount     = totalVND;
      updateData.remainingAmount = 0;
    } else if (normalizedStatus === "pending") {
      updateData.status = "pending";

      if (sentPaid && !sentPercent) {
        const paid = Math.max(0, Math.min(totalVND, Number(raw.paidAmount) || 0));
        updateData.paidAmount     = paid;
        updateData.paymentPercent = totalVND > 0 ? Math.round((paid / totalVND) * 100) : 0;
      } else if (sentPercent && !sentPaid) {
        const pct = Math.min(100, Math.max(0, Number(raw.paymentPercent) || 0));
        updateData.paymentPercent = pct;
        updateData.paidAmount     = Math.round((pct / 100) * totalVND);
      } else if (sentPaid && sentPercent) {
        const paid = Math.max(0, Math.min(totalVND, Number(raw.paidAmount) || 0));
        const pct  = Math.min(100, Math.max(0, Number(raw.paymentPercent) || 0));
        updateData.paidAmount     = paid;
        updateData.paymentPercent = pct;
      }
      // If neither paidAmount nor percent sent — preserve existing DB values

      // Always recalculate remainingAmount from current paidAmount and totalVND
      const finalPaid =
        updateData.paidAmount !== undefined
          ? updateData.paidAmount
          : (currentOrder.paidAmount || 0);
      updateData.remainingAmount = Math.max(0, totalVND - finalPaid);

      const finalPct =
        updateData.paymentPercent !== undefined
          ? updateData.paymentPercent
          : (currentOrder.paymentPercent || 0);
      updateData.paymentStatus = finalPct >= 100 ? "paid" : "pending";

      // Debug: log payment state before saving
      console.log(
        `[AdminUpdateOrder] payment → totalVND=${totalVND}  paidAmount=${updateData.paidAmount}  ` +
        `paymentPercent=${updateData.paymentPercent}  remainingAmount=${updateData.remainingAmount}`
      );
    } else if (["approved", "shipping"].includes(normalizedStatus)) {
      updateData.status = normalizedStatus;
    }

    // ── 6. Strip mongo-only fields ─────────────────────────────────────────
    delete updateData._id;
    delete updateData.__v;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    console.log("[AdminUpdateOrder] Final updateData:", JSON.stringify(updateData, null, 2));

    // ── 7. Persist to DB ───────────────────────────────────────────────────
    const order = await Order.findByIdAndUpdate(
      mongoId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).lean();

    if (!order) {
      return res.status(404).json({ message: "Order not found after update." });
    }

    console.log(
      `[AdminUpdateOrder] ✓ Saved _id=${order._id}  staffName="${order.staffName}"  ` +
      `contactType="${order.contactType}"  contactValue="${order.contactValue}"  ` +
      `warehouseAddress="${order.warehouseAddress}"  exchangeRate=${order.exchangeRate}`
    );

    console.log("UPDATE:", JSON.stringify({
      orderCode: order.orderCode,
      paidAmount: order.paidAmount,
      remainingAmount: order.remainingAmount,
      paymentPercent: order.paymentPercent,
      totalVND: order.totalVND,
      status: order.status,
    }));

    await syncOrderToGoogleSheets(order);

    return res.status(200).json({
      order: mapOrderForApi(order),
      message: "Order updated successfully.",
    });
  } catch (error) {
    console.error("[AdminUpdateOrder] Error:", error);
    return res.status(500).json({ message: error.message || "Failed to update order." });
  }
}

// ============================================
// ADMIN APPROVE ORDER
// ============================================
async function approveOrder(req, res) {
  const { id } = req.params;
  console.log("[ApproveOrder] Approving order:", id);

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
      console.log(`[ApproveOrder] Calculating VND for order ${order.orderCode || order._id}`);
      if (order.exchangeRate && order.exchangeRate > 0) {
        order.priceVND = Math.round(order.priceUSD * order.exchangeRate);
        order.totalVND = order.priceVND;
        order.totalUSD = order.priceUSD;
        console.log(`[ApproveOrder] Calculated: $${order.priceUSD} × ${order.exchangeRate} = ${order.priceVND} VND`);
      }
    }

    await order.save();
    console.log(`[ApproveOrder] Order ${order.orderCode || order._id} approved by ${req.user.email}`);
    console.log("ORDER BEFORE SYNC:", JSON.stringify({
      orderCode: order.orderCode,
      paidAmount: order.paidAmount,
      remainingAmount: order.remainingAmount,
      paymentPercent: order.paymentPercent,
      totalVND: order.totalVND,
      status: order.status,
    }));

    await syncOrderToGoogleSheets(order);

    return res.status(200).json({
      order: mapOrderForApi(order),
      message: "Order approved successfully.",
    });
  } catch (err) {
    console.error("[ApproveOrder] Error:", err);
    return res.status(500).json({ message: "Failed to approve order: " + err.message });
  }
}

// ============================================
// RECALCULATE VND PRICE
// ============================================
async function recalculateVND(req, res) {
  const { id } = req.params;
  console.log("[RecalculateVND] Recalculating VND for order:", id);

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

    await order.save();

    console.log(`[RecalculateVND] Recalculated: $${order.priceUSD} × ${order.exchangeRate} = ${order.priceVND} VND`);

    // Always return the updated order
    return res.status(200).json({
      order: mapOrderForApi(order),
      message: "VND price recalculated successfully.",
    });
  } catch (err) {
    console.error("[RecalculateVND] Error:", err);
    return res.status(500).json({ message: "Failed to recalculate VND: " + err.message });
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

    console.log(`[ListOrders] User ${userEmail} (role: ${req.user.role}) querying orders with filter:`, JSON.stringify(filter));

    const orders = await Order.find(filter).sort({ createdAt: -1 }).lean();
    console.log(`[ListOrders] Found ${orders.length} orders`);

    return res.status(200).json({
      orders: orders.map(mapOrderForApi),
    });
  } catch (error) {
    console.error("[ListOrders] Error:", error);
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

  // Non-admins can only view their own orders
  if (req.user.role !== "admin" && order.user.toString() !== req.user._id.toString()) {
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

  console.log(`[TrackOrder] User "${userEmail}" (${req.user.role}) searching for code: "${searchCode}"`);

  // Build query - admin can find any order, users only see their own
  const query = {
    $or: [
      { orderCode: String(searchCode).trim() },
      { tracking_code: String(searchCode).trim() },
      { trackingId: String(searchCode).trim() },
    ]
  };

  // Non-admin users must match their userEmail (order isolation)
  if (!isAdmin) {
    query.$and = [{ userEmail: userEmail }];
  }

  const order = await Order.findOne(query).lean();

  if (!order) {
    console.log(`[TrackOrder] Order "${searchCode}" not found for user "${userEmail}"`);
    return res.status(404).json({ message: "Order not found." });
  }

  console.log(`[TrackOrder] Found order ${order.orderCode || order.trackingId} for ${isAdmin ? "admin" : "user"}`);

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
    const keyword = (req.query.q || "").trim();

    if (!keyword || keyword.length < 1) {
      return res.status(200).json([]);
    }

    console.log(`[SearchOrders] User "${userEmail}" (${req.user.role}) searching: "${keyword}"`);

    const query = {
      $or: [
        { orderCode: { $regex: keyword, $options: "i" } },
        { customerName: { $regex: keyword, $options: "i" } },
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

    console.log(`[SearchOrders] Found ${mapped.length} results for "${keyword}"`);

    return res.status(200).json(mapped);
  } catch (error) {
    console.error("[SearchOrders] Error:", error);
    return res.status(500).json({ message: "Search failed." });
  }
}

// ============================================
// DELETE ORDER
// ============================================
async function deleteOrder(req, res) {
  try {
    const { id } = req.params;
    console.log("[DeleteOrder] Deleting order:", id);

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    // Sync to Google Sheets — tell the sheet to delete the row
    try {
      const webhookPayload = {
        action: "delete",
        orderCode: order.orderCode || "",
        orderId: order._id ? String(order._id) : "",
      };
      console.log("DELETE:", webhookPayload.orderCode);
      const sheetRes = await fetch(WEBHOOK_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(webhookPayload),
      });
      const text = await sheetRes.text();
      console.log(`[DeleteOrder] Sheets response: ${sheetRes.status}  ${text}`);
    } catch (sheetErr) {
      // Sheet errors are logged but must not block DB deletion
      console.error("[DeleteOrder] Sheets sync error:", sheetErr.message);
    }

    // Delete from database
    await Order.findByIdAndDelete(id);
    console.log(`[DeleteOrder] ✓ Deleted order ${id} from DB`);

    return res.status(200).json({ message: "Order deleted successfully." });
  } catch (error) {
    console.error("[DeleteOrder] Error:", error);
    return res.status(500).json({ message: "Delete failed: " + error.message });
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
