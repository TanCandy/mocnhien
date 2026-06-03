const mongoose = require("mongoose");

const statusValues = ["pending", "approved", "shipping", "delivered"];
const paymentStatusValues = ["pending", "paid"];
const contactTypeValues = ["email", "phone", "none"];

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

    // Warehouse address
    warehouseAddress: { type: String, default: "", trim: true },
    // Staff entering this order
    staffName: { type: String, default: "", trim: true },

    // Legacy consolidated address kept for backward compatibility
    address: { type: String, trim: true },

    // Customer info
    customerName: { type: String, required: true, trim: true },

    // Flexible contact — replaces customerEmail
    contactType: {
      type: String,
      enum: contactTypeValues,
      default: "email",
    },
    contactValue: { type: String, default: "", trim: true },

    // Status
    status: {
      type: String,
      required: true,
      enum: statusValues,
      default: "pending",
    },

    // Payment status
    paymentStatus: {
      type: String,
      enum: paymentStatusValues,
      default: "pending",
    },

    // Payment tracking (partial payments)
    paymentPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    paidAmount: {
      type: Number,
      default: 0,
    },
    remainingAmount: {
      type: Number,
      default: 0,
    },

    // Pricing — exchangeRate is user-provided (not from external API)
    priceUSD: { type: Number, default: 0 },
    priceVND: { type: Number, default: 0 },
    exchangeRate: { type: Number, default: 0 },
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

    // Legacy tracking ID
    trackingId: { type: String, unique: true, sparse: true, index: true },
    tracking_code: { type: String, trim: true },

    // Legacy fields
    origin: { type: String, trim: true },
    destination: { type: String, trim: true },
    product_name: { type: String, trim: true },
    total_price: { type: Number, default: 0 },
    weightKg: { type: Number },
    serviceTier: { type: String },
    packageCategory: { type: String },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } }
);

orderSchema.virtual("displayId").get(function () {
  return this.orderCode || this.tracking_code || this.trackingId || this._id.toString();
});

orderSchema.set("toJSON", { virtuals: true });
orderSchema.set("toObject", { virtuals: true });

orderSchema.index({ orderCode: 1, userEmail: 1 });
orderSchema.index({ userEmail: 1, createdAt: -1 });

module.exports = mongoose.model("Order", orderSchema);
