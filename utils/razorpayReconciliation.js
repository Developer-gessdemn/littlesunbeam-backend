const crypto = require("crypto");
const Razorpay = require("razorpay");
const Order = require("../models/Order");
const User = require("../models/User");
const Product = require("../models/Product");
const { getRazorpayInstance } = require("../config/razorpay");

/**
 * Reconciles a single Razorpay payment entity with MongoDB Order collection.
 * If Order exists, updates paymentStatus to 'Paid' and orderStatus to 'Confirmed'.
 * If Order is missing, reconstructs and creates the Order document, linking to the User account.
 */
async function reconcileSinglePayment(payment) {
  if (!payment || !payment.id) return null;

  const paymentId = payment.id;
  const orderId = payment.order_id || payment.notes?.razorpayOrderId || "";
  const paymentStatus = payment.status === "captured" || payment.status === "authorized" ? "Paid" : payment.status === "refunded" ? "Refunded" : "Pending";
  const amountInINR = (payment.amount || 0) / 100;

  // 1. Check if an order already exists with this payment ID or order ID
  const queryConditions = [{ razorpayPaymentId: paymentId }];
  if (orderId) {
    queryConditions.push({ razorpayOrderId: orderId });
  }
  if (payment.notes?.orderNumber) {
    queryConditions.push({ orderNumber: payment.notes.orderNumber });
  }

  let dbOrder = await Order.findOne({ $or: queryConditions });

  if (dbOrder) {
    let updated = false;
    if (dbOrder.paymentStatus !== paymentStatus) {
      dbOrder.paymentStatus = paymentStatus;
      updated = true;
    }
    if (!dbOrder.razorpayPaymentId || dbOrder.razorpayPaymentId !== paymentId) {
      dbOrder.razorpayPaymentId = paymentId;
      updated = true;
    }
    if (orderId && !dbOrder.razorpayOrderId) {
      dbOrder.razorpayOrderId = orderId;
      updated = true;
    }
    if (dbOrder.orderStatus === "Pending" && paymentStatus === "Paid") {
      dbOrder.orderStatus = "Confirmed";
      updated = true;
    }
    if (updated) {
      await dbOrder.save();
    }
    return { order: dbOrder, isNew: false };
  }

  // 2. Order is missing! We need to reconstruct and recover it.
  const userEmail = (payment.email || payment.notes?.userEmail || "").trim().toLowerCase();
  const userPhone = (payment.contact || payment.notes?.userPhone || "").replace(/\D/g, "");
  const userIdFromNotes = payment.notes?.userId || "";

  let matchedUser = null;
  if (userIdFromNotes) {
    try {
      matchedUser = await User.findById(userIdFromNotes);
    } catch { }
  }
  if (!matchedUser && userEmail) {
    matchedUser = await User.findOne({ email: new RegExp(`^${userEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") });
  }
  if (!matchedUser && userPhone && userPhone.length >= 10) {
    const trailingPhone = userPhone.slice(-10);
    matchedUser = await User.findOne({ phone: new RegExp(`${trailingPhone}$`) });
  }

  // Determine Customer details
  const customerName = matchedUser?.name || payment.notes?.name || payment.notes?.customerName || userEmail.split("@")[0] || "Customer";
  const customerEmail = userEmail || matchedUser?.email || "";
  const customerPhone = userPhone || matchedUser?.phone || "";

  // Extract address info from notes or matched user
  let rawAddressStr = payment.notes?.address || "";
  let street = "";
  let city = "";
  let pincode = "";
  let state = "Tamil Nadu";

  if (rawAddressStr) {
    // e.g. "kaniyur,madhapur road, coimbatore - 3423453"
    const pinMatch = rawAddressStr.match(/\b\d{6}\b/) || rawAddressStr.match(/\b\d{7}\b/);
    if (pinMatch) pincode = pinMatch[0];
    const parts = rawAddressStr.split(/[-–,]/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      city = parts[parts.length - (pinMatch ? 2 : 1)] || "Coimbatore";
      street = parts.slice(0, parts.length - (pinMatch ? 2 : 1)).join(", ");
    } else {
      street = rawAddressStr;
      city = "Coimbatore";
    }
  }

  if (!street && matchedUser?.shippingAddress?.address) {
    street = matchedUser.shippingAddress.address || matchedUser.shippingAddress.street || "";
    city = matchedUser.shippingAddress.city || "Coimbatore";
    state = matchedUser.shippingAddress.state || "Tamil Nadu";
    pincode = matchedUser.shippingAddress.pincode || "";
  } else if (!street && matchedUser?.address?.address) {
    street = matchedUser.address.address || matchedUser.address.street || "";
    city = matchedUser.address.city || "Coimbatore";
    state = matchedUser.address.state || "Tamil Nadu";
    pincode = matchedUser.address.pincode || "";
  }

  if (!street) street = "Customer Shipping Address";
  if (!city) city = "Coimbatore";
  if (!pincode) pincode = "641659";

  // Resolve product item
  let matchedProduct = null;
  if (amountInINR === 1) {
    matchedProduct = await Product.findOne({ price: 1 });
  }
  if (!matchedProduct && payment.notes?.productId) {
    matchedProduct = await Product.findById(payment.notes.productId);
  }
  if (!matchedProduct) {
    matchedProduct = await Product.findOne({ price: amountInINR });
  }
  if (!matchedProduct) {
    matchedProduct = await Product.findOne({ isActive: true });
  }

  const orderItems = [
    {
      product: matchedProduct?._id || undefined,
      name: matchedProduct?.name || payment.description || "Baby Clothing & Essentials",
      image: matchedProduct?.image || "/favicon.png",
      price: amountInINR,
      quantity: 1,
      selectedSize: "Standard",
      selectedColor: "Default",
      variant: "Standard",
    },
  ];

  const orderCreatedTimestamp = payment.created_at ? new Date(payment.created_at * 1000) : new Date();

  // Create the recovered Order document
  const newOrder = await Order.create({
    user: matchedUser?._id || undefined,
    customerId: matchedUser ? String(matchedUser._id) : "",
    customer: {
      name: customerName,
      email: customerEmail,
      phone: customerPhone,
    },
    items: orderItems,
    shippingAddress: {
      name: customerName,
      email: customerEmail,
      phone: customerPhone,
      address: street,
      city: city,
      state: state,
      pincode: pincode,
      country: "India",
    },
    paymentMethod: "Razorpay",
    paymentStatus: paymentStatus,
    paymentDetails: {
      gateway: "Razorpay",
      transactionId: paymentId,
      paymentIntentId: orderId,
      cardLast4: "",
      amountInPaise: payment.amount || 0,
    },
    razorpayOrderId: orderId,
    razorpayPaymentId: paymentId,
    razorpayAmountInPaise: payment.amount || 0,
    orderStatus: paymentStatus === "Paid" ? "Confirmed" : "Pending",
    subtotal: amountInINR,
    discount: 0,
    shippingCharge: 0,
    tax: 0,
    totalAmount: amountInINR,
    notes: payment.notes?.notes || "Recovered via Razorpay payment synchronization",
    createdAt: orderCreatedTimestamp,
    updatedAt: new Date(),
    trackingHistory: [
      {
        status: "Order Confirmed",
        location: "Little Sunbeam Tiruppur Facility",
        description: "Payment captured via Razorpay. Order confirmed and sent to fulfillment queue.",
        date: orderCreatedTimestamp.toISOString().split("T")[0],
        time: orderCreatedTimestamp.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
        timestamp: orderCreatedTimestamp,
        updatedBy: "Razorpay Sync",
      },
    ],
  });

  return { order: newOrder, isNew: true };
}

/**
 * Scans recent payments from Razorpay API and reconciles with MongoDB Order collection.
 */
async function syncAllRazorpayPayments(count = 50) {
  const razorpay = getRazorpayInstance();
  const paymentList = await razorpay.payments.all({ count });

  const results = {
    totalChecked: paymentList.items.length,
    newlyCreated: 0,
    updated: 0,
    orders: [],
  };

  for (const p of paymentList.items) {
    // Only process successful / captured / authorized / refunded payments
    if (["captured", "authorized", "refunded"].includes(p.status)) {
      try {
        const res = await reconcileSinglePayment(p);
        if (res) {
          if (res.isNew) results.newlyCreated++;
          else results.updated++;
          results.orders.push(res.order);
        }
      } catch (err) {
        console.warn(`[Razorpay Reconciliation] Error for payment ${p.id}:`, err.message);
      }
    }
  }

  return results;
}

module.exports = {
  reconcileSinglePayment,
  syncAllRazorpayPayments,
};
