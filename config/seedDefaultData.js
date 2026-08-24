const User = require("../models/User");
const Product = require("../models/Product");
const Category = require("../models/Category");
const Order = require("../models/Order");

const defaultUsers = [
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
  {
    name: "Priya Sharma",
    email: "priya@example.com",
    password: "User@123456",
    phone: "+91 98765 12345",
    role: "user",
    address: {
      street: "742 Lotus Boulevard",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
      country: "India",
    },
  },
  {
    name: "Customer Demo",
    email: "customer@littlesunbeam.com",
    password: "Customer@123456",
    phone: "+91 98111 22334",
    role: "user",
    address: {
      street: "24 Park Avenue",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
      country: "India",
    },
  },
];

const defaultCategories = [
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

const defaultProducts = [
  {
    name: "Jorpeche Oversize Fit Blazer",
    description: "Expertly tailored oversize fit blazer designed for effortless elegance and maximum comfort. Crafted from premium breathable fabric with precision stitching.",
    price: 299,
    mrp: 320,
    category: "ethnic",
    categoryPill: "Blazer",
    brand: "Little Sunbeam",
    image: "https://images.unsplash.com/photo-1503919545889-aef636e10ad4?auto=format&fit=crop&w=600&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1503919545889-aef636e10ad4?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1584839610506-57c517453dd0?auto=format&fit=crop&w=600&q=80",
    ],
    colors: [
      { name: "Cream", hex: "#F5F2EB" },
      { name: "Black", hex: "#18181B" },
      { name: "Sage", hex: "#87A987" },
      { name: "Sky", hex: "#9BBEC8" },
    ],
    sizes: ["XS", "S", "M", "L", "XL", "XLL"],
    stock: 45,
    sku: "GHFT95245AAA",
    ageGroup: "0 - 3 Months",
    gender: "Unisex",
    print: "flower",
    badge: "Bestseller",
    rating: 4.8,
    reviewCount: 350,
    isFeatured: true,
    isNewArrival: true,
    tags: ["Men", "Coat", "Fashion", "Jacket", "Blazer"],
  },
  {
    name: "Ethnic Shirt - Green Kanjeevaram",
    description: "Traditional Kanjeevaram art blended with modern child-comfort fit. Includes hypoallergenic lining for sensitive newborn skin.",
    price: 949,
    mrp: 1299,
    category: "ethnic",
    categoryPill: "Ethnic Wear",
    brand: "Little Sunbeam Heritage",
    image: "https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?auto=format&fit=crop&w=600&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=80",
    ],
    colors: [
      { name: "Emerald Green", hex: "#1B4D3E" },
      { name: "Gold", hex: "#D4AF37" },
      { name: "Maroon", hex: "#800000" },
    ],
    sizes: ["XS", "S", "M", "L", "XL"],
    stock: 30,
    sku: "SUN-ETH-949",
    ageGroup: "3 - 6 Months",
    gender: "Boys",
    print: "cloud",
    badge: "Trending",
    rating: 4.9,
    reviewCount: 128,
    isFeatured: true,
    isNewArrival: true,
    tags: ["Ethnic", "Kanjeevaram", "Festive", "Kids", "Kurta"],
  },
  {
    name: "Ethnic Shirt - Chocolate Nisha",
    description: "Soft bio-washed ethnic shirt with easy snap buttons for quick and tear-free diaper changing.",
    price: 899,
    mrp: 1199,
    category: "ethnic",
    categoryPill: "Ethnic Wear",
    brand: "Little Sunbeam",
    image: "https://images.unsplash.com/photo-1503919545889-aef636e10ad4?auto=format&fit=crop&w=600&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1503919545889-aef636e10ad4?auto=format&fit=crop&w=600&q=80",
    ],
    colors: [
      { name: "Chocolate", hex: "#4A2E2B" },
      { name: "Cream", hex: "#F5F2EB" },
    ],
    sizes: ["XS", "S", "M", "L"],
    stock: 25,
    sku: "SUN-ETH-899",
    ageGroup: "6 - 12 Months",
    gender: "Boys",
    print: "animal",
    badge: "",
    rating: 4.7,
    reviewCount: 94,
    isFeatured: false,
    isNewArrival: true,
    tags: ["Chocolate", "Shirt", "Cotton", "Celebration"],
  },
  {
    name: "Ethnic Shirt - Marigold Sweety",
    description: "Bright marigold festive outfit crafted with 100% organic breathability and zero toxic chemical dyes.",
    price: 699,
    mrp: 899,
    category: "ethnic",
    categoryPill: "Casuals",
    brand: "Little Sunbeam",
    image: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=80",
    ],
    colors: [
      { name: "Marigold Yellow", hex: "#FFB800" },
      { name: "Peach", hex: "#FFCBA4" },
    ],
    sizes: ["S", "M", "L", "XL"],
    stock: 35,
    sku: "SUN-ETH-699",
    ageGroup: "1 - 2 Years",
    gender: "Unisex",
    print: "fruit",
    badge: "",
    rating: 4.8,
    reviewCount: 210,
    isFeatured: false,
    isNewArrival: false,
    tags: ["Marigold", "Festive", "Yellow", "Cotton"],
  },
  {
    name: "Ethnic Shirt - Peacock Blue",
    description: "Royal peacock blue shirt tailored for comfort, style, and festive celebrations with zero itching.",
    price: 999,
    mrp: 1299,
    category: "ethnic",
    categoryPill: "Ethnic Wear",
    brand: "Little Sunbeam",
    image: "https://images.unsplash.com/photo-1503919545889-aef636e10ad4?auto=format&fit=crop&w=600&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1503919545889-aef636e10ad4?auto=format&fit=crop&w=600&q=80",
    ],
    colors: [
      { name: "Peacock Blue", hex: "#005F73" },
      { name: "Royal Blue", hex: "#1D4ED8" },
    ],
    sizes: ["M", "L", "XL", "XLL"],
    stock: 18,
    sku: "SUN-ETH-999",
    ageGroup: "2 - 4 Years",
    gender: "Boys",
    print: "heart",
    badge: "Top Rated",
    rating: 5.0,
    reviewCount: 165,
    isFeatured: true,
    isNewArrival: false,
    tags: ["Peacock Blue", "Festive", "Kids"],
  },
  {
    name: "Sunny Muslin Swaddle - Pack of 3",
    description: "Ultra-soft double layer GOTS certified organic muslin swaddles. Becomes noticeably softer with every single wash.",
    price: 899,
    mrp: 1199,
    category: "muslin",
    categoryPill: "Muslin Essentials",
    brand: "Little Sunbeam Muslin",
    image: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=600&q=80",
    ],
    colors: [
      { name: "Sun Yellow", hex: "#FACC15" },
      { name: "Cream White", hex: "#FAFAF9" },
      { name: "Sky Blue", hex: "#BAE6FD" },
    ],
    sizes: ["One Size"],
    stock: 60,
    sku: "SUN-MUS-899",
    ageGroup: "0 - 3 Months",
    gender: "Unisex",
    print: "cloud",
    badge: "Bestseller",
    rating: 4.9,
    reviewCount: 412,
    isFeatured: true,
    isNewArrival: true,
    tags: ["Muslin", "Swaddle", "Organic", "Newborn"],
  },
  {
    name: "Newborn Hospital Kit - 14 Pieces",
    description: "Complete 14-piece newborn delivery hospital bag set. Prepared with pre-sterilized organic cotton for maximum safety during delivery.",
    price: 2499,
    mrp: 2999,
    category: "hospital",
    categoryPill: "Hospital Kit",
    brand: "Little Sunbeam Care",
    image: "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=600&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=80",
    ],
    colors: [
      { name: "Neutral Cream", hex: "#F5F2EB" },
      { name: "Soft Pink", hex: "#FBCFE8" },
      { name: "Mint Green", hex: "#A7F3D0" },
    ],
    sizes: ["0-3M"],
    stock: 20,
    sku: "SUN-HOS-2499",
    ageGroup: "0 - 3 Months",
    gender: "Unisex",
    print: "plain",
    badge: "New",
    rating: 5.0,
    reviewCount: 520,
    isFeatured: true,
    isNewArrival: true,
    tags: ["Hospital Kit", "Newborn", "Gift Box", "Essentials"],
  },
  {
    name: "Bear Ears Hooded Towel",
    description: "Plush organic terry cotton hooded towel with cute bear ears. Highly absorbent, hypoallergenic, and gentle on sensitive skin.",
    price: 749,
    mrp: 899,
    category: "towels",
    categoryPill: "Blankets & Towels",
    brand: "Little Sunbeam Bath",
    image: "https://images.unsplash.com/photo-1584839610506-57c517453dd0?auto=format&fit=crop&w=600&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1584839610506-57c517453dd0?auto=format&fit=crop&w=600&q=80",
    ],
    colors: [
      { name: "Warm Beige", hex: "#E5D9C5" },
      { name: "Snow White", hex: "#FFFFFF" },
    ],
    sizes: ["Standard"],
    stock: 40,
    sku: "SUN-TOW-749",
    ageGroup: "6 - 12 Months",
    gender: "Unisex",
    print: "animal",
    badge: "",
    rating: 4.8,
    reviewCount: 180,
    isFeatured: false,
    isNewArrival: false,
    tags: ["Towels", "Bath", "Bear Ears", "Organic"],
  },
];

const seedDefaultDataIfEmpty = async () => {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log("[Auto-Seeder] Seeding default users...");
      for (const u of defaultUsers) {
        await User.create(u);
      }
      console.log(`[Auto-Seeder] Seeded ${defaultUsers.length} initial users (Admin: admin@littlesunbeam.com, Customer: customer@littlesunbeam.com)`);
    }

    const catCount = await Category.countDocuments();
    if (catCount === 0) {
      console.log("[Auto-Seeder] Seeding default categories...");
      for (const cat of defaultCategories) {
        await Category.create(cat);
      }
      console.log(`[Auto-Seeder] Seeded ${defaultCategories.length} categories`);
    }

    const productCount = await Product.countDocuments();
    if (productCount === 0) {
      console.log("[Auto-Seeder] Seeding default products...");
      for (const prod of defaultProducts) {
        await Product.create(prod);
      }
      console.log(`[Auto-Seeder] Seeded ${defaultProducts.length} baby clothing products`);
    }
  } catch (error) {
    console.error("[Auto-Seeder Error]:", error.message);
  }
};

module.exports = { seedDefaultDataIfEmpty, defaultUsers, defaultCategories, defaultProducts };
