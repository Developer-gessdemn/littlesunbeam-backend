const mongoose = require("mongoose");
const slugify = require("slugify");

const colorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    hex: { type: String, required: true, trim: true, default: "#E5E7EB" },
  },
  { _id: false }
);

const colorVariantImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: false }
);

const colorSizeInventorySchema = new mongoose.Schema(
  {
    size: { type: String, required: true, trim: true },
    stock: { type: Number, default: 0, min: 0 },
    sku: { type: String, trim: true, uppercase: true },
    price: { type: Number, min: 0 },
    mrp: { type: Number, min: 0 },
  },
  { _id: true }
);

const colorVariantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    displayName: { type: String, trim: true },
    hex: { type: String, trim: true, default: "#E5E7EB" },
    images: { type: [colorVariantImageSchema], default: [] },
    sizes: { type: [String], default: [] },
    inventory: { type: [colorSizeInventorySchema], default: [] },
  },
  { _id: true }
);

const variantSchema = new mongoose.Schema(
  {
    sku: { type: String, trim: true, uppercase: true },
    size: { type: String, trim: true },
    color: { type: String, trim: true },
    colorId: { type: mongoose.Schema.Types.ObjectId },
    stock: { type: Number, default: 0, min: 0 },
    price: { type: Number, min: 0 },
    mrp: { type: Number, min: 0 },
    image: { type: String, default: "" },
  },
  { _id: true }
);

const productImagesSchema = new mongoose.Schema(
  {
    main: { type: String, default: "" },
    front: { type: String, default: "" },
    back: { type: String, default: "" },
    side: { type: String, default: "" },
    model: { type: String, default: "" },
    additional: { type: [String], default: [] },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: [200, "Product name cannot exceed 200 characters"],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      index: true,
    },
    sku: {
      type: String,
      required: [true, "SKU is required"],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    brand: {
      type: String,
      trim: true,
      default: "Little Sunbeam",
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
      index: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    categoryPill: {
      type: String,
      trim: true,
      default: "",
    },
    subCategory: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    subCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    description: {
      type: String,
      required: [true, "Product description is required"],
      trim: true,
    },
    details: {
      type: String,
      trim: true,
      default: "",
    },

    // Baby Clothing Specifics (Optional fields)
    gender: {
      type: String,
      enum: ["Boy", "Girl", "Unisex", "Boys", "Girls"],
      default: "Unisex",
      index: true,
    },
    ageGroup: {
      type: String,
      trim: true,
      default: "0 - 3 Months",
      index: true,
    },
    sizes: {
      type: [String],
      default: [],
    },
    colors: {
      type: [colorSchema],
      default: [],
    },
    fabric: {
      type: String,
      trim: true,
      default: "",
    },
    pattern: {
      type: String,
      trim: true,
      default: "",
    },
    print: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    prints: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Print",
      },
    ],
    sleeveType: {
      type: String,
      trim: true,
      default: "",
    },
    neckType: {
      type: String,
      trim: true,
      default: "",
    },
    fitType: {
      type: String,
      trim: true,
      default: "",
    },
    season: {
      type: String,
      trim: true,
      default: "",
    },

    // Pricing
    price: {
      type: Number,
      required: [true, "Selling price is required"],
      min: [0, "Price cannot be negative"],
    },
    mrp: {
      type: Number,
      default: function () {
        return this.price;
      },
      min: [0, "MRP cannot be negative"],
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    gst: {
      type: Number,
      default: 5,
      min: 0,
    },

    // Inventory (Calculated from colorVariants inventory when present)
    stock: {
      type: Number,
      required: [true, "Stock quantity is required"],
      default: 0,
      min: [0, "Stock cannot be negative"],
    },
    lowStockThreshold: {
      type: Number,
      default: 10,
      min: 0,
    },
    stockStatus: {
      type: String,
      enum: ["In Stock", "Low Stock", "Out of Stock"],
      default: "In Stock",
    },

    // Images
    image: {
      type: String,
      default: "",
    },
    gallery: {
      type: [String],
      default: [],
    },
    images: {
      type: productImagesSchema,
      default: () => ({}),
    },

    // Color-based Product Variants (Color -> Images + Sizes + Size-wise Inventory)
    colorVariants: {
      type: [colorVariantSchema],
      default: [],
    },

    // Flattened Variants for fast lookups & backward compatibility
    variants: {
      type: [variantSchema],
      default: [],
    },

    // Additional Info
    careInstructions: {
      type: String,
      trim: true,
      default: "Machine wash cold with gentle baby detergent. Do not bleach. Tumble dry low.",
    },
    washCare: {
      type: String,
      trim: true,
      default: "Gentle Hand/Machine Wash",
    },
    countryOfOrigin: {
      type: String,
      trim: true,
      default: "India",
    },
    manufacturer: {
      type: String,
      trim: true,
      default: "Little Sunbeam Kidswear",
    },
    productWeight: {
      type: String,
      trim: true,
      default: "150g",
    },
    returnEligibility: {
      type: String,
      trim: true,
      default: "7-Day Return & Exchange Available",
    },
    tags: {
      type: [String],
      default: [],
    },
    badge: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["Active", "Draft", "Out of Stock", "Archived"],
      default: "Active",
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    isNewArrival: {
      type: Boolean,
      default: true,
      index: true,
    },
    rating: {
      type: Number,
      default: 5.0,
      min: [0, "Rating cannot be less than 0"],
      max: [5, "Rating cannot be more than 5"],
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual id field for frontend compatibility
productSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

// Pre-save hooks for slug, gallery sync, discount, colorVariants sync & stockStatus
productSchema.pre("save", function (next) {
  if (this.isModified("name") || !this.slug) {
    this.slug =
      slugify(this.name, { lower: true, strict: true }) +
      "-" +
      Math.random().toString(36).substring(2, 6);
  }

  // Calculate discount percentage
  if (this.mrp && this.price !== undefined && this.mrp > this.price) {
    this.discount = Math.round(((this.mrp - this.price) / this.mrp) * 100);
  } else {
    this.discount = 0;
  }

  // If colorVariants are provided, sync total stock, colors, sizes, and flattened variants
  if (Array.isArray(this.colorVariants) && this.colorVariants.length > 0) {
    let totalStockFromVariants = 0;
    const allColors = [];
    const allSizesSet = new Set();
    const flattenedVariants = [];
    const allColorImages = [];

    this.colorVariants.forEach((cv) => {
      const colorName = cv.name || "Default";
      const colorHex = cv.hex || "#E5E7EB";
      allColors.push({ name: colorName, hex: colorHex });

      // Collect images for this color
      const cvImages = Array.isArray(cv.images) ? cv.images : [];
      let primaryImg = "";
      cvImages.forEach((imgObj) => {
        const url = typeof imgObj === "string" ? imgObj : imgObj.url;
        if (url) {
          allColorImages.push(url);
          if (typeof imgObj === "object" && imgObj.isPrimary) {
            primaryImg = url;
          }
        }
      });
      if (!primaryImg && cvImages[0]) {
        primaryImg = typeof cvImages[0] === "string" ? cvImages[0] : cvImages[0].url;
      }

      // Collect inventory items
      if (Array.isArray(cv.inventory) && cv.inventory.length > 0) {
        cv.inventory.forEach((inv) => {
          const sz = inv.size || "Standard";
          const st = Number(inv.stock) || 0;
          totalStockFromVariants += st;
          allSizesSet.add(sz);

          flattenedVariants.push({
            _id: inv._id,
            sku: inv.sku || `${this.sku || "SUN"}-${colorName.substring(0, 3).toUpperCase()}-${sz.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()}`,
            color: colorName,
            colorId: cv._id,
            size: sz,
            stock: st,
            price: inv.price !== undefined ? inv.price : this.price,
            mrp: inv.mrp !== undefined ? inv.mrp : (this.mrp || this.price),
            image: primaryImg || this.image || "",
          });
        });
      } else if (Array.isArray(cv.sizes) && cv.sizes.length > 0) {
        cv.sizes.forEach((sz) => {
          allSizesSet.add(sz);
        });
      }
    });

    this.stock = totalStockFromVariants;
    this.colors = allColors;
    this.sizes = Array.from(allSizesSet);
    this.variants = flattenedVariants;

    // Auto-sync main image and gallery from color variants if not set or empty
    if ((!this.image || this.image.trim() === "") && allColorImages.length > 0) {
      this.image = allColorImages[0];
    }
    if ((!this.gallery || this.gallery.length === 0) && allColorImages.length > 0) {
      this.gallery = Array.from(new Set(allColorImages));
    }
  } else if (Array.isArray(this.variants) && this.variants.length > 0) {
    // If flat variants are provided without colorVariants hierarchy, sum stock
    const sumStock = this.variants.reduce((acc, v) => acc + (Number(v.stock) || 0), 0);
    if (sumStock > 0 || this.stock === 0) {
      this.stock = sumStock;
    }
  }

  // Calculate stock status
  const stockNum = Number(this.stock) || 0;
  const threshold = Number(this.lowStockThreshold) || 10;
  if (stockNum <= 0) {
    this.stockStatus = "Out of Stock";
  } else if (stockNum <= threshold) {
    this.stockStatus = "Low Stock";
  } else {
    this.stockStatus = "In Stock";
  }

  // Sync images and gallery
  if (!this.gallery || this.gallery.length === 0) {
    if (this.image) this.gallery = [this.image];
  } else if (this.image && !this.gallery.includes(this.image)) {
    this.gallery.unshift(this.image);
  }

  if (this.images) {
    if (!this.images.main && this.image) {
      this.images.main = this.image;
    }
  }

  // Sync isActive with status
  if (this.status === "Draft" || this.status === "Archived") {
    this.isActive = false;
  } else {
    this.isActive = true;
  }

  next();
});

// Text index for fast full-text searching
productSchema.index({
  name: "text",
  description: "text",
  category: "text",
  subCategory: "text",
  brand: "text",
  sku: "text",
  tags: "text",
});

const Product = mongoose.model("Product", productSchema);
module.exports = Product;

