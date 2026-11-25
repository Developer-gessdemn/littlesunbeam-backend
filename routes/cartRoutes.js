const express = require("express");
const {
  getCart,
  addToCart,
  updateCartItemQty,
  removeCartItem,
  clearCart,
  mergeCart,
} = require("../controllers/cartController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect); // All cart routes require authentication

router
  .route("/")
  .get(getCart)
  .post(addToCart)
  .delete(clearCart);

router.post("/add", addToCart);
router.post("/merge", mergeCart);

router
  .route("/:itemId")
  .put(updateCartItemQty)
  .delete(removeCartItem);

module.exports = router;
