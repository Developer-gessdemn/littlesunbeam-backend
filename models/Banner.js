const mongoose = require("mongoose");

const bannerSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      trim: true,
    },
    badge: {
      type: String,
      default: "",
      trim: true,
    },
    heading: {
      type: String,
      required: [true, "Banner heading is required"],
      trim: true,
    },
    subtext: {
      type: String,
      default: "",
      trim: true,
    },
    primaryBtnLabel: {
      type: String,
      default: "Shop Now",
      trim: true,
    },
    primaryBtnTo: {
      type: String,
      default: "/shop",
      trim: true,
    },
    secondaryBtnLabel: {
      type: String,
      default: "",
      trim: true,
    },
    secondaryBtnTo: {
      type: String,
      default: "/shop",
      trim: true,
    },
    image: {
      type: String,
      required: [true, "Banner image URL is required"],
      trim: true,
    },
    imageAlt: {
      type: String,
      default: "Hero banner image",
      trim: true,
    },
    bgColor: {
      type: String,
      default: "",
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual id string
bannerSchema.virtual("id_str").get(function () {
  return this._id ? this._id.toHexString() : "";
});

// Pre-save hook to ensure id exists
bannerSchema.pre("save", function (next) {
  if (!this.id) {
    this.id = this._id ? this._id.toHexString() : `banner_${Date.now()}`;
  }
  next();
});

const Banner = mongoose.model("Banner", bannerSchema);
module.exports = Banner;
