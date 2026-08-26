const path = require("path");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(".", "");
    const isVideo = ["mp4", "mov", "webm", "m4v"].includes(ext) || (file.mimetype && file.mimetype.startsWith("video/"));
    return {
      folder: "sunny-baby-shop",
      resource_type: isVideo ? "video" : "auto",
      allowed_formats: ["jpg", "jpeg", "png", "webp", "gif", "svg", "mp4", "mov", "webm"],
    };
  },
});

function checkFileType(file, cb) {
  const filetypes = /jpg|jpeg|png|webp|gif|svg|mp4|mov|webm/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = /image\/(jpeg|jpg|png|webp|gif|svg\+xml)|video\/(mp4|quicktime|webm|mov|x-msvideo)/.test(file.mimetype);

  if (extname || mimetype) {
    return cb(null, true);
  } else {
    cb(new Error("Supported formats: Images (jpg, jpeg, png, webp, gif, svg) and Videos (mp4, mov, webm)"));
  }
}

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max for videos & images
  fileFilter(req, file, cb) {
    checkFileType(file, cb);
  },
});

module.exports = upload;

