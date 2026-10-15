const express = require("express");
const { authMiddleware } = require("../middleware/authMiddleware");
const { roleMiddleware } = require("../middleware/roleMiddleware");
const paymentController = require("../controllers/paymentController");

const router = express.Router();

// Bank webhook (server-to-server, authenticated by API key — not by JWT)
router.post("/webhook/sepay", paymentController.sepayWebhook);

// Customer / admin: how to pay an order (bank details + dynamic VietQR)
router.get("/orders/:id", authMiddleware, paymentController.getOrderPaymentInfo);

// Admin: incoming transfers + manual assignment of unmatched ones
router.get("/", authMiddleware, roleMiddleware("admin"), paymentController.listPayments);
router.post("/:id/assign", authMiddleware, roleMiddleware("admin"), paymentController.assignPayment);

module.exports = router;
