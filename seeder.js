const mongoose = require("mongoose");
const dotenv = require("dotenv");
const User = require("./models/User");
const Product = require("./models/Product");
const Category = require("./models/Category");
const Print = require("./models/Print");
const Cart = require("./models/Cart");
const Order = require("./models/Order");

dotenv.config();

const users = [
  {
    name: "Admin User",
    email: "admin@littlesunbeam.com",
    password: "Admin@123456",
    phone: "+91 98765 43210",
    role: "admin",
    address: {
      street: "10 Sunbeam Plaza, MG Road",
      city: "Tiruppur",
      state: "Tamil Nadu",
      pincode: "641601",
      country: "India",
    },
  },
];

const categories = [
  {
    name: "Hospital Kit",
    description: "Sterile organic newborn delivery kits, swaddles, and essentials.",
    image: "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=600&q=80",
    order: 1,
  },
  {
    name: "Muslin Baby Essentials",
    description: "Double layer ultra-soft GOTS certified organic muslin swaddles and wraps.",
    image: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=80",
    order: 2,
  },
  {
    name: "Mom Essentials",
    description: "Postpartum recovery kits, nursing pillows, and maternity wear.",
    image: "https://images.unsplash.com/photo-1555252333-9f8e92e65df9?auto=format&fit=crop&w=600&q=80",
    order: 3,
  },
  {
    name: "Blankets & Towels",
    description: "Plush hooded animal towels and organic cotton crib blankets.",
    image: "https://images.unsplash.com/photo-1584839610506-57c517453dd0?auto=format&fit=crop&w=600&q=80",
    order: 4,
  },
  {
    name: "Diapers",
    description: "Gentle reusable cloth diapers, wipes, and waterproof changing pads.",
    image: "https://images.unsplash.com/photo-1596870230751-ebdfce98ec42?auto=format&fit=crop&w=600&q=80",
    order: 5,
  },
  {
    name: "Bedding Essentials",
    description: "Soft mattress protectors, baby pillows, and breathable crib sheets.",
    image: "https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=600&q=80",
    order: 6,
  },
  {
    name: "Ethnic Wear",
    description: "Handcrafted traditional Kanjeevaram shirts, dhotis, and festive sets.",
    image: "https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?auto=format&fit=crop&w=600&q=80",
    order: 7,
  },
  {
    name: "Frocks & Dresses",
    description: "Breathable pure cotton frocks with delicate floral and fruit prints.",
    image: "https://images.unsplash.com/photo-1503919545889-aef636e10ad4?auto=format&fit=crop&w=600&q=80",
    order: 8,
  },
];

const products = [];

const importData = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/baby_clothing_shop";
    await mongoose.connect(mongoUri);
    console.log("[Seeder] Connected to MongoDB at:", mongoUri);

    // Clear existing collections safely
    await User.deleteMany({ role: { $ne: "user" } });
    await Category.deleteMany();
    await Print.deleteMany();
    console.log("[Seeder] Cleared old collections");

    // Insert Default Prints
    const defaultPrints = [
      { id: "dinosaur", name: "Dinosaur", emoji: "🦕", icon: "🦕", order: 1 },
      { id: "floral", name: "Floral", emoji: "🌸", icon: "🌸", order: 2 },
      { id: "animal", name: "Animal", emoji: "🐘", icon: "🐘", order: 3 },
      { id: "heart", name: "Heart", emoji: "❤️", icon: "❤️", order: 4 },
      { id: "strawberry", name: "Strawberry", emoji: "🍓", icon: "🍓", order: 5 },
      { id: "cloud", name: "Cloud", emoji: "☁️", icon: "☁️", order:  6 },
      { id: "star", name: "Star", emoji: "⭐", icon: "⭐", order: 7 },
      { id: "rainbow", name: "Rainbow", emoji: "🌈", icon: "🌈", order: 8 },
    ];
    const createdPrints = await Print.insertMany(defaultPrints);
    console.log(`[Seeder] Seeded ${createdPrints.length} print options`);

    // Insert Admin User if doesn't exist
    for (const u of users) {
      const existing = await User.findOne({ email: u.email });
      if (!existing) {
        await User.create(u);
      }
    }
    console.log(`[Seeder] Verified admin user account (admin@littlesunbeam.com)`);

    // Insert Categories
    for (const c of categories) {
      await Category.create(c);
    }
    console.log(`[Seeder] Seeded ${categories.length} categories`);

    console.log(`[Seeder] Seeded 0 dummy products (zero dummy data)`);
    console.log("\n[Seeder] ✅ Master configurations imported successfully!");
    process.exit(0);
  } catch (error) {
    console.error("[Seeder Error]:", error.message);
    process.exit(1);
  }
};

const destroyData = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/baby_clothing_shop";
    await mongoose.connect(mongoUri);
    console.log("[Seeder] Connected to MongoDB at:", mongoUri);

    await User.deleteMany();
    await Product.deleteMany();
    await Category.deleteMany();
    await Print.deleteMany();
    await Cart.deleteMany();
    await Order.deleteMany();

    console.log("[Seeder] 🗑️ All data destroyed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("[Seeder Error]:", error.message);
    process.exit(1);
  }
};

if (process.argv[2] === "-d") {
  destroyData();
} else {
  importData();
}
