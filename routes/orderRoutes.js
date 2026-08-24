const express = require("express");
const {
  createOrder,
  getMyOrders,
  getOrderById,
  createRazorpayOrder,
  getRazorpayKey,
} = require("../controllers/orderController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Public route to fetch Razorpay public key ID
router.get("/razorpay-key", getRazorpayKey);

router.use(protect); // All order & payment creation routes require auth

router.post("/razorpay-order", createRazorpayOrder);
router.route("/").post(createOrder).get(getMyOrders);
router.route("/:id").get(getOrderById);

module.exports = router;

