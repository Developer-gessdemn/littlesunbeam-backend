const Banner = require("../models/Banner");
const { isValidObjectId } = require("../utils/validators");

const defaultBanners = [
  {
    badge: "100% Organic Muslin Cotton",
    heading: "Soft muslin days for your <span class=\"sun-underline\">little sunbeam</span>",
    subtext: "100% organic cotton essentials designed for delicate newborn skin — swaddles, hospital kits, towels and everyday clothing.",
    primaryBtnLabel: "Shop Now",
    primaryBtnTo: "/shop",
    secondaryBtnLabel: "Newborn Hospital Kits",
    secondaryBtnTo: "/shop",
    image: "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=1000&q=80",
    imageAlt: "Smiling baby in soft yellow organic cotton clothing",
    bgColor: "",
    isActive: true,
    order: 0,
  },
  {
    badge: "Best Sellers",
    heading: "Wrap them in <span class=\"sun-underline\">pure softness</span>",
    subtext: "Our muslin swaddles and towels are crafted from the finest organic cotton — gentle on newborn skin, durable for everyday use.",
    primaryBtnLabel: "Shop Muslin",
    primaryBtnTo: "/shop",
    secondaryBtnLabel: "View All",
    secondaryBtnTo: "/shop",
    image: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=1000&q=80",
    imageAlt: "Baby wrapped in soft muslin swaddle",
    bgColor: "oklch(0.97 0.02 95)",
    isActive: true,
    order: 1,
  },
  {
    badge: "Hospital Ready",
    heading: "Everything your <span class=\"sun-underline\">newborn needs</span>",
    subtext: "Complete hospital kits packed with certified organic cotton essentials — designed by parents, trusted by doctors across India.",
    primaryBtnLabel: "Explore Hospital Kits",
    primaryBtnTo: "/shop",
    secondaryBtnLabel: "Learn More",
    secondaryBtnTo: "/shop",
    image: "https://images.unsplash.com/photo-1555252333-9f8e92e65df9?auto=format&fit=crop&w=1000&q=80",
    imageAlt: "Newborn hospital kit essentials",
    bgColor: "oklch(0.97 0.025 160)",
    isActive: true,
    order: 2,
  },
];

// @desc    Get all hero banner slides
// @route   GET /api/banners
// @access  Public
const getBanners = async (req, res, next) => {
  try {
    const showAll = req.query.all === "true";
    const filter = showAll ? {} : { isActive: { $ne: false } };

    let banners = await Banner.find(filter).sort({ order: 1, createdAt: 1 });

    // If database has no banners at all, seed with defaults
    if (banners.length === 0) {
      const totalCount = await Banner.countDocuments();
      if (totalCount === 0) {
        banners = await Banner.insertMany(defaultBanners);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Hero banners retrieved successfully",
      data: {
        banners,
        count: banners.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new hero banner slide
// @route   POST /api/banners
// @access  Private/Admin
const createBanner = async (req, res, next) => {
  try {
    const {
      badge,
      heading,
      subtext,
      primaryBtnLabel,
      primaryBtnTo,
      secondaryBtnLabel,
      secondaryBtnTo,
      image,
      imageAlt,
      bgColor,
      isActive,
      order,
    } = req.body;

    if (!heading || !heading.trim()) {
      return res.status(400).json({ success: false, message: "Banner heading is required" });
    }
    if (!image || !image.trim()) {
      return res.status(400).json({ success: false, message: "Banner image URL is required" });
    }

    const bannerCount = await Banner.countDocuments();

    const banner = await Banner.create({
      badge: badge ? badge.trim() : "",
      heading: heading.trim(),
      subtext: subtext ? subtext.trim() : "",
      primaryBtnLabel: primaryBtnLabel ? primaryBtnLabel.trim() : "Shop Now",
      primaryBtnTo: primaryBtnTo ? primaryBtnTo.trim() : "/shop",
      secondaryBtnLabel: secondaryBtnLabel ? secondaryBtnLabel.trim() : "",
      secondaryBtnTo: secondaryBtnTo ? secondaryBtnTo.trim() : "/shop",
      image: image.trim(),
      imageAlt: imageAlt ? imageAlt.trim() : "Hero banner image",
      bgColor: bgColor ? bgColor.trim() : "",
      isActive: isActive !== undefined ? isActive : true,
      order: order !== undefined ? Number(order) : bannerCount,
    });

    return res.status(201).json({
      success: true,
      message: "Hero banner created successfully",
      data: { banner },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a banner slide
// @route   PUT /api/banners/:id
// @access  Private/Admin
const updateBanner = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const query = isValidObjectId(id)
      ? { $or: [{ _id: id }, { id }] }
      : { id };

    let banner = await Banner.findOne(query);
    if (!banner) {
      return res.status(404).json({ success: false, message: "Banner slide not found" });
    }

    Object.keys(updates).forEach((key) => {
      if (key !== "_id" && key !== "__v") {
        banner[key] = updates[key];
      }
    });

    await banner.save();

    return res.status(200).json({
      success: true,
      message: "Banner slide updated successfully",
      data: { banner },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Sync / set all hero banners (batch)
// @route   PUT /api/banners
// @access  Private/Admin
const syncBanners = async (req, res, next) => {
  try {
    const { banners } = req.body;
    if (!Array.isArray(banners)) {
      return res.status(400).json({ success: false, message: "Banners array is required" });
    }

    await Banner.deleteMany({});
    let created = [];
    if (banners.length > 0) {
      const bannerDocs = banners.map((b, idx) => ({
        id: b.id ? String(b.id) : `banner_${Date.now()}_${idx}`,
        badge: b.badge || "",
        heading: b.heading || "Special Collection",
        subtext: b.subtext || "",
        primaryBtnLabel: b.primaryBtnLabel || "Shop Now",
        primaryBtnTo: b.primaryBtnTo || "/shop",
        secondaryBtnLabel: b.secondaryBtnLabel || "",
        secondaryBtnTo: b.secondaryBtnTo || "/shop",
        image: b.image || "",
        imageAlt: b.imageAlt || "Banner image",
        bgColor: b.bgColor || "",
        isActive: b.isActive !== undefined ? b.isActive : true,
        order: b.order !== undefined ? Number(b.order) : idx,
      }));

      created = await Banner.insertMany(bannerDocs);
    }

    return res.status(200).json({
      success: true,
      message: "Hero banners synchronized successfully",
      data: { banners: created },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a banner slide
// @route   DELETE /api/banners/:id
// @access  Private/Admin
const deleteBanner = async (req, res, next) => {
  try {
    const { id } = req.params;

    const query = isValidObjectId(id)
      ? { $or: [{ _id: id }, { id }] }
      : { id };

    const banner = await Banner.findOne(query);
    if (banner) {
      await Banner.deleteOne({ _id: banner._id });
    } else {
      await Banner.deleteOne({ $or: [{ id }, { _id: id }] });
    }

    return res.status(200).json({
      success: true,
      message: "Banner slide deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBanners,
  createBanner,
  updateBanner,
  syncBanners,
  deleteBanner,
  defaultBanners,
};
