const User = require("../models/User");
const Product = require("../models/Product");
const { isValidObjectId } = require("../utils/validators");

// @desc    Get current user's wishlist
// @route   GET /api/wishlist
// @access  Private
const getWishlist = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: "wishlist",
      match: { isActive: true },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const items = user.wishlist || [];

    return res.status(200).json({
      success: true,
      message: "Wishlist retrieved successfully",
      data: {
        wishlist: items,
        count: items.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle product in wishlist (Add if not present, Remove if present)
// @route   POST /api/wishlist/toggle or POST /api/wishlist/toggle/:productId
// @access  Private
const toggleWishlist = async (req, res, next) => {
  try {
    const productId = req.params.productId || req.body.productId;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    let product = null;
    if (isValidObjectId(productId)) {
      product = await Product.findById(productId);
    } else {
      product = await Product.findOne({
        $or: [{ sku: productId }, { slug: productId }],
      });
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const targetIdStr = String(product._id);
    const existingIndex = user.wishlist.findIndex(
      (id) => String(id) === targetIdStr
    );

    let isWishlisted = false;
    let message = "";

    if (existingIndex > -1) {
      // Remove from wishlist
      user.wishlist.splice(existingIndex, 1);
      isWishlisted = false;
      message = "Product removed from wishlist";
    } else {
      // Add to wishlist
      user.wishlist.push(product._id);
      isWishlisted = true;
      message = "Product added to wishlist";
    }

    await user.save();
    await user.populate({
      path: "wishlist",
      match: { isActive: true },
    });

    return res.status(200).json({
      success: true,
      message,
      data: {
        isWishlisted,
        wishlist: user.wishlist || [],
        count: user.wishlist ? user.wishlist.length : 0,
        productId: targetIdStr,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add product to wishlist
// @route   POST /api/wishlist/add or POST /api/wishlist/:productId
// @access  Private
const addToWishlist = async (req, res, next) => {
  try {
    const productId = req.params.productId || req.body.productId;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    let product = null;
    if (isValidObjectId(productId)) {
      product = await Product.findById(productId);
    } else {
      product = await Product.findOne({
        $or: [{ sku: productId }, { slug: productId }],
      });
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const exists = user.wishlist.some(
      (id) => String(id) === String(product._id)
    );

    if (!exists) {
      user.wishlist.push(product._id);
      await user.save();
    }

    await user.populate({
      path: "wishlist",
      match: { isActive: true },
    });

    return res.status(200).json({
      success: true,
      message: "Product added to wishlist",
      data: {
        isWishlisted: true,
        wishlist: user.wishlist || [],
        count: user.wishlist ? user.wishlist.length : 0,
        productId: String(product._id),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove product from wishlist
// @route   DELETE /api/wishlist/:productId
// @access  Private
const removeFromWishlist = async (req, res, next) => {
  try {
    const productId = req.params.productId || req.body.productId;

    let productObjectId = productId;
    if (!isValidObjectId(productId)) {
      const prod = await Product.findOne({
        $or: [{ sku: productId }, { slug: productId }],
      });
      if (prod) productObjectId = prod._id;
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.wishlist = user.wishlist.filter(
      (id) => String(id) !== String(productObjectId)
    );

    await user.save();
    await user.populate({
      path: "wishlist",
      match: { isActive: true },
    });

    return res.status(200).json({
      success: true,
      message: "Product removed from wishlist",
      data: {
        isWishlisted: false,
        wishlist: user.wishlist || [],
        count: user.wishlist ? user.wishlist.length : 0,
        productId: String(productObjectId),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getWishlist,
  toggleWishlist,
  addToWishlist,
  removeFromWishlist,
};
