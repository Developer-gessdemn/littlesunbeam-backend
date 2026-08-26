const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product ID is required for a review"],
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required for a review"],
      index: true,
    },
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot be more than 5"],
    },
    comment: {
      type: String,
      required: [true, "Review comment cannot be empty"],
      trim: true,
      maxlength: [1000, "Review comment cannot exceed 1000 characters"],
    },
    helpfulVotes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    helpfulCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound unique index: Ensure 1 review per user per product
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });

// Virtual id field for frontend compatibility
reviewSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

// Static method to recalculate and update product rating and review count
reviewSchema.statics.recalculateProductRating = async function (productId) {
  try {
    const Product = mongoose.model("Product");
    const pId = typeof productId === "string" ? new mongoose.Types.ObjectId(productId) : productId;

    const stats = await this.aggregate([
      { $match: { productId: pId } },
      {
        $group: {
          _id: "$productId",
          totalReviews: { $sum: 1 },
          avgRating: { $avg: "$rating" },
        },
      },
    ]);

    if (stats.length > 0) {
      const avgRating = Math.round(stats[0].avgRating * 10) / 10;
      const totalReviews = stats[0].totalReviews;

      await Product.findByIdAndUpdate(pId, {
        rating: avgRating,
        reviewCount: totalReviews,
      });

      return { rating: avgRating, reviewCount: totalReviews };
    } else {
      // If no reviews left, reset to 0 rating and 0 count
      await Product.findByIdAndUpdate(pId, {
        rating: 0,
        reviewCount: 0,
      });

      return { rating: 0, reviewCount: 0 };
    }
  } catch (error) {
    console.error(`[Review Aggregation Error for Product ${productId}]:`, error.message);
    return null;
  }
};

// Post-save hook to automatically recalculate product rating
reviewSchema.post("save", async function () {
  await this.constructor.recalculateProductRating(this.productId);
});

// Post-remove/findOneAndDelete hook to recalculate product rating
reviewSchema.post("findOneAndDelete", async function (doc) {
  if (doc && doc.productId) {
    const Review = mongoose.model("Review");
    await Review.recalculateProductRating(doc.productId);
  }
});

const Review = mongoose.model("Review", reviewSchema);
module.exports = Review;
