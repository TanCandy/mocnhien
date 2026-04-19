const mongoose = require("mongoose");

const statusValues = ["pending", "approved", "shipping", "delivered"];
const paymentStatusValues = ["pending", "paid"];

const orderSchema = new mongoose.Schema(
  {
    // Order identification
    orderCode: { type: String, unique: true, sparse: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    // User email for order isolation (required for tracking)
    userEmail: { type: String, required: true, lowercase: true, trim: true, index: true },

    // Product info
    productType: { type: String, required: true, trim: true },
    productName: { type: String, required: true, trim: true },
    productLink: { type: String, trim: true },

    // Address info
    addressFrom: { type: String, required: true, trim: true },
    addressTo: { type: String, required: true, trim: true },

    // Customer info (auto-filled from user)
    customerName: { type: String, required: true, trim: true },
    customerEmail: { type: String, required: true, lowercase: true, trim: true },

    // Status
    status: {
      type: String,
      required: true,
      enum: statusValues,
      default: "pending"
    },

    // Payment status
    paymentStatus: {
      type: String,
      enum: paymentStatusValues,
      default: "pending"
    },

    // Payment tracking (partial payments)
    paymentPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    paidAmount: {
      type: Number,
      default: 0
    },

    // Pricing (set by admin)
    priceUSD: { type: Number, default: 0 },
    priceVND: { type: Number, default: 0 },
    exchangeRate: { type: Number, default: 0 },
    // Legacy aliases
    totalUSD: { type: Number, default: 0 },
    totalVND: { type: Number, default: 0 },

    // Tracking
    uspsTracking: { type: String, trim: true },

    // Order metadata (set by admin)
    order_date: { type: Date, default: Date.now },
    sold_by: { type: String, trim: true },

    // Admin approval tracking
    approvedAt: { type: Date },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    // Legacy tracking ID (for backward compatibility)
    trackingId: { type: String, unique: true, sparse: true, index: true },
    tracking_code: { type: String, trim: true },

    // Legacy address field (for backward compatibility with admin orders)
    address: { type: String, trim: true },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } }
);

// Virtual for display tracking code (priority: orderCode > tracking_code > trackingId > _id)
orderSchema.virtual("displayId").get(function () {
  return this.orderCode || this.tracking_code || this.trackingId || this._id.toString();
});

// Ensure virtuals are included in JSON output
orderSchema.set("toJSON", { virtuals: true });
orderSchema.set("toObject", { virtuals: true });

// Index for efficient tracking queries
orderSchema.index({ orderCode: 1, userEmail: 1 });

// Index for user orders
orderSchema.index({ userEmail: 1, createdAt: -1 });

module.exports = mongoose.model("Order", orderSchema);
