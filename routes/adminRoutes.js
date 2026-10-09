const express = require("express");
const {
  getAdminDashboard,
  getAllOrders,
  getAdminOrderById,
  updateOrderStatus,
  updateOrderCourierDetails,
  addTrackingHistoryUpdate,
  deleteTrackingHistoryUpdate,
  getAllUsers,
  updateUserStatus,
  seedDatabase,
  syncRazorpayOrders,
} = require("../controllers/adminController");
const { protect } = require("../middleware/authMiddleware");
const { admin } = require("../middleware/adminMiddleware");

const router = express.Router();

// Apply auth & admin protection to all admin endpoints
router.use(protect);
router.use(admin);

router.get("/dashboard", getAdminDashboard);
router.get("/orders", getAllOrders);
router.post("/orders/sync-razorpay", syncRazorpayOrders);
router.get("/orders/sync-razorpay", syncRazorpayOrders);
router.get("/orders/:id", getAdminOrderById);
router.put("/orders/:id/status", updateOrderStatus);
router.put("/orders/:id/courier", updateOrderCourierDetails);
router.post("/orders/:id/tracking", addTrackingHistoryUpdate);
router.delete("/orders/:id/tracking/:updateId", deleteTrackingHistoryUpdate);
router.get("/users", getAllUsers);
router.put("/users/:id/status", updateUserStatus);
router.post("/seed", seedDatabase);

module.exports = router;

