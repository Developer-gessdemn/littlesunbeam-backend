require("dotenv").config({ path: __dirname + "/.env" });
const mongoose = require("mongoose");
const Order = require("./models/Order");

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Locate the specific order ORD-12497
    const order = await Order.findOne({ orderNumber: "ORD-12497" });
    if (!order) {
      console.log("Order ORD-12497 not found. Searching for any order with items.price = 1 and shippingCharge = 99...");
      const orders = await Order.find({ "items.price": 1, shippingCharge: 99, totalAmount: 100 });
      console.log(`Found ${orders.length} order(s) matching criteria`);
      for (const o of orders) {
        console.log(`Updating order ${o.orderNumber}: subtotal=${o.subtotal}, shippingCharge=${o.shippingCharge}, totalAmount=${o.totalAmount} -> shippingCharge=0, totalAmount=${o.subtotal}`);
        o.shippingCharge = 0;
        o.totalAmount = o.subtotal;
        await o.save();
        console.log(`Updated ${o.orderNumber}`);
      }
    } else {
      console.log(`Found order ${order.orderNumber}:`);
      console.log(`  Current subtotal: ${order.subtotal}`);
      console.log(`  Current shippingCharge: ${order.shippingCharge}`);
      console.log(`  Current totalAmount: ${order.totalAmount}`);

      if (order.shippingCharge === 99 && order.totalAmount === 100 && order.subtotal === 1) {
        order.shippingCharge = 0;
        order.totalAmount = 1;
        order.tax = 0;
        order.razorpayAmountInPaise = 100;
        if (order.paymentDetails) {
          order.paymentDetails.amountInPaise = 100;
        }
        await order.save();
        console.log("✅ Successfully corrected order ORD-12497: shippingCharge=0, totalAmount=1, razorpayAmountInPaise=100");
      } else {
        console.log("Order already has expected values or has different totals:", {
          subtotal: order.subtotal,
          shippingCharge: order.shippingCharge,
          totalAmount: order.totalAmount,
        });
      }
    }

    await mongoose.disconnect();
    console.log("Migration finished.");
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
}

migrate();
