const express = require("express");
const {
  getPrints,
  createPrint,
  syncPrints,
  deletePrint,
} = require("../controllers/printController");
const { protect } = require("../middleware/authMiddleware");
const { admin } = require("../middleware/adminMiddleware");

const router = express.Router();

router.route("/")
  .get(getPrints)
  .post(protect, admin, createPrint)
  .put(protect, admin, syncPrints);

router.route("/:id")
  .delete(protect, admin, deletePrint);

module.exports = router;
