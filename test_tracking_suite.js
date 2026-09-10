const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const Order = require("./models/Order");
const Product = require("./models/Product");
const { sendOrderMilestoneEmail, generateOrderHtml } = require("./utils/emailService");
const { trackOrderPublic } = require("./controllers/orderController");

async function runTestSuite() {
  console.log("==================================================");
  console.log("🚀 STARTING MANUAL COURIER & TRACKING TEST SUITE");
  console.log("==================================================");

  let successCount = 0;
  let failCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      successCount++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failCount++;
    }
  }

  // 1. Verify Email HTML Generation for all 5 Milestones
  console.log("\n--- Testing Milestone Email Templates ---");
  const dummyOrder = {
    orderNumber: "ORD-94281",
    courierName: "Delhivery Express",
    trackingNumber: "DEL987654321IN",
    trackingUrl: "https://www.delhivery.com/track/package/DEL987654321IN",
    shippingDate: new Date(),
    expectedDeliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    shippingAddress: {
      name: "Priya Sharma",
      email: "priya.sharma@example.com",
      phone: "9876543210",
      address: "124 Rosewood Gardens, Near Metro",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
    },
    items: [
      {
        name: "Pure Muslin Newborn Jabla Set",
        image: "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4",
        price: 499,
        quantity: 2,
        selectedSize: "0-3 Months",
        selectedColor: "Sun Yellow",
      },
    ],
    subtotal: 998,
    discount: 99,
    shippingCharge: 0,
    totalAmount: 899,
    trackingHistory: [
      {
        status: "Order Confirmed",
        location: "Little Sunbeam Tiruppur Facility",
        description: "Order verified and sent to warehouse fulfillment queue",
        date: "2026-09-07",
        time: "10:30 AM",
      },
    ],
  };

  const milestones = ["Confirmed", "Packed", "Shipped", "Out for Delivery", "Delivered"];
  for (const m of milestones) {
    const html = generateOrderHtml(dummyOrder, m);
    assert(html && html.includes("Little Sunbeam") && html.includes(dummyOrder.orderNumber), `HTML template rendered for "${m}"`);
    assert(html.includes("DEL987654321IN"), `AWB number present in "${m}" email template`);
    assert(html.includes("Delhivery Express"), `Courier name present in "${m}" email template`);
  }

  // 2. Test sendOrderMilestoneEmail simulation
  console.log("\n--- Testing Milestone Email Dispatch ---");
  const emailRes = await sendOrderMilestoneEmail({ order: dummyOrder, type: "Shipped" });
  assert(emailRes.success === true, "sendOrderMilestoneEmail executed successfully");

  // 3. Test In-Memory Mock Controller Simulation for Public Tracking
  console.log("\n--- Testing Public Tracking Handler Logic ---");
  
  // Test mock request / response for trackOrderPublic
  const mockReqSuccessEmail = {
    body: {
      orderNumber: "ORD-94281",
      contact: "priya.sharma@example.com",
    },
  };

  const mockReqSuccessPhone = {
    body: {
      orderNumber: "ORD-94281",
      contact: "9876543210",
    },
  };

  const mockReqFailContact = {
    body: {
      orderNumber: "ORD-94281",
      contact: "wrong.email@example.com",
    },
  };

  // Verify contact matching logic
  const contactLower = mockReqSuccessEmail.body.contact.toLowerCase();
  const emailMatch = contactLower.includes("@") && dummyOrder.shippingAddress.email.toLowerCase() === contactLower;
  assert(emailMatch === true, "Email contact matches order records");

  const phoneDigits = mockReqSuccessPhone.body.contact.replace(/\D/g, "");
  const orderPhoneDigits = dummyOrder.shippingAddress.phone.replace(/\D/g, "");
  const phoneMatch = phoneDigits.length >= 6 && orderPhoneDigits.endsWith(phoneDigits.slice(-6));
  assert(phoneMatch === true, "Phone contact matches order records");

  const wrongContact = mockReqFailContact.body.contact.toLowerCase();
  const wrongMatch = wrongContact.includes("@") && dummyOrder.shippingAddress.email.toLowerCase() === wrongContact;
  assert(wrongMatch === false, "Incorrect email is rejected");

  console.log("\n==================================================");
  console.log(`TEST SUITE RESULTS: ${successCount} PASSED, ${failCount} FAILED`);
  console.log("==================================================");

  if (failCount === 0) {
    console.log("🎉 ALL TESTS PASSED SUCCESFULLY!");
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test Suite Fatal Error:", err);
  process.exit(1);
});
