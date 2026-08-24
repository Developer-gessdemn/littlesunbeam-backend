const mongoose = require("mongoose");

const printSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      required: [true, "Print name is required"],
      trim: true,
    },
    emoji: {
      type: String,
      default: "✨",
      trim: true,
    },
    icon: {
      type: String,
      default: "✨",
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

// Virtual id field for compatibility
printSchema.virtual("id_str").get(function () {
  return this._id ? this._id.toHexString() : "";
});

// Pre-save to keep id, emoji, and icon in sync
printSchema.pre("save", function (next) {
  if (!this.id && this.name) {
    this.id = this.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
  }
  const symbol = this.emoji || this.icon || "✨";
  this.emoji = symbol;
  this.icon = symbol;
  next();
});

const Print = mongoose.model("Print", printSchema);
module.exports = Print;
