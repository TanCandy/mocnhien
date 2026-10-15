const Order = require("../models/Order");
const { calculateQuote } = require("../utils/quoteCalculator");

function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

async function summary(req, res) {
  const userEmail = req.user.email ? req.user.email.toLowerCase().trim() : "";
  const filter = userEmail
    ? { $or: [{ user: req.user._id }, { userEmail }] }
    : { user: req.user._id };

  const orders = await Order.find(filter).sort({ createdAt: -1 }).lean();

  const activeShipments = orders.filter((o) => o.status !== "delivered").length;

  const totals = orders.reduce(
    (acc, o) => {
      let spent = o.totalVND || o.priceVND || 0;
      if (!spent && o.weightKg) {
        const q = calculateQuote({
          weightKg: o.weightKg,
          serviceTier: o.serviceTier,
          packageCategory: o.packageCategory,
        });
        spent = q.breakdown.totalVnd;
      }
      acc.totalSpent += spent;
      return acc;
    },
    { totalSpent: 0 }
  );

  const rewardPoints = Math.floor(totals.totalSpent / 1000);

  const recentShipments = orders.slice(0, 5).map((o) => {
    const ident = o.orderCode || o.tracking_code || o.trackingId || String(o._id);
    return {
      id: ident,
      trackingId: ident,
      status: o.status,
      destination: o.warehouseAddress || o.address || o.destination || "",
      date: formatDate(o.createdAt || o.order_date || Date.now()),
    };
  });

  return res.status(200).json({
    activeShipments,
    totalSpent: totals.totalSpent,
    rewardPoints,
    recentShipments,
  });
}

module.exports = { summary };

