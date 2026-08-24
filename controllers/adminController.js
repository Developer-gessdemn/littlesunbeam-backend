const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const Category = require("../models/Category");
const { isValidObjectId } = require("../utils/validators");

// @desc    Get complete admin dashboard analytics
// @route   GET /api/admin/dashboard
// @access  Private/Admin
const getAdminDashboard = async (req, res, next) => {
  try {
    const [totalUsers, totalProducts, totalCategories, orders] = await Promise.all([
      User.countDocuments({ role: "user" }),
      Product.countDocuments({ isActive: true }),
      Category.countDocuments({ isActive: true }),
      Order.find({}).sort({ createdAt: -1 }),
    ]);

    const totalOrders = orders.length;

    // Total sales (paid or confirmed/delivered non-cancelled orders)
    const validOrders = orders.filter((o) => o.orderStatus !== "Cancelled");
    const totalSales = validOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    // Status breakdowns
    const pendingOrders = orders.filter((o) => o.orderStatus === "Pending").length;
    const confirmedOrders = orders.filter((o) => o.orderStatus === "Confirmed").length;
    const processingOrders = orders.filter((o) => o.orderStatus === "Processing").length;
    const shippedOrders = orders.filter((o) => o.orderStatus === "Shipped").length;
    const deliveredOrders = orders.filter((o) => o.orderStatus === "Delivered").length;
    const cancelledOrders = orders.filter((o) => o.orderStatus === "Cancelled").length;

    // Low stock products (stock <= 10)
    const lowStockProducts = await Product.find({ stock: { $lte: 10 }, isActive: true })
      .select("name stock sku price category image")
      .limit(10);

    // Recent orders
    const recentOrders = await Order.find({})
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .limit(6);

    // Best selling products calculation
    const productSalesMap = {};
    for (const order of validOrders) {
      for (const item of order.items) {
        const prodId = String(item.product);
        if (!productSalesMap[prodId]) {
          productSalesMap[prodId] = {
            id: prodId,
            name: item.name,
            image: item.image,
            price: item.price,
            totalQuantitySold: 0,
            totalRevenue: 0,
          };
        }
        productSalesMap[prodId].totalQuantitySold += item.quantity;
        productSalesMap[prodId].totalRevenue += item.price * item.quantity;
      }
    }

    const bestSellingProducts = Object.values(productSalesMap)
      .sort((a, b) => b.totalQuantitySold - a.totalQuantitySold)
      .slice(0, 5);

    // Sales summary grouped by last 7 days
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];

      const daySales = validOrders
        .filter((o) => new Date(o.createdAt).toISOString().split("T")[0] === dateStr)
        .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

      last7Days.push({
        date: dateStr,
        day: d.toLocaleDateString("en-US", { weekday: "short" }),
        sales: daySales,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Admin dashboard stats retrieved successfully",
      data: {
        summary: {
          totalUsers,
          totalProducts,
          totalCategories,
          totalOrders,
          totalSales,
          pendingOrders,
          confirmedOrders,
          processingOrders,
          shippedOrders,
          deliveredOrders,
          cancelledOrders,
        },
        lowStockProducts,
        recentOrders,
        bestSellingProducts,
        salesTrends: last7Days,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all orders with filtering and pagination
// @route   GET /api/admin/orders
// @access  Private/Admin
const getAllOrders = async (req, res, next) => {
  try {
    const { status, paymentStatus, search, page = 1, limit = 20 } = req.query;

    const query = {};

    if (status) query.orderStatus = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;

    if (search && search.trim()) {
      const sRegex = new RegExp(search.trim(), "i");
      query.$or = [
        { orderNumber: sRegex },
        { "shippingAddress.name": sRegex },
        { "shippingAddress.email": sRegex },
        { "shippingAddress.phone": sRegex },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const totalOrders = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .populate("user", "name email phone")
      .populate("items.product", "name price image sku")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    return res.status(200).json({
      success: true,
      message: "All orders fetched successfully",
      data: {
        orders,
        pagination: {
          total: totalOrders,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(totalOrders / limitNum) || 1,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single order details for admin
// @route   GET /api/admin/orders/:id
// @access  Private/Admin
const getAdminOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    let order = null;
    if (isValidObjectId(id)) {
      order = await Order.findById(id).populate("user", "name email phone role address");
    } else {
      order = await Order.findOne({ orderNumber: id }).populate("user", "name email phone role address");
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order details fetched successfully",
      data: {
        order,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update order status or payment status
// @route   PUT /api/admin/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { orderStatus, paymentStatus, cancelledReason } = req.body;

    let order = null;
    if (isValidObjectId(id)) {
      order = await Order.findById(id);
    } else {
      order = await Order.findOne({ orderNumber: id });
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const previousStatus = order.orderStatus;

    if (orderStatus) {
      order.orderStatus = orderStatus;

      if (orderStatus === "Shipped" && !order.shippedAt) {
        order.shippedAt = new Date();
      }

      if (orderStatus === "Delivered") {
        if (!order.deliveredAt) order.deliveredAt = new Date();
        order.paymentStatus = "Paid"; // Mark paid upon delivery
      }

      // If newly cancelled, restore product stock
      if (orderStatus === "Cancelled" && previousStatus !== "Cancelled") {
        if (cancelledReason) order.cancelledReason = cancelledReason;
        for (const item of order.items) {
          await Product.findByIdAndUpdate(item.product, {
            $inc: { stock: item.quantity },
          });
        }
      }
    }

    if (paymentStatus) {
      order.paymentStatus = paymentStatus;
    }

    const updatedOrder = await order.save();

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: {
        order: updatedOrder,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all users list with full shipping addresses & order statistics
// @route   GET /api/admin/users
// @access  Private/Admin
const getAllUsers = async (req, res, next) => {
  try {
    const [users, orders] = await Promise.all([
      User.find({}).sort({ createdAt: -1 }),
      Order.find({})
        .select("user orderNumber shippingAddress totalAmount orderStatus paymentStatus paymentMethod createdAt items")
        .sort({ createdAt: -1 }),
    ]);

    // Group orders by user ID
    const userOrdersMap = {};
    for (const order of orders) {
      if (order.user) {
        const uId = String(order.user);
        if (!userOrdersMap[uId]) {
          userOrdersMap[uId] = [];
        }
        userOrdersMap[uId].push(order);
      }
    }

    const enhancedUsers = users.map((u) => {
      const safeUser = u.toSafeObject();
      const uOrders = userOrdersMap[String(u._id)] || [];
      const totalSpent = uOrders
        .filter((o) => o.orderStatus !== "Cancelled")
        .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

      const latestOrder = uOrders[0] || null;

      // Extract effective shipping address (from shippingAddress, address, or latest order)
      let effectiveShippingAddress = {
        name: safeUser.shippingAddress?.name || safeUser.address?.name || safeUser.name || "",
        phone: safeUser.shippingAddress?.phone || safeUser.address?.phone || safeUser.phone || "",
        email: safeUser.shippingAddress?.email || safeUser.address?.email || safeUser.email || "",
        street: safeUser.shippingAddress?.street || safeUser.shippingAddress?.address || safeUser.address?.street || safeUser.address?.address || "",
        address: safeUser.shippingAddress?.address || safeUser.shippingAddress?.street || safeUser.address?.address || safeUser.address?.street || "",
        city: safeUser.shippingAddress?.city || safeUser.address?.city || "",
        state: safeUser.shippingAddress?.state || safeUser.address?.state || "",
        pincode: safeUser.shippingAddress?.pincode || safeUser.address?.pincode || "",
        country: safeUser.shippingAddress?.country || safeUser.address?.country || "India",
      };

      // If user document address is empty, fallback to their latest order's shipping address
      if (!effectiveShippingAddress.street && latestOrder?.shippingAddress) {
        effectiveShippingAddress = {
          name: latestOrder.shippingAddress.name || safeUser.name || "",
          phone: latestOrder.shippingAddress.phone || safeUser.phone || "",
          email: latestOrder.shippingAddress.email || safeUser.email || "",
          street: latestOrder.shippingAddress.address || latestOrder.shippingAddress.street || "",
          address: latestOrder.shippingAddress.address || latestOrder.shippingAddress.street || "",
          city: latestOrder.shippingAddress.city || "",
          state: latestOrder.shippingAddress.state || "",
          pincode: latestOrder.shippingAddress.pincode || "",
          country: latestOrder.shippingAddress.country || "India",
        };
      }

      const hasAddress = Boolean(
        effectiveShippingAddress.street ||
        effectiveShippingAddress.city ||
        effectiveShippingAddress.pincode
      );

      return {
        ...safeUser,
        shippingAddress: effectiveShippingAddress,
        hasAddress,
        ordersCount: uOrders.length,
        totalSpent,
        orders: uOrders.map((ord) => ({
          _id: ord._id,
          orderNumber: ord.orderNumber,
          totalAmount: ord.totalAmount,
          orderStatus: ord.orderStatus,
          paymentStatus: ord.paymentStatus,
          paymentMethod: ord.paymentMethod,
          itemsCount: ord.items?.length || 0,
          createdAt: ord.createdAt,
        })),
        latestOrder: latestOrder
          ? {
              orderNumber: latestOrder.orderNumber,
              createdAt: latestOrder.createdAt,
              totalAmount: latestOrder.totalAmount,
              orderStatus: latestOrder.orderStatus,
            }
          : null,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Users fetched successfully with complete address details",
      data: {
        users: enhancedUsers,
        count: enhancedUsers.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user status / role
// @route   PUT /api/admin/users/:id/status
// @access  Private/Admin
const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, isActive } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = Boolean(isActive);

    await user.save();

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: {
        user: user.toSafeObject(),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Trigger data seeding via API
// @route   POST /api/admin/seed
// @access  Private/Admin
const seedDatabase = async (req, res, next) => {
  try {
    // Count existing products
    const productCount = await Product.countDocuments();
    return res.status(200).json({
      success: true,
      message: "Database seed status verified",
      data: {
        products: productCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAdminDashboard,
  getAllOrders,
  getAdminOrderById,
  updateOrderStatus,
  getAllUsers,
  updateUserStatus,
  seedDatabase,
};
