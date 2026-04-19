const Order = require("../models/Order");
const { calculateQuote } = require("../utils/quoteCalculator");

function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

async function summary(req, res) {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).lean();

  const activeShipments = orders.filter((o) => o.status !== "delivered").length;

  const totals = orders.reduce(
    (acc, o) => {
      const q = calculateQuote({
        weightKg: o.weightKg,
        serviceTier: o.serviceTier,
        packageCategory: o.packageCategory,
      });
      acc.totalSpent += q.breakdown.totalVnd;
      return acc;
    },
    { totalSpent: 0 }
  );

  const rewardPoints = Math.floor(totals.totalSpent / 1000);

  const recentShipments = orders.slice(0, 5).map((o) => ({
    id: o.trackingId,
    trackingId: o.trackingId,
    status: o.status,
    destination: o.destination,
    date: formatDate(o.createdAt),
  }));

  return res.status(200).json({
    activeShipments,
    totalSpent: totals.totalSpent,
    rewardPoints,
    recentShipments,
  });
}

module.exports = { summary };

