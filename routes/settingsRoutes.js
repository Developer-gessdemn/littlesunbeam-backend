const express = require("express");
const SiteSettings = require("../models/SiteSettings");
const { protect } = require("../middleware/authMiddleware");
const { admin } = require("../middleware/adminMiddleware");

const router = express.Router();

// GET /api/settings - Public
router.get("/", async (req, res) => {
  try {
    const settings = await SiteSettings.getSettings();
    res.json({
      success: true,
      data: {
        codEnabled: settings.codEnabled !== false,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch settings",
      data: { codEnabled: true },
    });
  }
});

// PUT /api/settings - Admin only
router.put("/", protect, admin, async (req, res) => {
  try {
    const { codEnabled } = req.body;
    let settings = await SiteSettings.findOne();
    if (!settings) {
      settings = new SiteSettings({ codEnabled: codEnabled !== false });
    } else {
      if (codEnabled !== undefined) {
        settings.codEnabled = Boolean(codEnabled);
      }
    }
    await settings.save();
    res.json({
      success: true,
      message: "Settings updated successfully",
      data: {
        codEnabled: settings.codEnabled,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update settings",
    });
  }
});

module.exports = router;
