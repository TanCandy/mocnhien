const express = require("express");

const authRoutes = require("./authRoutes");
const meRoutes = require("./meRoutes");
const orderRoutes = require("./orderRoutes");
const quoteRoutes = require("./quoteRoutes");
const dashboardRoutes = require("./dashboardRoutes");
const userRoutes = require("./userRoutes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/me", meRoutes);
router.use("/orders", orderRoutes);
router.use("/quotes", quoteRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/user", userRoutes);

module.exports = router;

