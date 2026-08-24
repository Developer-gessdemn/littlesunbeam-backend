const express = require("express");
const {
  getWishlist,
  toggleWishlist,
  addToWishlist,
  removeFromWishlist,
} = require("../controllers/wishlistController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// All wishlist routes require authentication
router.use(protect);

router.route("/").get(getWishlist);

router.post("/toggle", toggleWishlist);
router.post("/toggle/:productId", toggleWishlist);

router.post("/add", addToWishlist);
router.post("/:productId", addToWishlist);

router.delete("/:productId", removeFromWishlist);

module.exports = router;
