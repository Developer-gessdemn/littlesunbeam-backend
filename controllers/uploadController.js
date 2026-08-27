const axios = require("axios");

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

// @desc    Resolve Instagram Reel/Post URL to a playable direct media source
// @route   POST /api/upload/resolve-instagram
// @access  Public / Admin
const resolveInstagramMedia = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ success: false, message: "Instagram URL is required" });
    }

    const cleanUrl = url.trim();
    const isInstagram = cleanUrl.includes("instagram.com/") || cleanUrl.includes("instagr.am/");

    if (!isInstagram) {
      return res.status(200).json({
        success: true,
        data: { url: cleanUrl, resolvedVideoUrl: cleanUrl, isDirectVideo: true },
      });
    }

    // ── Strategy 1: Meta Graph API (if access token is configured) ────────────
    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
    const match = cleanUrl.match(/instagram\.com\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i) ||
                  cleanUrl.match(/instagr\.am\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i);
    const shortcode = match ? match[1] : null;

    if (accessToken && shortcode) {
      try {
        const metaRes = await axios.get(
          `https://graph.instagram.com/v18.0/${shortcode}?fields=id,media_type,media_url,thumbnail_url&access_token=${accessToken}`,
          { timeout: 8000 }
        );
        const metaData = metaRes.data;
        if (metaData.media_url && (metaData.media_type === "VIDEO" || metaData.media_url.includes(".mp4"))) {
          return res.status(200).json({
            success: true,
            data: {
              url: cleanUrl,
              resolvedVideoUrl: metaData.media_url,
              thumbnailUrl: metaData.thumbnail_url || null,
              isDirectVideo: true,
              source: "meta-graph-api",
            },
          });
        }
      } catch (err) {
        console.warn("[Instagram Resolver] Meta Graph API failed:", err.message);
      }
    }

    // ── Strategy 2: Scrape og:video from Instagram page (no token needed) ────
    const normalizedUrl = cleanUrl.split("?")[0].replace(/\/+$/, "") + "/";
    const HEADERS = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Site": "none",
      "Upgrade-Insecure-Requests": "1",
      "Cache-Control": "max-age=0",
    };

    try {
      const pageRes = await axios.get(normalizedUrl, {
        headers: HEADERS,
        timeout: 12000,
        maxRedirects: 5,
      });
      const html = pageRes.data || "";

      // Extract og:video from meta tags
      const ogVideoMatch =
        html.match(/<meta[^>]+property=["']og:video["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video["']/i);
      const ogVideoSecureMatch =
        html.match(/<meta[^>]+property=["']og:video:secure_url["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video:secure_url["']/i);

      const videoUrl = (ogVideoSecureMatch || ogVideoMatch)?.[1] || null;

      // Extract og:image for thumbnail
      const ogImageMatch =
        html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
      const thumbnailUrl = ogImageMatch?.[1] || null;

      if (videoUrl && (videoUrl.includes(".mp4") || videoUrl.includes("video"))) {
        const decodedUrl = videoUrl.replace(/&amp;/g, "&");
        console.log("[Instagram Resolver] og:video found:", decodedUrl.substring(0, 80) + "...");
        return res.status(200).json({
          success: true,
          data: {
            url: cleanUrl,
            resolvedVideoUrl: decodedUrl,
            thumbnailUrl: thumbnailUrl ? thumbnailUrl.replace(/&amp;/g, "&") : null,
            isDirectVideo: true,
            source: "og-meta-scrape",
          },
        });
      }

      // Extract thumbnail at minimum for fallback display
      if (thumbnailUrl) {
        return res.status(200).json({
          success: false,
          isFallbackNeeded: true,
          data: {
            url: cleanUrl,
            resolvedVideoUrl: null,
            thumbnailUrl: thumbnailUrl.replace(/&amp;/g, "&"),
            source: "og-thumbnail-only",
          },
          message: "Instagram video URL could not be extracted. Showing thumbnail preview.",
        });
      }
    } catch (scrapeErr) {
      console.warn("[Instagram Resolver] Page scrape failed:", scrapeErr.message);
    }

    // ── Final Fallback ────────────────────────────────────────────────────────
    return res.status(200).json({
      success: false,
      isFallbackNeeded: true,
      message: "Could not resolve Instagram video. Please upload the MP4 file directly.",
      data: { url: cleanUrl, resolvedVideoUrl: null },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      isFallbackNeeded: true,
      message: "Could not resolve Instagram video. Please upload the MP4 file directly.",
      error: error.message,
    });
  }
};

module.exports = {
  uploadSingleImage,
  uploadMultipleImages,
  uploadSingleVideo: uploadSingleImage,
  uploadMultipleVideos: uploadMultipleImages,
  resolveInstagramMedia,
};


