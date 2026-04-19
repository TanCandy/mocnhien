const crypto = require("crypto");
const { calculateQuote } = require("../utils/quoteCalculator");
const Order = require("../models/Order");
const { getExchangeRate, parseUSD, formatVND, formatUSD, calculateVND } = require("../services/exchangeRateService");

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

  const events = [
    {
      status: "Order Placed",
      location: `${order.addressFrom || order.origin || order.address || "Origin Hub"}`,
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
      location: order.addressTo || order.destination || order.address || "Destination",
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
  const priceVND = order.totalVND || order.priceVND || 0;
  const exchangeRate = order.exchangeRate || 0;

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

  return {
    id: order.orderCode || order.tracking_code || order.trackingId || order._id.toString(),
    _id: order._id,
    orderCode: order.orderCode,
    trackingId: order.tracking_code || order.trackingId,
    userId: order.user?._id?.toString() || order.user?.toString(),
    status: order.status,
    paymentStatus: order.paymentStatus,
    date: formatDate(orderDate),
    origin: order.addressFrom || order.origin || "",
    destination: order.addressTo || order.destination || order.address || "",
    addressFrom: order.addressFrom || order.origin || "",
    addressTo: order.addressTo || order.destination || order.address || "",
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
    customerEmail: order.customerEmail,
    productLink: order.productLink,
    uspsTracking: order.uspsTracking,
    priceUSD: priceUSD,
    priceVND: priceVND,
    exchangeRate: exchangeRate,
    priceVNDFormatted: formatVND(priceVND),
    priceUSDFormatted: formatUSD(priceUSD),
    totalUSD: priceUSD,
    totalVND: priceVND,
    paymentStatus: order.paymentStatus,
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
      addressFrom,
      addressTo,
      priceUSD,
    } = req.body || {};

    // Validation
    if (!productType || !productName || !addressFrom || !addressTo) {
      return res.status(400).json({ message: "Please fill all required fields." });
    }

    // Generate order code
    const orderCode = generateOrderCode();

    // Parse price and calculate VND using real-time exchange rate
    let priceUSDValue = 0;
    let priceVNDValue = 0;
    let exchangeRateValue = 0;

    if (priceUSD && parseFloat(priceUSD) > 0) {
      priceUSDValue = parseFloat(priceUSD);
      const result = await calculateVND(priceUSDValue);
      priceVNDValue = result.priceVND;
      exchangeRateValue = result.exchangeRate;
      console.log(`[CreateOrder] Price conversion: $${priceUSDValue} × ${exchangeRateValue} = ${priceVNDValue} VND`);
    }

    const order = await Order.create({
      user: userId,
      userEmail, // User email for order isolation
      orderCode,
      productType: String(productType).trim(),
      productName: String(productName).trim(),
      productLink: productLink ? String(productLink).trim() : "",
      addressFrom: String(addressFrom).trim(),
      addressTo: String(addressTo).trim(),
      // Auto-fill customer info from logged-in user
      customerName: userName,
      customerEmail: userEmail,
      // Pricing
      priceUSD: priceUSDValue,
      priceVND: priceVNDValue,
      exchangeRate: exchangeRateValue,
      totalUSD: priceUSDValue,
      totalVND: priceVNDValue,
      status: "pending",
      paymentStatus: "pending",
    });

    console.log(`[CreateOrder] User ${userEmail} created order ${orderCode}`);

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

    // Query by customerEmail (the email field in orders)
    // Also check userEmail field for new orders
    const orders = await Order.find({
      $or: [
        { customerEmail: userEmail },
        { userEmail: userEmail }
      ]
    })
      .sort({ createdAt: -1 })
      .lean();

    console.log(`[GetMyOrders] Found ${orders.length} orders for ${userEmail}`);
    if (orders.length > 0) {
      console.log(`[GetMyOrders] Sample emails in DB:`, orders.slice(0, 3).map(o => o.customerEmail || o.userEmail));
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
    address,
    addressFrom,
    addressTo,
    total_price,
    order_date,
    sold_by,
    status,
    user_id,
    customerName,
    customerEmail,
    productLink,
    uspsTracking,
    priceUSD,
  } = req.body || {};

  // Validation - support both new and legacy field names
  const finalProductName = productName || product_name;
  const finalAddress = address || addressTo || addressFrom;
  const finalAddressFrom = addressFrom || "";
  const finalAddressTo = addressTo || "";

  if (!finalProductName) {
    return res.status(400).json({ message: "productName is required." });
  }
  if (!finalAddress) {
    return res.status(400).json({ message: "address is required." });
  }
  if (!customerName) {
    return res.status(400).json({ message: "customerName is required." });
  }
  if (!customerEmail) {
    return res.status(400).json({ message: "customerEmail is required." });
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

  // Parse priceUSD (remove commas)
  const parsedPriceUSD = parseUSD(priceUSD);

  // Fetch exchange rate and calculate VND price
  let exchangeRate = 0;
  let priceVND = 0;
  
  if (parsedPriceUSD > 0) {
    try {
      exchangeRate = await getExchangeRate();
      priceVND = Math.round(parsedPriceUSD * exchangeRate);
      console.log(`[AdminCreateOrder] Price conversion: $${parsedPriceUSD} × ${exchangeRate} = ${priceVND} VND`);
    } catch (err) {
      console.warn("[AdminCreateOrder] Failed to fetch exchange rate:", err.message);
    }
  }

  const orderData = {
    trackingId: finalTrackingCode,
    tracking_code: finalTrackingCode,
    product_name: String(finalProductName).trim(),
    productName: String(finalProductName).trim(),
    productType: productType || "",
    address: String(finalAddress).trim(),
    addressFrom: finalAddressFrom ? String(finalAddressFrom).trim() : "",
    addressTo: finalAddressTo ? String(finalAddressTo).trim() : "",
    origin: finalAddressFrom ? String(finalAddressFrom).trim() : "",
    destination: finalAddressTo ? String(finalAddressTo).trim() : "",
    total_price: total_price !== undefined ? Number(total_price) : 0,
    order_date: order_date ? new Date(order_date) : new Date(),
    sold_by: sold_by ? String(sold_by).trim() : "",
    status: status || "pending",
    customerName: String(customerName).trim(),
    customerEmail: String(customerEmail).trim().toLowerCase(),
    userEmail: String(customerEmail).trim().toLowerCase(), // For order isolation
    productLink: productLink ? String(productLink).trim() : "",
    uspsTracking: uspsTracking ? String(uspsTracking).trim() : "",
    priceUSD: parsedPriceUSD,
    priceVND: priceVND,
    totalUSD: parsedPriceUSD,
    totalVND: priceVND,
    exchangeRate: exchangeRate,
  };

  // If user_id provided, use it; otherwise use admin's id (for self-orders)
  if (user_id) {
    orderData.user = user_id;
  } else {
    orderData.user = req.user._id;
  }

  console.log("[AdminCreateOrder] Creating order:", orderData);

  const order = await Order.create(orderData);

  return res.status(201).json({
    order: mapOrderForApi(order),
    message: "Order created successfully.",
  });
}

// ============================================
// ADMIN UPDATE ORDER
// ============================================
async function adminUpdateOrder(req, res) {
  const { id } = req.params;
  console.log("[AdminUpdateOrder] Request params:", req.params);
  console.log("[AdminUpdateOrder] Request body:", req.body);

  const {
    tracking_code,
    product_name,
    address,
    addressFrom,
    addressTo,
    total_price,
    order_date,
    sold_by,
    status,
    paymentStatus,
    paymentPercent,
    user_id,
    customerName,
    customerEmail,
    productLink,
    productType,
    productName,
    uspsTracking,
    priceUSD,
    totalUSD,
    totalVND,
    exchangeRate,
  } = req.body || {};

  // Get current order to access priceVND for payment calculation
  const currentOrder = await Order.findById(id);
  if (!currentOrder) {
    return res.status(404).json({ message: "Order not found." });
  }

  const updateData = {};

  // Tracking code
  if (tracking_code !== undefined) {
    const existing = await Order.findOne({
      _id: { $ne: id },
      $or: [
        { tracking_code: String(tracking_code).trim() },
        { trackingId: String(tracking_code).trim() }
      ]
    });
    if (existing) {
      return res.status(409).json({ message: "Tracking code already exists." });
    }
    updateData.tracking_code = String(tracking_code).trim();
    updateData.trackingId = String(tracking_code).trim();
  }

  // Product fields
  if (product_name !== undefined) updateData.product_name = String(product_name).trim();
  if (productName !== undefined) updateData.productName = String(productName).trim();
  if (productType !== undefined) updateData.productType = String(productType).trim();

  // Address fields
  if (address !== undefined) updateData.address = String(address).trim();
  if (addressFrom !== undefined) updateData.addressFrom = String(addressFrom).trim();
  if (addressTo !== undefined) updateData.addressTo = String(addressTo).trim();

  // Order metadata
  if (total_price !== undefined) updateData.total_price = Number(total_price);
  if (order_date !== undefined) updateData.order_date = new Date(order_date);
  if (sold_by !== undefined) updateData.sold_by = String(sold_by).trim();
  if (customerName !== undefined) updateData.customerName = String(customerName).trim();
  if (customerEmail !== undefined) {
    updateData.customerEmail = String(customerEmail).trim().toLowerCase();
    updateData.userEmail = String(customerEmail).trim().toLowerCase(); // Sync userEmail for order isolation
  }
  if (productLink !== undefined) updateData.productLink = String(productLink).trim();
  if (uspsTracking !== undefined) updateData.uspsTracking = String(uspsTracking).trim();
  if (user_id !== undefined) updateData.user = user_id;

  // Price update with conversion
  let currentPriceVND = currentOrder.priceVND || 0;
  if (priceUSD !== undefined) {
    const parsedPriceUSD = parseUSD(priceUSD);
    updateData.priceUSD = parsedPriceUSD;
    updateData.totalUSD = parsedPriceUSD;
    
    if (parsedPriceUSD > 0) {
      try {
        const rate = await getExchangeRate();
        updateData.exchangeRate = rate;
        updateData.priceVND = Math.round(parsedPriceUSD * rate);
        updateData.totalVND = Math.round(parsedPriceUSD * rate);
        currentPriceVND = updateData.priceVND;
      } catch (err) {
        console.warn("[AdminUpdateOrder] Failed to fetch exchange rate:", err.message);
      }
    } else {
      updateData.priceVND = 0;
      updateData.totalVND = 0;
      updateData.exchangeRate = 0;
      currentPriceVND = 0;
    }
  }

  // Direct VND update
  if (totalVND !== undefined) {
    updateData.totalVND = Number(totalVND);
    updateData.priceVND = Number(totalVND);
    currentPriceVND = Number(totalVND);
  }
  if (exchangeRate !== undefined) {
    updateData.exchangeRate = Number(exchangeRate);
  }
  if (totalUSD !== undefined) {
    updateData.totalUSD = Number(totalUSD);
    updateData.priceUSD = Number(totalUSD);
  }

  // ============================================
  // PAYMENT LOGIC - Handle status and payment %
  // ============================================

  // Normalize status to lowercase
  const normalizedStatus = status ? String(status).toLowerCase() : currentOrder.status;

  // Handle status = "delivered" → auto set payment to 100%
  if (normalizedStatus === "delivered") {
    updateData.paymentPercent = 100;
    updateData.paidAmount = currentPriceVND;
    updateData.paymentStatus = "paid";
    updateData.status = "delivered";
    console.log(`[AdminUpdateOrder] Status set to DELIVERED → Payment auto set to 100%`);
  }
  // Handle status = "pending" → allow payment percentage input
  else if (normalizedStatus === "pending") {
    if (paymentPercent !== undefined) {
      const percent = Math.min(100, Math.max(0, Number(paymentPercent) || 0));
      updateData.paymentPercent = percent;
      updateData.paidAmount = Math.round((currentPriceVND * percent) / 100);
      updateData.paymentStatus = percent >= 100 ? "paid" : "pending";
      console.log(`[AdminUpdateOrder] Status PENDING → Payment set to ${percent}% = ${updateData.paidAmount} VND`);
    }
    updateData.status = "pending";
  }
  // Handle other statuses (approved, shipping)
  else {
    // Only update status if provided
    if (status !== undefined) {
      if (!["pending", "approved", "shipping", "delivered"].includes(normalizedStatus)) {
        return res.status(400).json({ message: "Invalid status. Must be pending, approved, shipping, or delivered." });
      }
      updateData.status = normalizedStatus;
    }
    // Payment status can still be manually updated
    if (paymentStatus !== undefined) {
      if (!["pending", "paid"].includes(paymentStatus)) {
        return res.status(400).json({ message: "Invalid paymentStatus. Must be pending or paid." });
      }
      updateData.paymentStatus = paymentStatus;
      // If manually set to paid, update percent and paidAmount
      if (paymentStatus === "paid") {
        updateData.paymentPercent = 100;
        updateData.paidAmount = currentPriceVND;
      }
    }
  }

  // Status validation (only if not already handled above)
  if (status !== undefined && normalizedStatus !== "delivered" && normalizedStatus !== "pending") {
    if (!["pending", "approved", "shipping", "delivered"].includes(normalizedStatus)) {
      return res.status(400).json({ message: "Invalid status. Must be pending, approved, shipping, or delivered." });
    }
  }

  console.log("[AdminUpdateOrder] Update data:", updateData);

  const order = await Order.findByIdAndUpdate(id, updateData, { new: true, runValidators: true }).lean();
  if (!order) {
    return res.status(404).json({ message: "Order not found." });
  }

  return res.status(200).json({
    order: mapOrderForApi(order),
    message: "Order updated successfully.",
  });
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

    // Update status to approved
    order.status = "approved";
    order.approvedAt = new Date();
    order.approvedBy = req.user._id;

    // Calculate VND if priceUSD exists but priceVND is missing or 0
    if (order.priceUSD && (!order.priceVND || order.priceVND === 0)) {
      console.log(`[ApproveOrder] Calculating VND for order ${order.orderCode || order._id}`);
      const result = await calculateVND(order.priceUSD);
      order.exchangeRate = result.exchangeRate;
      order.priceVND = result.priceVND;
      order.totalVND = result.priceVND;
      order.totalUSD = order.priceUSD;
      console.log(`[ApproveOrder] Calculated: $${order.priceUSD} × ${result.exchangeRate} = ${result.priceVND} VND`);
    }

    await order.save();

    console.log(`[ApproveOrder] Order ${order.orderCode || order._id} approved by ${req.user.email}`);

    // Always return the updated order
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

    const result = await calculateVND(order.priceUSD);
    order.exchangeRate = result.exchangeRate;
    order.priceVND = result.priceVND;
    order.totalVND = result.priceVND;
    order.totalUSD = order.priceUSD;

    await order.save();

    console.log(`[RecalculateVND] Recalculated: $${order.priceUSD} × ${result.exchangeRate} = ${result.priceVND} VND`);

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
      // Use $or to match either customerEmail, userEmail, or userId
      filter = {
        $or: [
          { customerEmail: userEmail },
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

  const order = await Order.findById(id).lean();
  if (!order) {
    return res.status(404).json({ message: "Order not found." });
  }

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
  // Authentication is required - this is enforced by authMiddleware in routes
  const userEmail = req.user.email.toLowerCase().trim();

  const { code } = req.query || {};

  // Support both 'code' and 'trackingId' query params
  const searchCode = code || req.query.trackingId;

  if (!searchCode) {
    return res.status(400).json({ message: "Tracking code is required." });
  }

  console.log(`[TrackOrder] User "${userEmail}" searching for code: "${searchCode}"`);

  // Search by orderCode, tracking_code, or trackingId AND match customerEmail OR userEmail
  // This ensures users can only see their own orders
  const order = await Order.findOne({
    $and: [
      {
        $or: [
          { customerEmail: userEmail },
          { userEmail: userEmail }
        ]
      },
      {
        $or: [
          { orderCode: String(searchCode).trim() },
          { tracking_code: String(searchCode).trim() },
          { trackingId: String(searchCode).trim() },
        ]
      }
    ]
  }).lean();

  if (!order) {
    console.log(`[TrackOrder] Order "${searchCode}" not found for email "${userEmail}"`);
    // Return 404 to hide existence of other users' orders
    return res.status(404).json({ message: "Order not found." });
  }

  console.log(`[TrackOrder] Found order ${order.orderCode || order.trackingId} with email ${order.customerEmail || order.userEmail}`);

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
// GET EXCHANGE RATE
// ============================================
async function getCurrentExchangeRate(req, res) {
  try {
    const rate = await getExchangeRate();
    return res.status(200).json({
      rate,
      currency: "VND",
      base: "USD",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[GetExchangeRate] Error:", error);
    return res.status(500).json({ message: "Failed to fetch exchange rate" });
  }
}

module.exports = {
  createOrder,
  getMyOrders,
  adminCreateOrder,
  adminUpdateOrder,
  approveOrder,
  recalculateVND,
  listOrders,
  getOrder,
  trackOrder,
  getCurrentExchangeRate,
};
