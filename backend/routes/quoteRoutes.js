const express = require("express");
const quoteController = require("../controllers/quoteController");

const router = express.Router();

router.post("/", quoteController.quote);

module.exports = router;

