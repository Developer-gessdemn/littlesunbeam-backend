const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    image: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    selectedSize: {
      type: String,
      default: "Standard",
    },
    selectedColor: {
      type: String,
      default: "Default",
    },
    variant: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

const orderAddressSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, default: "" },
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, default: "" },
    pincode: { type: String, required: true },
    country: { type: String, default: "India" },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: [
        (val) => val.length > 0,
        "Order must contain at least one product item",
      ],
    },
    shippingAddress: {
      type: orderAddressSchema,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["Cash on Delivery", "Online Payment", "Razorpay", "UPI", "Card", "Net Banking"],
      default: "Razorpay",
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed", "Refunded"],
      default: "Pending",
      index: true,
    },
    paymentDetails: {
      gateway: { type: String, default: "mock_gateway" },
      transactionId: { type: String, default: "" },
      paymentIntentId: { type: String, default: "" },
      cardLast4: { type: String, default: "" },
    },
    orderStatus: {
      type: String,
      enum: [
        "Pending",
        "Confirmed",
        "Processing",
        "Shipped",
        "Delivered",
        "Cancelled",
      ],
      default: "Pending",
      index: true,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    couponCode: {
      type: String,
      default: "",
    },
    shippingCharge: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    notes: {
      type: String,
      default: "",
    },
    cancelledReason: {
      type: String,
      default: "",
    },
    deliveredAt: {
      type: Date,
    },
    shippedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Generate friendly order number like ORD-94281-XXXX
orderSchema.pre("validate", function (next) {
  if (!this.orderNumber) {
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    this.orderNumber = `ORD-${randomNum}`;
  }
  next();
});

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
