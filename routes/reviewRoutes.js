const express = require("express");
const {
  createReview,
  getProductReviews,
  updateReview,
  deleteReview,
  voteReviewHelpful,
  getGlobalReviews,
} = require("../controllers/reviewController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router({ mergeParams: true });

// Global reviews / Product reviews
router.route("/").get((req, res, next) => {
  if (req.params.productId) {
    return getProductReviews(req, res, next);
  }
  return getGlobalReviews(req, res, next);
}).post(protect, createReview);

// Review helpful vote
router.route("/:id/helpful").post(protect, voteReviewHelpful);

// Update / Delete review
router
  .route("/:id")
  .put(protect, updateReview)
  .delete(protect, deleteReview);

module.exports = router;
