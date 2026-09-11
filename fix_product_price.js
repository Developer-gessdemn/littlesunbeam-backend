/**
 * Fix product prices directly in MongoDB bypassing mongoose middleware
 */
require("dotenv").config();
const mongoose = require("mongoose");

async function fixPricesDirectly() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const db = mongoose.connection.db;

  // Find products with price < 10 and fix them using raw DB queries
  const products = await db.collection("products").find({ price: { $lt: 10 } }).toArray();
  console.log(`Found ${products.length} products with price < 10`);

  for (const p of products) {
    console.log(`\nProduct: ${p.name}`);
    console.log(`  Current price: ${p.price}, mrp: ${p.mrp}`);

    let bestPrice = 0;
    let bestMrp = 0;

    // Check flattened variants
    if (Array.isArray(p.variants)) {
      for (const v of p.variants) {
        if (v.price && v.price > bestPrice) bestPrice = v.price;
        if (v.mrp && v.mrp > bestMrp) bestMrp = v.mrp;
      }
    }

    // Check colorVariants inventory
    if (Array.isArray(p.colorVariants)) {
      for (const cv of p.colorVariants) {
        if (Array.isArray(cv.inventory)) {
          for (const inv of cv.inventory) {
            if (inv.price && inv.price > bestPrice) bestPrice = inv.price;
            if (inv.mrp && inv.mrp > bestMrp) bestMrp = inv.mrp;
          }
        }
      }
    }

    if (bestPrice > 0) {
      const newMrp = bestMrp > bestPrice ? bestMrp : bestPrice;
      const discount = newMrp > bestPrice ? Math.round(((newMrp - bestPrice) / newMrp) * 100) : 0;

      console.log(`  Fixing: price=${bestPrice}, mrp=${newMrp}, discount=${discount}%`);

      const result = await db.collection("products").updateOne(
        { _id: p._id },
        {
          $set: {
            price: bestPrice,
            mrp: newMrp,
            sellingPrice: bestPrice,
            discount: discount,
          },
        }
      );
      console.log(`  ✅ Updated ${result.modifiedCount} document`);

      // Verify
      const updated = await db.collection("products").findOne({ _id: p._id }, { projection: { name: 1, price: 1, mrp: 1, sellingPrice: 1, discount: 1 } });
      console.log(`  Verified: price=${updated.price}, mrp=${updated.mrp}, sellingPrice=${updated.sellingPrice}, discount=${updated.discount}%`);
    } else {
      console.log(`  ⚠️  No valid variant price found, skipping`);
    }
  }

  console.log("\nDone!");
  await mongoose.disconnect();
}

fixPricesDirectly().catch((err) => {
  console.error(err);
  process.exit(1);
});
