const express = require("express");
const {
  createOrder,
  getMyOrders,
  getOrderById,
  createRazorpayOrder,
  getRazorpayKey,
  handleRazorpayWebhook,
  trackOrderPublic,
} = require("../controllers/orderController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Public routes (no login required)
router.get("/razorpay-key", getRazorpayKey);
router.post("/razorpay-webhook", handleRazorpayWebhook);
router.route("/track").get(trackOrderPublic).post(trackOrderPublic);

router.use(protect); // Order history and checkout order placement require customer auth

router.post("/razorpay-order", createRazorpayOrder);
router.route("/").post(createOrder).get(getMyOrders);
router.route("/:id").get(getOrderById);

module.exports = router;

