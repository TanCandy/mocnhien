const { calculateQuote } = require("../utils/quoteCalculator");

async function quote(req, res) {
  const { weightKg, serviceTier, packageCategory } = req.body || {};
  if (weightKg === undefined || weightKg === null) {
    return res.status(400).json({ message: "weightKg is required." });
  }

  const result = calculateQuote({
    weightKg,
    serviceTier,
    packageCategory,
  });

  return res.status(200).json(result);
}

module.exports = { quote };

