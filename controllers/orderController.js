const crypto = require("crypto");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Cart = require("../models/Cart");
const User = require("../models/User");
const { getRazorpayInstance } = require("../config/razorpay");
const { isValidObjectId } = require("../utils/validators");

const FREE_SHIPPING_THRESHOLD = 2499;

// Helper: Robustly extract numerical price from candidates
const parsePrice = (...candidates) => {
  for (const val of candidates) {
    if (val === null || val === undefined || val === "") continue;
    if (typeof val === "number" && !isNaN(val) && val > 0) return val;
    if (typeof val === "string") {
      const cleaned = Number(val.replace(/[^0-9.]/g, ""));
      if (!isNaN(cleaned) && cleaned > 0) return cleaned;
    }
  }
  return 0;
};

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const createOrder = async (req, res, next) => {
  try {
    const {
      items,
      shippingAddress,
      paymentMethod = "Online Payment",
      couponCode = "",
      notes = "",
    } = req.body;

    if (!shippingAddress || !shippingAddress.name || !shippingAddress.address || !shippingAddress.city || !shippingAddress.pincode) {
      return res.status(400).json({
        success: false,
        message: "Please provide complete shipping address (name, address, city, pincode)",
      });
    }

    let orderItems = items;

    // If items are not passed in body, fetch from user's active cart
    if (!orderItems || orderItems.length === 0) {
      const cart = await Cart.findOne({ user: req.user._id });
      if (!cart || cart.items.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No items in order and cart is empty",
        });
      }
      orderItems = cart.items.map((item) => ({
        product: item.product,
        name: item.name,
        image: item.image,
        price: item.price,
        quantity: item.quantity,
        selectedSize: item.selectedSize,
        selectedColor: item.selectedColor,
        variant: item.variant,
      }));
    }

    // Validate product existence and available stock (including color+size variant level)
    const validatedItems = [];
    let subtotal = 0;

    for (const item of orderItems) {
      let product = null;
      if (isValidObjectId(item.product)) {
        product = await Product.findById(item.product);
      } else if (item.productId && isValidObjectId(item.productId)) {
        product = await Product.findById(item.productId);
      } else {
        product = await Product.findOne({
          $or: [{ sku: item.product || item.sku }, { slug: item.product || item.slug }],
        });
      }

      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product '${item.name || item.product}' not found`,
        });
      }

      const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
      const color = (item.selectedColor || "Default").trim();
      const size = (item.selectedSize || "Standard").trim();

      // Check variant level stock if colorVariants or variants exist
      let variantMatched = null;
      if (Array.isArray(product.colorVariants) && product.colorVariants.length > 0) {
        const matchedCv = product.colorVariants.find(
          (cv) => cv.name?.toLowerCase() === color.toLowerCase()
        );
        if (matchedCv && Array.isArray(matchedCv.inventory)) {
          variantMatched = matchedCv.inventory.find(
            (inv) => inv.size?.toLowerCase() === size.toLowerCase()
          );
        }
      }

      if (!variantMatched && Array.isArray(product.variants) && product.variants.length > 0) {
        variantMatched = product.variants.find(
          (v) =>
            v.color?.toLowerCase() === color.toLowerCase() &&
            v.size?.toLowerCase() === size.toLowerCase()
        );
      }

      if (variantMatched) {
        if (variantMatched.stock < qty) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for '${product.name}' (${color} / ${size}). Available: ${variantMatched.stock}, requested: ${qty}`,
          });
        }
      } else if (product.stock < qty) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for product '${product.name}'. Available: ${product.stock}, requested: ${qty}`,
        });
      }

      const itemPrice = parsePrice(
        variantMatched?.price,
        variantMatched?.mrp,
        product.price,
        product.sellingPrice,
        product.mrp,
        item.price
      );

      validatedItems.push({
        product: product._id,
        name: product.name,
        image: item.image || product.image,
        price: itemPrice,
        quantity: qty,
        selectedSize: size,
        selectedColor: color,
        variant: item.variant || `${color} / ${size}`,
      });

      subtotal += itemPrice * qty;
    }

    // Calculate discount
    let discount = 0;
    const cleanCoupon = String(couponCode).trim().toUpperCase();
    if (cleanCoupon === "SUNNY10") {
      discount = Math.round(subtotal * 0.1);
    }

    // Calculate shipping
    const shippingCharge = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : 99;
    const totalAmount = Math.max(0, subtotal - discount + shippingCharge);

    // Determine payment details and verify Razorpay signature if online payment
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
    let paymentStatus = "Pending";
    let paymentDetails = {
      gateway: "COD",
      transactionId: `COD-${Date.now()}`,
      cardLast4: "",
    };

    if (paymentMethod === "Cash on Delivery") {
      paymentStatus = "Pending";
      paymentDetails = {
        gateway: "COD",
        transactionId: `COD-${Date.now()}`,
      };
    } else {
      // If Razorpay payment info is provided, verify the cryptographic signature
      if (razorpay_order_id && razorpay_payment_id && razorpay_signature) {
        const keySecret = process.env.RAZORPAY_KEY_SECRET || "HgY9N9qekQtjTsmchnkj4Eql";
        const hmac = crypto.createHmac("sha256", keySecret);
        hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
        const generatedSignature = hmac.digest("hex");

        if (generatedSignature !== razorpay_signature) {
          return res.status(400).json({
            success: false,
            message: "Payment verification failed: invalid signature",
          });
        }

        paymentStatus = "Paid";
        paymentDetails = {
          gateway: "Razorpay",
          transactionId: razorpay_payment_id,
          paymentIntentId: razorpay_order_id,
          cardLast4: req.body.cardLast4 || "",
        };
      } else {
        // Fallback for direct online payments or mock testing
        paymentStatus = "Paid";
        paymentDetails = {
          gateway: "Razorpay_Direct",
          transactionId: `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          cardLast4: req.body.cardLast4 || "4242",
        };
      }
    }

    // Create the order
    const order = await Order.create({
      user: req.user._id,
      items: validatedItems,
      shippingAddress: {
        name: shippingAddress.name.trim(),
        email: (shippingAddress.email || req.user.email).trim().toLowerCase(),
        phone: (shippingAddress.phone || req.user.phone || "").trim(),
        address: (shippingAddress.address || shippingAddress.street).trim(),
        city: shippingAddress.city.trim(),
        state: (shippingAddress.state || "").trim(),
        pincode: shippingAddress.pincode.trim(),
        country: shippingAddress.country || "India",
      },
      paymentMethod,
      paymentStatus,
      paymentDetails,
      orderStatus: "Confirmed",
      subtotal,
      discount,
      couponCode: cleanCoupon,
      shippingCharge,
      totalAmount,
      notes: notes ? notes.trim() : "",
    });

    // Reduce stock from exact variant and update product stock
    for (const item of validatedItems) {
      const prodToUpdate = await Product.findById(item.product);
      if (prodToUpdate) {
        const itemColor = (item.selectedColor || "").toLowerCase();
        const itemSize = (item.selectedSize || "").toLowerCase();

        // 1. Deduct from colorVariants inventory
        if (Array.isArray(prodToUpdate.colorVariants)) {
          prodToUpdate.colorVariants.forEach((cv) => {
            if (cv.name?.toLowerCase() === itemColor && Array.isArray(cv.inventory)) {
              cv.inventory.forEach((inv) => {
                if (inv.size?.toLowerCase() === itemSize) {
                  inv.stock = Math.max(0, inv.stock - item.quantity);
                }
              });
            }
          });
        }

        // 2. Deduct from flattened variants
        if (Array.isArray(prodToUpdate.variants)) {
          prodToUpdate.variants.forEach((v) => {
            if (v.color?.toLowerCase() === itemColor && v.size?.toLowerCase() === itemSize) {
              v.stock = Math.max(0, v.stock - item.quantity);
            }
          });
        }

        // 3. Deduct from parent total stock
        prodToUpdate.stock = Math.max(0, prodToUpdate.stock - item.quantity);

        // 4. Update stock status
        const threshold = Number(prodToUpdate.lowStockThreshold || 10);
        if (prodToUpdate.stock <= 0) {
          prodToUpdate.stockStatus = "Out of Stock";
        } else if (prodToUpdate.stock <= threshold) {
          prodToUpdate.stockStatus = "Low Stock";
        } else {
          prodToUpdate.stockStatus = "In Stock";
        }

        await prodToUpdate.save();
      }
    }

    // Clear user's cart
    await Cart.findOneAndUpdate({ user: req.user._id }, { items: [] });

    // Sync complete shipping address & contact info into customer's User account in DB
    try {
      const sName = (shippingAddress.name || req.user.name || "").trim();
      const sPhone = (shippingAddress.phone || req.user.phone || "").trim();
      const sEmail = (shippingAddress.email || req.user.email || "").trim().toLowerCase();
      const sStreet = (shippingAddress.address || shippingAddress.street || "").trim();
      const sCity = (shippingAddress.city || "").trim();
      const sState = (shippingAddress.state || "").trim();
      const sPincode = (shippingAddress.pincode || "").trim();
      const sCountry = shippingAddress.country || "India";

      await User.findByIdAndUpdate(req.user._id, {
        ...(sPhone ? { phone: sPhone } : {}),
        address: {
          name: sName,
          phone: sPhone,
          email: sEmail,
          street: sStreet,
          address: sStreet,
          city: sCity,
          state: sState,
          pincode: sPincode,
          country: sCountry,
        },
        shippingAddress: {
          name: sName,
          phone: sPhone,
          email: sEmail,
          street: sStreet,
          address: sStreet,
          city: sCity,
          state: sState,
          pincode: sPincode,
          country: sCountry,
        },
      });
    } catch (syncErr) {
      console.warn("[orderController] Could not sync shipping address to user account:", syncErr.message);
    }

    return res.status(201).json({
      success: true,
      message: "Order placed successfully",
      data: {
        order,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get logged in user orders
// @route   GET /api/orders
// @access  Private
const getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate("items.product", "name price image sku")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "User orders fetched successfully",
      data: {
        orders,
        count: orders.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    let order = null;
    if (isValidObjectId(id)) {
      order = await Order.findById(id).populate("user", "name email phone");
    } else {
      order = await Order.findOne({ orderNumber: id }).populate("user", "name email phone");
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Ensure user owns this order unless user is admin
    if (
      String(order.user._id || order.user) !== String(req.user._id) &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this order",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order fetched successfully",
      data: {
        order,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create Razorpay Order for client checkout
// @route   POST /api/orders/razorpay-order
// @access  Private
const createRazorpayOrder = async (req, res, next) => {
  try {
    const { amount, currency = "INR" } = req.body;

    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid order amount",
      });
    }

    const razorpay = getRazorpayInstance();
    const options = {
      amount: Math.round(Number(amount) * 100), // amount in paise
      currency: currency.toUpperCase(),
      receipt: `rcpt_${Date.now().toString().slice(-8)}_${Math.floor(Math.random() * 1000)}`,
      notes: {
        userId: String(req.user._id),
        userEmail: req.user.email || "",
      },
    };

    const razorpayOrder = await razorpay.orders.create(options);

    return res.status(200).json({
      success: true,
      message: "Razorpay order created successfully",
      data: {
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_TTYFrGlH8NWdDV",
      },
    });
  } catch (error) {
    console.error("[Razorpay Order Error]:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create Razorpay order",
    });
  }
};

// @desc    Get Razorpay public Key ID
// @route   GET /api/orders/razorpay-key
// @access  Public
const getRazorpayKey = async (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_TTYFrGlH8NWdDV",
    },
  });
};

module.exports = {
  createOrder,
  getMyOrders,
  getOrderById,
  createRazorpayOrder,
  getRazorpayKey,
};

