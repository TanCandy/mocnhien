const express = require("express");
const { authMiddleware } = require("../middleware/authMiddleware");
const meController = require("../controllers/meController");

const router = express.Router();

router.get("/", authMiddleware, meController.getMe);
router.patch("/", authMiddleware, meController.patchMe);

module.exports = router;

