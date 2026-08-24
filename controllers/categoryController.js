const Category = require("../models/Category");
const { isValidObjectId } = require("../utils/validators");
const slugify = require("slugify");

// Helper to normalize subcategories
const normalizeSubCategories = (subCategories) => {
  if (!Array.isArray(subCategories)) return [];
  return subCategories
    .map((sub, idx) => {
      if (!sub) return null;
      if (typeof sub === "string") {
        const trimmed = sub.trim();
        if (!trimmed) return null;
        return {
          name: trimmed,
          slug: slugify(trimmed, { lower: true, strict: true }),
          isActive: true,
          order: idx + 1,
        };
      }
      if (typeof sub === "object") {
        const name = (sub.name || "").trim();
        if (!name) return null;
        return {
          _id: sub._id || undefined,
          name,
          slug: (sub.slug || slugify(name, { lower: true, strict: true })).toLowerCase().trim(),
          description: (sub.description || "").trim(),
          image: sub.image || "",
          isActive: sub.isActive !== undefined ? Boolean(sub.isActive) : true,
          order: sub.order !== undefined ? Number(sub.order) : idx + 1,
        };
      }
      return null;
    })
    .filter(Boolean);
};

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
const getCategories = async (req, res, next) => {
  try {
    const { includeInactive } = req.query;
    const query = includeInactive === "true" ? {} : { isActive: true };

    const categories = await Category.find(query).sort({ order: 1, name: 1 });

    return res.status(200).json({
      success: true,
      message: "Categories fetched successfully",
      data: {
        categories,
        count: categories.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single category by ID or slug
// @route   GET /api/categories/:id
// @access  Public
const getCategoryById = async (req, res, next) => {
  try {
    const { id } = req.params;
    let category = null;

    if (isValidObjectId(id)) {
      category = await Category.findById(id);
    }

    if (!category) {
      category = await Category.findOne({ slug: id.toLowerCase() });
    }

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Category fetched successfully",
      data: {
        category,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create category
// @route   POST /api/categories
// @access  Private/Admin
const createCategory = async (req, res, next) => {
  try {
    const { name, description, image, subCategories, isActive, order } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    const existingCategory = await Category.findOne({
      name: new RegExp(`^${name.trim()}$`, "i"),
    });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: "A category with this name already exists",
      });
    }

    const normalizedSubs = normalizeSubCategories(subCategories);

    const category = await Category.create({
      name: name.trim(),
      description: description ? description.trim() : "",
      image: image || "",
      subCategories: normalizedSubs,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      order: order !== undefined ? Number(order) : 0,
    });

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: {
        category,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Private/Admin
const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, image, subCategories, isActive, order } = req.body;

    let category = null;
    if (isValidObjectId(id)) {
      category = await Category.findById(id);
    }
    if (!category) {
      category = await Category.findOne({ slug: id });
    }

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    if (name && name.trim() !== category.name) {
      const duplicate = await Category.findOne({
        name: new RegExp(`^${name.trim()}$`, "i"),
        _id: { $ne: category._id },
      });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: "Another category with this name already exists",
        });
      }
      category.name = name.trim();
      category.slug = slugify(name.trim(), { lower: true, strict: true });
    }

    if (description !== undefined) category.description = description.trim();
    if (image !== undefined) category.image = image;
    if (subCategories !== undefined) {
      category.subCategories = normalizeSubCategories(subCategories);
    }
    if (isActive !== undefined) category.isActive = Boolean(isActive);
    if (order !== undefined) category.order = Number(order);

    const updatedCategory = await category.save();

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: {
        category: updatedCategory,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  Private/Admin
const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    let category = null;
    if (isValidObjectId(id)) {
      category = await Category.findById(id);
    }
    if (!category) {
      category = await Category.findOne({ slug: id });
    }

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    await Category.findByIdAndDelete(category._id);

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully",
      data: {
        id: category._id,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add a subcategory to category
// @route   POST /api/categories/:id/subcategories
// @access  Private/Admin
const addSubCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, slug, description, image, isActive, order } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Subcategory name is required",
      });
    }

    let category = null;
    if (isValidObjectId(id)) {
      category = await Category.findById(id);
    }
    if (!category) {
      category = await Category.findOne({ slug: id });
    }

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Parent category not found",
      });
    }

    const subName = name.trim();
    const subSlug = (slug || slugify(subName, { lower: true, strict: true })).toLowerCase().trim();

    // Check duplicate subcategory in same category
    const exists = (category.subCategories || []).some(
      (s) => s.name.toLowerCase() === subName.toLowerCase() || s.slug === subSlug
    );
    if (exists) {
      return res.status(400).json({
        success: false,
        message: `Subcategory "${subName}" already exists in this category`,
      });
    }

    const newSub = {
      name: subName,
      slug: subSlug,
      description: description ? description.trim() : "",
      image: image || "",
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      order: order !== undefined ? Number(order) : (category.subCategories?.length || 0) + 1,
    };

    category.subCategories.push(newSub);
    await category.save();

    const createdSub = category.subCategories[category.subCategories.length - 1];

    return res.status(201).json({
      success: true,
      message: "Subcategory added successfully",
      data: {
        category,
        subCategory: createdSub,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a subcategory in category
// @route   PUT /api/categories/:id/subcategories/:subId
// @access  Private/Admin
const updateSubCategory = async (req, res, next) => {
  try {
    const { id, subId } = req.params;
    const { name, slug, description, image, isActive, order } = req.body;

    let category = null;
    if (isValidObjectId(id)) {
      category = await Category.findById(id);
    }
    if (!category) {
      category = await Category.findOne({ slug: id });
    }

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Parent category not found",
      });
    }

    const sub = category.subCategories.id(subId) || category.subCategories.find(
      (s) => String(s._id) === String(subId) || s.slug === subId || s.name.toLowerCase() === subId.toLowerCase()
    );

    if (!sub) {
      return res.status(404).json({
        success: false,
        message: "Subcategory not found",
      });
    }

    if (name && name.trim()) {
      sub.name = name.trim();
      sub.slug = (slug || slugify(name.trim(), { lower: true, strict: true })).toLowerCase().trim();
    } else if (slug) {
      sub.slug = slug.toLowerCase().trim();
    }

    if (description !== undefined) sub.description = description.trim();
    if (image !== undefined) sub.image = image;
    if (isActive !== undefined) sub.isActive = Boolean(isActive);
    if (order !== undefined) sub.order = Number(order);

    await category.save();

    return res.status(200).json({
      success: true,
      message: "Subcategory updated successfully",
      data: {
        category,
        subCategory: sub,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a subcategory from category
// @route   DELETE /api/categories/:id/subcategories/:subId
// @access  Private/Admin
const deleteSubCategory = async (req, res, next) => {
  try {
    const { id, subId } = req.params;

    let category = null;
    if (isValidObjectId(id)) {
      category = await Category.findById(id);
    }
    if (!category) {
      category = await Category.findOne({ slug: id });
    }

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Parent category not found",
      });
    }

    const subIndex = category.subCategories.findIndex(
      (s) => String(s._id) === String(subId) || s.slug === subId || s.name.toLowerCase() === subId.toLowerCase()
    );

    if (subIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Subcategory not found in this category",
      });
    }

    category.subCategories.splice(subIndex, 1);
    await category.save();

    return res.status(200).json({
      success: true,
      message: "Subcategory deleted successfully",
      data: {
        category,
        subId,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  addSubCategory,
  updateSubCategory,
  deleteSubCategory,
};
