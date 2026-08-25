const express = require("express");
const {
  getBanners,
  createBanner,
  updateBanner,
  syncBanners,
  deleteBanner,
} = require("../controllers/bannerController");
const { protect } = require("../middleware/authMiddleware");
const { admin } = require("../middleware/adminMiddleware");

const router = express.Router();

router.route("/")
  .get(getBanners)
  .post(protect, admin, createBanner)
  .put(protect, admin, syncBanners);

router.route("/:id")
  .put(protect, admin, updateBanner)
  .delete(protect, admin, deleteBanner);

module.exports = router;
