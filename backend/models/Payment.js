const mongoose = require("mongoose");

/**
 * One incoming bank transfer, as reported by the payment provider webhook.
 * The (provider, providerTxnId) pair is unique, which is what makes webhook
 * retries idempotent: a duplicate insert fails and the transfer is not
 * applied twice.
 */
const paymentSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true, default: "sepay" },
    providerTxnId: { type: String, required: true },

    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", index: true },
    orderCode: { type: String, index: true },

    amount: { type: Number, required: true },
    content: { type: String, default: "" },
    accountNumber: { type: String, default: "" },
    gateway: { type: String, default: "" },
    referenceCode: { type: String, default: "" },
    transactionDate: { type: Date },

    // matched   — applied to `order`
    // unmatched — no/unknown order code in the content; needs manual assignment
    status: { type: String, enum: ["matched", "unmatched"], required: true, index: true },
    // Set when an admin assigned an unmatched transfer by hand
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    assignedAt: { type: Date },

    raw: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

paymentSchema.index({ provider: 1, providerTxnId: 1 }, { unique: true });
paymentSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Payment", paymentSchema);
