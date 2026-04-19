const express = require("express");
const { authMiddleware } = require("../middleware/authMiddleware");
const { roleMiddleware } = require("../middleware/roleMiddleware");
const userController = require("../controllers/userController");

const router = express.Router();

router.get("/profile", authMiddleware, userController.getProfile);

router.get("/", authMiddleware, roleMiddleware("admin"), userController.listUsers);
router.post("/", authMiddleware, roleMiddleware("admin"), userController.createUser);
router.patch("/:id", authMiddleware, roleMiddleware("admin"), userController.updateUser);
router.delete("/:id", authMiddleware, roleMiddleware("admin"), userController.deleteUser);

module.exports = router;

