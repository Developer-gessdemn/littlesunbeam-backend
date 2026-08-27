const express = require("express");
const upload = require("../middleware/uploadMiddleware");
const {
  uploadSingleImage,
  uploadMultipleImages,
  resolveInstagramMedia,
} = require("../controllers/uploadController");
const { protect } = require("../middleware/authMiddleware");
const { admin } = require("../middleware/adminMiddleware");

const router = express.Router();

// Resolve Instagram Reel/Post URL to direct playable video URL via Meta API
router.post("/resolve-instagram", resolveInstagramMedia);


// General single file upload (supports 'image', 'video', 'file')
router.post(
  "/single",
  protect,
  admin,
  (req, res, next) => {
    upload.fields([
      { name: "image", maxCount: 1 },
      { name: "video", maxCount: 1 },
      { name: "file", maxCount: 1 },
    ])(req, res, (err) => {
      if (err) return next(err);
      const file = req.files?.image?.[0] || req.files?.video?.[0] || req.files?.file?.[0];
      req.file = file;
      next();
    });
  },
  uploadSingleImage
);

// Video single upload alias
router.post(
  "/video",
  protect,
  admin,
  (req, res, next) => {
    upload.fields([
      { name: "video", maxCount: 1 },
      { name: "file", maxCount: 1 },
      { name: "image", maxCount: 1 },
    ])(req, res, (err) => {
      if (err) return next(err);
      const file = req.files?.video?.[0] || req.files?.file?.[0] || req.files?.image?.[0];
      req.file = file;
      next();
    });
  },
  uploadSingleImage
);

// General multiple files upload (supports 'images', 'videos', 'files')
router.post(
  "/multiple",
  protect,
  admin,
  (req, res, next) => {
    upload.fields([
      { name: "images", maxCount: 10 },
      { name: "videos", maxCount: 10 },
      { name: "files", maxCount: 10 },
    ])(req, res, (err) => {
      if (err) return next(err);
      const files = [
        ...(req.files?.images || []),
        ...(req.files?.videos || []),
        ...(req.files?.files || []),
      ];
      req.files = files;
      next();
    });
  },
  uploadMultipleImages
);

// Multiple videos upload alias
router.post(
  "/videos",
  protect,
  admin,
  (req, res, next) => {
    upload.fields([
      { name: "videos", maxCount: 10 },
      { name: "files", maxCount: 10 },
      { name: "images", maxCount: 10 },
    ])(req, res, (err) => {
      if (err) return next(err);
      const files = [
        ...(req.files?.videos || []),
        ...(req.files?.files || []),
        ...(req.files?.images || []),
      ];
      req.files = files;
      next();
    });
  },
  uploadMultipleImages
);

module.exports = router;

