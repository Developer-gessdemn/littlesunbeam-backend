const express = require("express");
const {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  addSubCategory,
  updateSubCategory,
  deleteSubCategory,
} = require("../controllers/categoryController");
const { protect } = require("../middleware/authMiddleware");
const { admin } = require("../middleware/adminMiddleware");

const router = express.Router();

router
  .route("/")
  .get(getCategories)
  .post(protect, admin, createCategory);

router
  .route("/:id")
  .get(getCategoryById)
  .put(protect, admin, updateCategory)
  .delete(protect, admin, deleteCategory);

// Subcategory Management routes
router
  .route("/:id/subcategories")
  .post(protect, admin, addSubCategory);

router
  .route("/:id/subcategories/:subId")
  .put(protect, admin, updateSubCategory)
  .delete(protect, admin, deleteSubCategory);

module.exports = router;
