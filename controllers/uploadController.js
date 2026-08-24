const uploadSingleImage = (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "No image file provided",
    });
  }

  const fileUrl = req.file.path;

  return res.status(200).json({
    success: true,
    message: "Image uploaded successfully",
    data: {
      url: fileUrl,
      relativeUrl: fileUrl, // Cloudinary URLs are absolute
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
    },
  });
};

// @desc    Upload multiple images
// @route   POST /api/upload/multiple
// @access  Private/Admin
const uploadMultipleImages = (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      success: false,
      message: "No image files provided",
    });
  }

  const uploadedFiles = req.files.map((file) => ({
    url: file.path,
    filename: file.filename,
    mimetype: file.mimetype,
    size: file.size,
  }));

  const urls = uploadedFiles.map((f) => f.url);

  return res.status(200).json({
    success: true,
    message: `${req.files.length} images uploaded successfully`,
    data: {
      urls,
      files: uploadedFiles,
    },
  });
};

module.exports = {
  uploadSingleImage,
  uploadMultipleImages,
};
