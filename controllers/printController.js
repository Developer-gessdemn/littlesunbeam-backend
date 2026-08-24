const Print = require("../models/Print");
const { isValidObjectId } = require("../utils/validators");

// @desc    Get all prints
// @route   GET /api/prints
// @access  Public
const getPrints = async (req, res, next) => {
  try {
    const filter = req.query.all === "true" ? {} : { isActive: { $ne: false } };
    const prints = await Print.find(filter).sort({ order: 1, createdAt: 1 });
    return res.status(200).json({
      success: true,
      message: "Prints fetched successfully",
      data: {
        prints,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new print option
// @route   POST /api/prints
// @access  Private/Admin
const createPrint = async (req, res, next) => {
  try {
    const { id, name, emoji, icon, isActive } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Print name is required" });
    }

    const printName = name.trim();
    const symbol = emoji || icon || "✨";
    const printId = id || printName.toLowerCase().replace(/[^a-z0-9]/g, "-");

    // Check if print already exists by slug id or case-insensitive name
    let print = await Print.findOne({
      $or: [
        { id: printId },
        { name: new RegExp(`^${printName}$`, "i") }
      ]
    });

    if (print) {
      print.name = printName;
      print.emoji = symbol;
      print.icon = symbol;
      if (isActive !== undefined) print.isActive = isActive;
      await print.save();
    } else {
      print = await Print.create({
        id: printId,
        name: printName,
        emoji: symbol,
        icon: symbol,
        isActive: isActive !== undefined ? isActive : true,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Print created successfully",
      data: { print },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Sync / set all prints (batch)
// @route   PUT /api/prints
// @access  Private/Admin
const syncPrints = async (req, res, next) => {
  try {
    const { prints } = req.body;
    if (!Array.isArray(prints)) {
      return res.status(400).json({ success: false, message: "Prints array required" });
    }

    await Print.deleteMany({});
    let created = [];
    if (prints.length > 0) {
      created = await Print.insertMany(
        prints.map((p, idx) => {
          const symbol = p.emoji || p.icon || "✨";
          return {
            id: p.id || p.name.toLowerCase().replace(/[^a-z0-9]/g, "-"),
            name: p.name.trim(),
            emoji: symbol,
            icon: symbol,
            isActive: p.isActive !== undefined ? p.isActive : true,
            order: idx,
          };
        })
      );
    }

    return res.status(200).json({
      success: true,
      message: "Prints synced successfully",
      data: { prints: created },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a print
// @route   DELETE /api/prints/:id
// @access  Private/Admin
const deletePrint = async (req, res, next) => {
  try {
    const { id } = req.params;

    const query = isValidObjectId(id)
      ? { $or: [{ _id: id }, { id }] }
      : { id };

    const print = await Print.findOne(query);
    if (!print) {
      // If not found by query, also try direct delete in case
      await Print.deleteOne({ $or: [{ id }, { _id: id }] });
      return res.status(200).json({
        success: true,
        message: "Print deleted successfully",
      });
    }

    await Print.deleteOne({ _id: print._id });

    return res.status(200).json({
      success: true,
      message: "Print deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPrints,
  createPrint,
  syncPrints,
  deletePrint,
};
