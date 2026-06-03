const express = require("express");
const { authMiddleware } = require("../middleware/authMiddleware");
const { roleMiddleware } = require("../middleware/roleMiddleware");
const orderController = require("../controllers/orderController");

const router = express.Router();

// ============================================
// AUTHENTICATED ROUTES (User must be logged in)
// ============================================

// Track order by code (AUTHENTICATION REQUIRED)
// Users can only track orders that belong to their email
router.get("/track", authMiddleware, orderController.trackOrder);

// Search orders by orderCode or customerName (AUTHENTICATED)
router.get("/search", authMiddleware, orderController.searchOrders);

// Get my orders (authenticated user's orders by email)
router.get("/my-orders", authMiddleware, orderController.getMyOrders);

// Create new order (authenticated user)
router.post("/", authMiddleware, orderController.createOrder);

// Get user's orders (fallback, filtered by user ID)
router.get("/", authMiddleware, orderController.listOrders);

// Get single order
router.get("/:id", authMiddleware, orderController.getOrder);

// ============================================
// ADMIN ROUTES (Requires admin role)
// ============================================

// Admin create order
router.post("/admin", authMiddleware, roleMiddleware("admin"), orderController.adminCreateOrder);

// Admin update order
router.put("/:id", authMiddleware, roleMiddleware("admin"), orderController.adminUpdateOrder);

// Admin delete order
router.delete("/:id", authMiddleware, roleMiddleware("admin"), orderController.deleteOrder);

// Admin approve order
router.put("/:id/approve", authMiddleware, roleMiddleware("admin"), orderController.approveOrder);

// Admin recalculate VND price
router.post("/:id/recalculate", authMiddleware, roleMiddleware("admin"), orderController.recalculateVND);

module.exports = router;
