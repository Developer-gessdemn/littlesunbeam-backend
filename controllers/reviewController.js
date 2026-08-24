const Review = require("../models/Review");
const Product = require("../models/Product");
const { isValidObjectId } = require("../utils/validators");

// Helper to resolve product from ID, slug, or SKU
const resolveProduct = async (identifier) => {
  if (!identifier) return null;

  if (isValidObjectId(identifier)) {
    const p = await Product.findById(identifier);
    if (p) return p;
  }

  return await Product.findOne({
    $or: [{ slug: identifier }, { sku: identifier.toUpperCase() }],
  });
};

// @desc    Create a product review
// @route   POST /api/products/:productId/reviews or POST /api/reviews
// @access  Private (Authenticated customer)
const createReview = async (req, res, next) => {
  try {
    const productIdInput = req.params.productId || req.body.productId;
    const { rating, comment } = req.body;

    if (!productIdInput) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    const product = await resolveProduct(productIdInput);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product not found with identifier: ${productIdInput}`,
      });
    }

    const numericRating = Number(rating);
    if (!numericRating || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be a number between 1 and 5",
      });
    }

    if (!comment || typeof comment !== "string" || !comment.trim()) {
      return res.status(400).json({
        success: false,
        message: "Review comment cannot be empty",
      });
    }

    // Check if user already reviewed this product
    const existingReview = await Review.findOne({
      productId: product._id,
      userId: req.user._id,
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: "You have already reviewed this product. You can edit your existing review.",
        data: {
          existingReviewId: existingReview._id,
        },
      });
    }

    const newReview = new Review({
      productId: product._id,
      userId: req.user._id,
      rating: numericRating,
      comment: comment.trim(),
    });

    await newReview.save();

    // Recalculate product rating stats
    const updatedStats = await Review.recalculateProductRating(product._id);

    // Populate user info for immediate frontend use
    await newReview.populate("userId", "name email role");

    return res.status(201).json({
      success: true,
      message: "Thank you! Your review has been published.",
      data: {
        review: {
          _id: newReview._id,
          id: newReview._id,
          productId: newReview.productId,
          rating: newReview.rating,
          comment: newReview.comment,
          helpfulCount: newReview.helpfulCount || 0,
          helpfulVotes: newReview.helpfulVotes || [],
          user: {
            _id: newReview.userId?._id,
            id: newReview.userId?._id,
            name: newReview.userId?.name || req.user.name,
            email: newReview.userId?.email || req.user.email,
          },
          createdAt: newReview.createdAt,
          updatedAt: newReview.updatedAt,
        },
        productStats: updatedStats,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "You have already submitted a review for this product.",
      });
    }
    next(error);
  }
};

// @desc    Get all reviews for a specific product
// @route   GET /api/products/:productId/reviews
// @access  Public
const getProductReviews = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 20, sort = "newest" } = req.query;

    const product = await resolveProduct(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product not found with identifier: ${productId}`,
      });
    }

    let sortOption = { createdAt: -1 };
    if (sort === "rating_desc") sortOption = { rating: -1, createdAt: -1 };
    else if (sort === "rating_asc") sortOption = { rating: 1, createdAt: -1 };
    else if (sort === "helpful") sortOption = { helpfulCount: -1, createdAt: -1 };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [reviews, totalCount] = await Promise.all([
      Review.find({ productId: product._id })
        .populate("userId", "name email role")
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Review.countDocuments({ productId: product._id }),
    ]);

    const formattedReviews = reviews.map((r) => ({
      _id: r._id,
      id: r._id,
      productId: r.productId,
      rating: r.rating,
      comment: r.comment,
      helpfulCount: r.helpfulCount || (Array.isArray(r.helpfulVotes) ? r.helpfulVotes.length : 0),
      helpfulVotes: r.helpfulVotes || [],
      user: {
        _id: r.userId?._id || r.userId,
        id: r.userId?._id || r.userId,
        name: r.userId?.name || "Verified Customer",
        email: r.userId?.email || "",
      },
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    return res.status(200).json({
      success: true,
      message: "Product reviews fetched successfully",
      data: {
        reviews: formattedReviews,
        totalReviews: totalCount,
        averageRating: product.rating,
        reviewCount: product.reviewCount,
        page: pageNum,
        totalPages: Math.ceil(totalCount / limitNum) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a review
// @route   PUT /api/reviews/:id
// @access  Private (Review owner or Admin)
const updateReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid review ID",
      });
    }

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    // Verify ownership
    const isOwner = review.userId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this review",
      });
    }

    if (rating !== undefined) {
      const numericRating = Number(rating);
      if (numericRating < 1 || numericRating > 5) {
        return res.status(400).json({
          success: false,
          message: "Rating must be between 1 and 5",
        });
      }
      review.rating = numericRating;
    }

    if (comment !== undefined) {
      if (typeof comment !== "string" || !comment.trim()) {
        return res.status(400).json({
          success: false,
          message: "Review comment cannot be empty",
        });
      }
      review.comment = comment.trim();
    }

    await review.save();
    const updatedStats = await Review.recalculateProductRating(review.productId);
    await review.populate("userId", "name email role");

    return res.status(200).json({
      success: true,
      message: "Review updated successfully",
      data: {
        review: {
          _id: review._id,
          id: review._id,
          productId: review.productId,
          rating: review.rating,
          comment: review.comment,
          helpfulCount: review.helpfulCount || 0,
          helpfulVotes: review.helpfulVotes || [],
          user: {
            _id: review.userId?._id,
            id: review.userId?._id,
            name: review.userId?.name || req.user.name,
            email: review.userId?.email || req.user.email,
          },
          createdAt: review.createdAt,
          updatedAt: review.updatedAt,
        },
        productStats: updatedStats,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a review
// @route   DELETE /api/reviews/:id
// @access  Private (Review owner or Admin)
const deleteReview = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid review ID",
      });
    }

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    // Verify ownership
    const isOwner = review.userId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this review",
      });
    }

    const productId = review.productId;
    await Review.findByIdAndDelete(id);

    // Recalculate product stats
    const updatedStats = await Review.recalculateProductRating(productId);

    return res.status(200).json({
      success: true,
      message: "Review deleted successfully",
      data: {
        productStats: updatedStats,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle helpful vote on a review
// @route   POST /api/reviews/:id/helpful
// @access  Private (Authenticated customer)
const voteReviewHelpful = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid review ID",
      });
    }

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    const userIdStr = req.user._id.toString();
    const existingVoteIndex = review.helpfulVotes.findIndex(
      (v) => v.toString() === userIdStr
    );

    let hasVoted = false;
    if (existingVoteIndex > -1) {
      // Remove vote
      review.helpfulVotes.splice(existingVoteIndex, 1);
      hasVoted = false;
    } else {
      // Add vote
      review.helpfulVotes.push(req.user._id);
      hasVoted = true;
    }

    review.helpfulCount = review.helpfulVotes.length;
    await review.save();

    return res.status(200).json({
      success: true,
      message: hasVoted ? "Marked as helpful" : "Helpful vote removed",
      data: {
        helpfulCount: review.helpfulCount,
        hasVoted,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get global reviews for Home Page carousel
// @route   GET /api/reviews
// @access  Public
const getGlobalReviews = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;
    const limitNum = Math.min(30, Math.max(1, parseInt(limit, 10) || 10));

    const reviews = await Review.find()
      .populate("userId", "name email role")
      .populate("productId", "name slug image gallery price category categoryPill isActive")
      .sort({ createdAt: -1 })
      .limit(limitNum * 2) // fetch extra to filter out any orphaned records
      .lean();

    const validReviews = reviews
      .filter((r) => r.userId && r.productId && r.productId.isActive !== false)
      .slice(0, limitNum)
      .map((r) => ({
        _id: r._id,
        id: r._id,
        rating: r.rating,
        comment: r.comment,
        helpfulCount: r.helpfulCount || (Array.isArray(r.helpfulVotes) ? r.helpfulVotes.length : 0),
        createdAt: r.createdAt,
        user: {
          _id: r.userId._id,
          id: r.userId._id,
          name: r.userId.name || "Verified Parent",
          email: r.userId.email || "",
        },
        product: {
          _id: r.productId._id,
          id: r.productId._id,
          name: r.productId.name,
          slug: r.productId.slug,
          image: r.productId.image || (Array.isArray(r.productId.gallery) ? r.productId.gallery[0] : ""),
          price: r.productId.price,
          category: r.productId.categoryPill || r.productId.category,
        },
      }));

    return res.status(200).json({
      success: true,
      message: "Global customer reviews fetched successfully",
      data: {
        reviews: validReviews,
        count: validReviews.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createReview,
  getProductReviews,
  updateReview,
  deleteReview,
  voteReviewHelpful,
  getGlobalReviews,
};
