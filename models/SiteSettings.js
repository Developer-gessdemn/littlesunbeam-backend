const mongoose = require("mongoose");

const siteSettingsSchema = new mongoose.Schema(
  {
    codEnabled: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

siteSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({ codEnabled: true });
  }
  return settings;
};

const SiteSettings = mongoose.model("SiteSettings", siteSettingsSchema);
module.exports = SiteSettings;
