const User = require("../models/User");
const Product = require("../models/Product");
const { isValidEmail, isValidObjectId } = require("../utils/validators");

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User profile fetched successfully",
      data: {
        user: user.toSafeObject(),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("+password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const { name, email, phone, street, address, city, state, pincode, password, shippingAddress, addresses } = req.body;

    if (name) user.name = name.trim();
    if (email && email !== user.email) {
      if (!isValidEmail(email)) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid email address",
        });
      }
      const emailExists = await User.findOne({ email: email.toLowerCase().trim() });
      if (emailExists && String(emailExists._id) !== String(user._id)) {
        return res.status(400).json({
          success: false,
          message: "Email address is already in use by another account",
        });
      }
      user.email = email.toLowerCase().trim();
    }

    if (phone !== undefined) user.phone = phone ? phone.trim() : "";

    // Address updates
    const streetAddress = (
      (typeof address === "object" ? address.street || address.address : address) ||
      street ||
      (typeof shippingAddress === "object" ? shippingAddress.street || shippingAddress.address : "") ||
      user.address?.street ||
      ""
    );
    const cityVal = (
      (typeof address === "object" ? address.city : city) ||
      (typeof shippingAddress === "object" ? shippingAddress.city : "") ||
      user.address?.city ||
      ""
    );
    const stateVal = (
      (typeof address === "object" ? address.state : state) ||
      (typeof shippingAddress === "object" ? shippingAddress.state : "") ||
      user.address?.state ||
      ""
    );
    const pincodeVal = (
      (typeof address === "object" ? address.pincode : pincode) ||
      (typeof shippingAddress === "object" ? shippingAddress.pincode : "") ||
      user.address?.pincode ||
      ""
    );
    const nameVal = (
      (typeof shippingAddress === "object" ? shippingAddress.name : "") ||
      (typeof address === "object" ? address.name : "") ||
      user.name
    );
    const phoneVal = (
      (typeof shippingAddress === "object" ? shippingAddress.phone : "") ||
      (typeof address === "object" ? address.phone : "") ||
      user.phone
    );
    const emailVal = (
      (typeof shippingAddress === "object" ? shippingAddress.email : "") ||
      user.email
    );

    user.address = {
      name: nameVal,
      phone: phoneVal,
      email: emailVal,
      street: streetAddress,
      address: streetAddress,
      city: cityVal,
      state: stateVal,
      pincode: pincodeVal,
      country: "India",
    };

    user.shippingAddress = {
      name: nameVal,
      phone: phoneVal,
      email: emailVal,
      street: streetAddress,
      address: streetAddress,
      city: cityVal,
      state: stateVal,
      pincode: pincodeVal,
      country: "India",
    };

    if (Array.isArray(addresses)) {
      user.addresses = addresses;
    }

    if (password) {
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters",
        });
      }
      user.password = password;
    }

    // Explicitly prevent role manipulation by normal users
    // (role can only be changed by admin in adminController)

    const updatedUser = await user.save();

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        user: updatedUser.toSafeObject(),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user wishlist
// @route   GET /api/users/wishlist
// @access  Private
const getUserWishlist = async (req, res, next) => {
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

    return res.status(200).json({
      success: true,
      message: "Wishlist retrieved successfully",
      data: {
        wishlist: user.wishlist || [],
        count: user.wishlist ? user.wishlist.length : 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add product to wishlist
// @route   POST /api/users/wishlist/:productId
// @access  Private
const addToWishlist = async (req, res, next) => {
  try {
    const { productId } = req.params;

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

    // Check if already in wishlist
    const exists = user.wishlist.some(
      (id) => String(id) === String(product._id)
    );

    if (!exists) {
      user.wishlist.push(product._id);
      await user.save();
    }

    await user.populate("wishlist");

    return res.status(200).json({
      success: true,
      message: "Product added to wishlist",
      data: {
        wishlist: user.wishlist,
        count: user.wishlist.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove product from wishlist
// @route   DELETE /api/users/wishlist/:productId
// @access  Private
const removeFromWishlist = async (req, res, next) => {
  try {
    const { productId } = req.params;

    let productObjectId = productId;
    if (!isValidObjectId(productId)) {
      const prod = await Product.findOne({
        $or: [{ sku: productId }, { slug: productId }],
      });
      if (prod) productObjectId = prod._id;
    }

    const user = await User.findById(req.user._id);

    user.wishlist = user.wishlist.filter(
      (id) => String(id) !== String(productObjectId)
    );

    await user.save();
    await user.populate("wishlist");

    return res.status(200).json({
      success: true,
      message: "Product removed from wishlist",
      data: {
        wishlist: user.wishlist,
        count: user.wishlist.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserProfile,
  updateUserProfile,
  getUserWishlist,
  addToWishlist,
  removeFromWishlist,
};
