const express = require("express");
const upload = require("../middleware/uploadMiddleware");
const {
  uploadSingleImage,
  uploadMultipleImages,
} = require("../controllers/uploadController");
const { protect } = require("../middleware/authMiddleware");
const { admin } = require("../middleware/adminMiddleware");

const router = express.Router();

router.post("/single", protect, admin, upload.single("image"), uploadSingleImage);
router.post("/multiple", protect, admin, upload.array("images", 10), uploadMultipleImages);

module.exports = router;
