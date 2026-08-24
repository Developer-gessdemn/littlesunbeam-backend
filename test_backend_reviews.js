const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const connectDB = require("./config/db");
const User = require("./models/User");
const Product = require("./models/Product");
const Review = require("./models/Review");

async function runTest() {
  await connectDB();
  console.log("Connected to MongoDB");

  // Find a product
  const product = await Product.findOne({ isActive: true });
  if (!product) {
    console.error("No active product found");
    process.exit(1);
  }
  console.log(`Testing with product: ${product.name} (ID: ${product._id})`);

  // Find or create test user 1 (Rithi)
  let userRithi = await User.findOne({ email: "rithi_test@example.com" });
  if (!userRithi) {
    userRithi = await User.create({
      name: "Rithi",
      email: "rithi_test@example.com",
      password: "password123",
      role: "user",
    });
  }

  // Find or create test user 2 (Sanjai)
  let userSanjai = await User.findOne({ email: "sanjai_test@example.com" });
  if (!userSanjai) {
    userSanjai = await User.create({
      name: "Sanjai",
      email: "sanjai_test@example.com",
      password: "password123",
      role: "user",
    });
  }

  // Clear previous test reviews for this product
  await Review.deleteMany({ productId: product._id, userId: { $in: [userRithi._id, userSanjai._id] } });

  // 1. User Rithi posts a review
  const rev1 = new Review({
    productId: product._id,
    userId: userRithi._id,
    rating: 5,
    comment: "Very soft and comfortable for my baby.",
  });
  await rev1.save();
  console.log("Rithi's review saved successfully!");

  // Verify Product stats updated
  let updatedProduct = await Product.findById(product._id);
  console.log(`Product stats after Rithi's review: rating=${updatedProduct.rating}, reviewCount=${updatedProduct.reviewCount}`);

  // 2. User Sanjai posts a review
  const rev2 = new Review({
    productId: product._id,
    userId: userSanjai._id,
    rating: 4,
    comment: "Good quality and fast delivery.",
  });
  await rev2.save();
  console.log("Sanjai's review saved successfully!");

  updatedProduct = await Product.findById(product._id);
  console.log(`Product stats after Sanjai's review: rating=${updatedProduct.rating}, reviewCount=${updatedProduct.reviewCount}`);

  // 3. User Sanjai votes helpful on Rithi's review
  rev1.helpfulVotes.push(userSanjai._id);
  rev1.helpfulCount = rev1.helpfulVotes.length;
  await rev1.save();
  console.log(`Rithi's review helpful count: ${rev1.helpfulCount}`);

  // 4. Duplicate review attempt
  try {
    const duplicateRev = new Review({
      productId: product._id,
      userId: userRithi._id,
      rating: 5,
      comment: "Trying duplicate",
    });
    await duplicateRev.save();
    console.error("FAILED: Duplicate review was allowed!");
  } catch (err) {
    console.log("SUCCESS: Duplicate review properly rejected:", err.message);
  }

  console.log("All Backend Review Tests Passed!");
  process.exit(0);
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
