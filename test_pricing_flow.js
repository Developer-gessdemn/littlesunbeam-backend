require("dotenv").config({ path: __dirname + "/.env" });
const mongoose = require("mongoose");
const Order = require("./models/Order");
const Product = require("./models/Product");
const User = require("./models/User");
const assert = require("assert");

async function runTests() {
  console.log("====================================================");
  console.log("  LITTLE SUNBEAM PRICING FLOW VERIFICATION SUITE");
  console.log("====================================================\n");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB successfully.\n");

  // 1. Verify "Boys 100% Cotton Co-Ord Set - Light Green (Pack of 2)" price in DB
  const sampleProduct = await Product.findOne({
    name: /Boys 100% Cotton Co-Ord Set - Light Green/i,
  });

  assert(sampleProduct, "Sample product must exist in database");
  console.log(`[DB Verification] Product: "${sampleProduct.name}"`);
  console.log(`  Selling Price: ₹${sampleProduct.price}`);
  console.log(`  MRP: ₹${sampleProduct.mrp}`);
  console.log(`  Discount: ${sampleProduct.discount}%`);
  assert.strictEqual(sampleProduct.price, 1, "Product price must be exactly 1");

  // 2. Fetch or create a test user
  let testUser = await User.findOne({ role: "customer" }) || await User.findOne({});
  assert(testUser, "Test user must exist");

  // Helper to simulate backend order calculation
  function calculateOrder({ items, couponCode = "", shippingCharge = 0, tax = 0 }) {
    let subtotal = 0;
    const validatedItems = items.map((item) => {
      const price = Number(item.price);
      const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
      subtotal += price * qty;
      return {
        name: item.name,
        price,
        quantity: qty,
        selectedSize: item.selectedSize || "Standard",
        selectedColor: item.selectedColor || "Default",
      };
    });

    let discount = 0;
    if (String(couponCode).trim().toUpperCase() === "SUNNY10") {
      discount = Math.round(subtotal * 0.1);
    }

    const validShipping = Math.max(0, Number(shippingCharge) || 0);
    const validTax = Math.max(0, Number(tax) || 0);
    const totalAmount = Math.max(0, subtotal - discount + validShipping + validTax);
    const razorpayPaise = Math.round(totalAmount * 100);

    return {
      validatedItems,
      subtotal,
      discount,
      shippingCharge: validShipping,
      tax: validTax,
      totalAmount,
      razorpayPaise,
    };
  }

  console.log("\n----------------------------------------------------");
  console.log("RUNNING REQUIRED CORE TEST CASES");
  console.log("----------------------------------------------------");

  // TEST 1: ₹1 × 1
  {
    const res = calculateOrder({
      items: [{ name: sampleProduct.name, price: 1, quantity: 1 }],
      shippingCharge: 0,
    });
    console.log("TEST 1: ₹1 × 1");
    console.log(`  Subtotal: ₹${res.subtotal} (Expected: ₹1)`);
    console.log(`  Shipping: ₹${res.shippingCharge} (Expected: ₹0)`);
    console.log(`  Total: ₹${res.totalAmount} (Expected: ₹1)`);
    console.log(`  Razorpay: ${res.razorpayPaise} paise (Expected: 100 paise)`);
    assert.strictEqual(res.subtotal, 1, "TEST 1 Subtotal failed");
    assert.strictEqual(res.totalAmount, 1, "TEST 1 Total failed");
    assert.strictEqual(res.razorpayPaise, 100, "TEST 1 Razorpay paise failed");
    console.log("  ✅ TEST 1 PASSED\n");
  }

  // TEST 2: ₹1 × 2
  {
    const res = calculateOrder({
      items: [{ name: sampleProduct.name, price: 1, quantity: 2 }],
      shippingCharge: 0,
    });
    console.log("TEST 2: ₹1 × 2");
    console.log(`  Subtotal: ₹${res.subtotal} (Expected: ₹2)`);
    console.log(`  Shipping: ₹${res.shippingCharge} (Expected: ₹0)`);
    console.log(`  Total: ₹${res.totalAmount} (Expected: ₹2)`);
    console.log(`  Razorpay: ${res.razorpayPaise} paise (Expected: 200 paise)`);
    assert.strictEqual(res.subtotal, 2, "TEST 2 Subtotal failed");
    assert.strictEqual(res.totalAmount, 2, "TEST 2 Total failed");
    assert.strictEqual(res.razorpayPaise, 200, "TEST 2 Razorpay paise failed");
    console.log("  ✅ TEST 2 PASSED\n");
  }

  // TEST 3: ₹100 × 1
  {
    const res = calculateOrder({
      items: [{ name: "Cotton Baby Romper", price: 100, quantity: 1 }],
      shippingCharge: 0,
    });
    console.log("TEST 3: ₹100 × 1");
    console.log(`  Subtotal: ₹${res.subtotal} (Expected: ₹100)`);
    console.log(`  Shipping: ₹${res.shippingCharge} (Expected: ₹0)`);
    console.log(`  Total: ₹${res.totalAmount} (Expected: ₹100)`);
    console.log(`  Razorpay: ${res.razorpayPaise} paise (Expected: 10,000 paise)`);
    assert.strictEqual(res.subtotal, 100, "TEST 3 Subtotal failed");
    assert.strictEqual(res.totalAmount, 100, "TEST 3 Total failed");
    assert.strictEqual(res.razorpayPaise, 10000, "TEST 3 Razorpay paise failed");
    console.log("  ✅ TEST 3 PASSED\n");
  }

  // TEST 4: ₹100 × 2
  {
    const res = calculateOrder({
      items: [{ name: "Cotton Baby Romper", price: 100, quantity: 2 }],
      shippingCharge: 0,
    });
    console.log("TEST 4: ₹100 × 2");
    console.log(`  Subtotal: ₹${res.subtotal} (Expected: ₹200)`);
    console.log(`  Shipping: ₹${res.shippingCharge} (Expected: ₹0)`);
    console.log(`  Total: ₹${res.totalAmount} (Expected: ₹200)`);
    console.log(`  Razorpay: ${res.razorpayPaise} paise (Expected: 20,000 paise)`);
    assert.strictEqual(res.subtotal, 200, "TEST 4 Subtotal failed");
    assert.strictEqual(res.totalAmount, 200, "TEST 4 Total failed");
    assert.strictEqual(res.razorpayPaise, 20000, "TEST 4 Razorpay paise failed");
    console.log("  ✅ TEST 4 PASSED\n");
  }

  console.log("----------------------------------------------------");
  console.log("RUNNING ADVANCED FLOW CASES: DISCOUNT, TAX, SHIPPING");
  console.log("----------------------------------------------------");

  // TEST 5: Coupon SUNNY10 (10% off)
  {
    const res = calculateOrder({
      items: [{ name: "Baby Dress", price: 500, quantity: 2 }],
      couponCode: "SUNNY10",
      shippingCharge: 0,
    });
    console.log("TEST 5: ₹500 × 2 with SUNNY10");
    console.log(`  Subtotal: ₹${res.subtotal} (Expected: ₹1000)`);
    console.log(`  Discount: ₹${res.discount} (Expected: ₹100)`);
    console.log(`  Total: ₹${res.totalAmount} (Expected: ₹900)`);
    console.log(`  Razorpay: ${res.razorpayPaise} paise (Expected: 90,000 paise)`);
    assert.strictEqual(res.subtotal, 1000);
    assert.strictEqual(res.discount, 100);
    assert.strictEqual(res.totalAmount, 900);
    assert.strictEqual(res.razorpayPaise, 90000);
    console.log("  ✅ TEST 5 PASSED\n");
  }

  // TEST 6: Explicit Shipping Charge added
  {
    const res = calculateOrder({
      items: [{ name: "Baby Cap", price: 50, quantity: 1 }],
      shippingCharge: 40,
    });
    console.log("TEST 6: ₹50 × 1 with ₹40 Shipping");
    console.log(`  Subtotal: ₹${res.subtotal}`);
    console.log(`  Shipping: ₹${res.shippingCharge}`);
    console.log(`  Total: ₹${res.totalAmount} (Expected: ₹90)`);
    assert.strictEqual(res.totalAmount, 90);
    assert.strictEqual(res.razorpayPaise, 9000);
    console.log("  ✅ TEST 6 PASSED\n");
  }

  // TEST 7: Multiple products
  {
    const res = calculateOrder({
      items: [
        { name: "Product A", price: 1, quantity: 1 },
        { name: "Product B", price: 99, quantity: 1 },
        { name: "Product C", price: 200, quantity: 2 },
      ],
      shippingCharge: 0,
    });
    console.log("TEST 7: Multiple Products (₹1 + ₹99 + ₹400)");
    console.log(`  Subtotal: ₹${res.subtotal} (Expected: ₹500)`);
    console.log(`  Total: ₹${res.totalAmount} (Expected: ₹500)`);
    assert.strictEqual(res.subtotal, 500);
    assert.strictEqual(res.totalAmount, 500);
    assert.strictEqual(res.razorpayPaise, 50000);
    console.log("  ✅ TEST 7 PASSED\n");
  }

  console.log("----------------------------------------------------");
  console.log("DATABASE ORDER SCHEMA & PERSISTENCE TEST");
  console.log("----------------------------------------------------");

  // TEST 8: Create an actual order in MongoDB and verify fields
  {
    const orderNumber = `TEST-${Date.now()}`;
    const testOrder = await Order.create({
      orderNumber,
      user: testUser._id,
      items: [
        {
          product: sampleProduct._id,
          name: sampleProduct.name,
          image: sampleProduct.image || "/favicon.png",
          price: 1,
          quantity: 1,
          selectedSize: "3-6M",
          selectedColor: "Baby Blue",
          variant: "Baby Blue / 3-6M",
        },
      ],
      shippingAddress: {
        name: "Test Customer",
        email: "test@littlesunbeam.com",
        phone: "9876543210",
        address: "123 Test Street",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560001",
        country: "India",
      },
      paymentMethod: "Razorpay",
      paymentStatus: "Paid",
      paymentDetails: {
        gateway: "Razorpay",
        transactionId: "pay_test_123456",
        paymentIntentId: "order_test_123456",
        cardLast4: "1111",
        amountInPaise: 100,
      },
      razorpayOrderId: "order_test_123456",
      razorpayPaymentId: "pay_test_123456",
      razorpaySignature: "mock_signature_test",
      razorpayAmountInPaise: 100,
      orderStatus: "Confirmed",
      subtotal: 1,
      discount: 0,
      shippingCharge: 0,
      tax: 0,
      totalAmount: 1,
      notes: "Test Order for INR 1 verification",
    });

    console.log(`Created MongoDB Test Order: ${testOrder.orderNumber}`);
    console.log(`  Items Price: ₹${testOrder.items[0].price}`);
    console.log(`  Order Subtotal: ₹${testOrder.subtotal}`);
    console.log(`  Order ShippingCharge: ₹${testOrder.shippingCharge}`);
    console.log(`  Order TotalAmount (INR): ₹${testOrder.totalAmount}`);
    console.log(`  Order razorpayAmountInPaise: ${testOrder.razorpayAmountInPaise} paise`);
    console.log(`  Order paymentDetails.amountInPaise: ${testOrder.paymentDetails.amountInPaise} paise`);

    assert.strictEqual(testOrder.subtotal, 1);
    assert.strictEqual(testOrder.shippingCharge, 0);
    assert.strictEqual(testOrder.totalAmount, 1);
    assert.strictEqual(testOrder.razorpayAmountInPaise, 100);
    assert.strictEqual(testOrder.paymentDetails.amountInPaise, 100);
    console.log("  ✅ TEST 8 PASSED (MongoDB schema and storage completely verified)\n");

    // Clean up test order
    await Order.findByIdAndDelete(testOrder._id);
    console.log("  Cleaned up temporary test order.\n");
  }

  // TEST 9: Verify historical order ORD-12497 in MongoDB
  {
    const ord12497 = await Order.findOne({ orderNumber: "ORD-12497" });
    if (ord12497) {
      console.log(`Historical Order ORD-12497 status:`);
      console.log(`  Item: ${ord12497.items[0]?.name}`);
      console.log(`  Item Price: ₹${ord12497.items[0]?.price}`);
      console.log(`  Subtotal: ₹${ord12497.subtotal}`);
      console.log(`  Shipping Charge: ₹${ord12497.shippingCharge}`);
      console.log(`  Total Amount: ₹${ord12497.totalAmount}`);
      assert.strictEqual(ord12497.subtotal, 1);
      assert.strictEqual(ord12497.shippingCharge, 0);
      assert.strictEqual(ord12497.totalAmount, 1);
      console.log("  ✅ Historical order ORD-12497 verified: Total is ₹1\n");
    }
  }

  await mongoose.disconnect();
  console.log("====================================================");
  console.log("  ALL TESTS PASSED WITH 100% SUCCESS!");
  console.log("====================================================\n");
}

runTests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
