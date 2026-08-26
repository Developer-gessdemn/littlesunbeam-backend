// @desc    Upload single file (Image / Video)
// @route   POST /api/upload/single or POST /api/upload/video
// @access  Private/Admin
const uploadSingleImage = (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "No file provided for upload",
    });
  }

  const fileUrl = req.file.path;
  const isVideo = (req.file.mimetype && req.file.mimetype.startsWith("video/")) || /\.(mp4|mov|webm|m4v)$/i.test(req.file.originalname);

  return res.status(200).json({
    success: true,
    message: `${isVideo ? "Video" : "Image"} uploaded successfully`,
    data: {
      url: fileUrl,
      relativeUrl: fileUrl, // Cloudinary URLs are absolute
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
      isVideo,
    },
  });
};

// @desc    Upload multiple files (Images / Videos)
// @route   POST /api/upload/multiple or POST /api/upload/videos
// @access  Private/Admin
const uploadMultipleImages = (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      success: false,
      message: "No files provided for upload",
    });
  }

  const uploadedFiles = req.files.map((file) => ({
    url: file.path,
    filename: file.filename,
    mimetype: file.mimetype,
    size: file.size,
    isVideo: (file.mimetype && file.mimetype.startsWith("video/")) || /\.(mp4|mov|webm|m4v)$/i.test(file.originalname),
  }));

  const urls = uploadedFiles.map((f) => f.url);

  return res.status(200).json({
    success: true,
    message: `${req.files.length} file(s) uploaded successfully`,
    data: {
      urls,
      files: uploadedFiles,
    },
  });
};

module.exports = {
  uploadSingleImage,
  uploadMultipleImages,
  uploadSingleVideo: uploadSingleImage,
  uploadMultipleVideos: uploadMultipleImages,
};

