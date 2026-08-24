const express = require("express");
const {
  getUserProfile,
  updateUserProfile,
  getUserWishlist,
  addToWishlist,
  removeFromWishlist,
} = require("../controllers/userController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// User Profile routes
router.route("/profile").get(protect, getUserProfile).put(protect, updateUserProfile);

// Wishlist routes
router.route("/wishlist").get(protect, getUserWishlist);
router
  .route("/wishlist/:productId")
  .post(protect, addToWishlist)
  .delete(protect, removeFromWishlist);

module.exports = router;
