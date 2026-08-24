const Cart = require("../models/Cart");
const Product = require("../models/Product");
const { isValidObjectId } = require("../utils/validators");

// Helper: Robustly extract numerical price from candidates
const parsePrice = (...candidates) => {
  for (const val of candidates) {
    if (val === null || val === undefined || val === "") continue;
    if (typeof val === "number" && !isNaN(val) && val > 0) return val;
    if (typeof val === "string") {
      const cleaned = Number(val.replace(/[^0-9.]/g, ""));
      if (!isNaN(cleaned) && cleaned > 0) return cleaned;
    }
  }
  return 0;
};

// Helper: Get or create user cart
const getOrCreateCart = async (userId) => {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) {
    cart = await Cart.create({ user: userId, items: [] });
  }
  return cart;
};

// @desc    Get user's cart
// @route   GET /api/cart
// @access  Private
const getCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id }).populate({
      path: "items.product",
      select: "name price sellingPrice mrp image stock isActive category sku colorVariants variants",
    });

    if (!cart) {
      return res.status(200).json({
        success: true,
        message: "Cart fetched successfully",
        data: {
          cart: { user: req.user._id, items: [] },
          items: [],
          subtotal: 0,
          count: 0,
        },
      });
    }

    // Filter out items whose product was deleted or deactivated
    const initialLen = cart.items.length;
    cart.items = cart.items.filter((item) => item.product && item.product.isActive !== false);

    // Auto-repair any items with 0 price using actual database product prices
    let hasRepairedPrices = false;
    cart.items.forEach((item) => {
      const currentItemPrice = parsePrice(item.price);
      if (currentItemPrice <= 0 && item.product) {
        // Try finding variant price first
        let variantPrice = 0;
        if (Array.isArray(item.product.colorVariants)) {
          const cv = item.product.colorVariants.find(
            (c) => (c.name || "").toLowerCase() === (item.selectedColor || "").toLowerCase()
          );
          if (cv && Array.isArray(cv.inventory)) {
            const inv = cv.inventory.find(
              (i) => (i.size || "").toLowerCase() === (item.selectedSize || "").toLowerCase()
            );
            if (inv) variantPrice = parsePrice(inv.price, inv.mrp);
          }
        }
        if (!variantPrice && Array.isArray(item.product.variants)) {
          const v = item.product.variants.find(
            (varItem) =>
              (varItem.color || "").toLowerCase() === (item.selectedColor || "").toLowerCase() &&
              (varItem.size || "").toLowerCase() === (item.selectedSize || "").toLowerCase()
          );
          if (v) variantPrice = parsePrice(v.price, v.mrp);
        }

        const resolved = variantPrice || parsePrice(item.product.price, item.product.sellingPrice, item.product.mrp);
        if (resolved > 0) {
          item.price = resolved;
          hasRepairedPrices = true;
        }
      }
    });

    if (cart.items.length !== initialLen || hasRepairedPrices) {
      await cart.save();
    }

    const items = cart.items.map((item) => {
      const p = parsePrice(
        item.price,
        item.product?.price,
        item.product?.sellingPrice,
        item.product?.mrp
      );
      const itemObj = item.toObject ? item.toObject() : item;
      return {
        ...itemObj,
        price: p,
      };
    });

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const count = items.reduce((sum, item) => sum + item.quantity, 0);

    return res.status(200).json({
      success: true,
      message: "Cart fetched successfully",
      data: {
        cart,
        items,
        subtotal,
        count,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add item to cart
// @route   POST /api/cart
// @access  Private
const addToCart = async (req, res, next) => {
  try {
    const { productId, quantity = 1, selectedSize, selectedColor, variant, price, image } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    let product = null;
    if (isValidObjectId(productId)) {
      product = await Product.findById(productId);
    } else {
      product = await Product.findOne({
        $or: [{ sku: productId }, { slug: productId }],
      });
    }

    if (!product || product.isActive === false) {
      return res.status(404).json({
        success: false,
        message: "Product not found or unavailable",
      });
    }

    const qtyToAdd = Math.max(1, parseInt(quantity, 10) || 1);

    const size = (selectedSize || (product.sizes && product.sizes[0]) || "Standard").trim();
    const color = (selectedColor || (product.colors && product.colors[0]?.name) || "Default").trim();
    const variantStr = (variant || (color !== "Default" && size !== "Standard" ? `${color} / ${size}` : color !== "Default" ? color : size !== "Standard" ? size : "Standard")).trim();

    // Check variant stock and price if colorVariants or variants exist
    let availableStock = Number(product.stock !== undefined ? product.stock : 50);
    let variantPrice = 0;
    let itemImage = image || product.image || "";

    if (Array.isArray(product.colorVariants) && product.colorVariants.length > 0) {
      const matchedCv = product.colorVariants.find(
        (cv) => cv.name?.toLowerCase() === color.toLowerCase()
      );
      if (matchedCv) {
        if (Array.isArray(matchedCv.images) && matchedCv.images.length > 0) {
          const firstCvImg = typeof matchedCv.images[0] === "string" ? matchedCv.images[0] : matchedCv.images[0]?.url;
          if (firstCvImg && !image) itemImage = firstCvImg;
        }
        if (Array.isArray(matchedCv.inventory)) {
          const matchedInv = matchedCv.inventory.find(
            (inv) => inv.size?.toLowerCase() === size.toLowerCase()
          );
          if (matchedInv) {
            availableStock = Number(matchedInv.stock);
            variantPrice = parsePrice(matchedInv.price, matchedInv.mrp);
          }
        }
      }
    }

    if (!variantPrice && Array.isArray(product.variants) && product.variants.length > 0) {
      const flatV = product.variants.find(
        (v) =>
          (v.color || "").toLowerCase() === color.toLowerCase() &&
          (v.size || "").toLowerCase() === size.toLowerCase()
      );
      if (flatV) {
        variantPrice = parsePrice(flatV.price, flatV.mrp);
        if (flatV.stock !== undefined) availableStock = Number(flatV.stock);
      }
    }

    // Resolve final unit price: candidate price, then variant price, then product base price/sellingPrice/mrp
    const itemPrice = parsePrice(
      price,
      variantPrice,
      product.price,
      product.sellingPrice,
      product.mrp
    );

    // Stock validation
    if (availableStock < qtyToAdd) {
      return res.status(400).json({
        success: false,
        message: `Only ${availableStock} item(s) available in stock for (${color} / ${size})`,
      });
    }

    const cart = await getOrCreateCart(req.user._id);

    // Filter out any stale/broken items first
    cart.items = cart.items.filter((item) => Boolean(item.product));

    // Check if exact item with same product ID + color + size exists in cart
    const existingIndex = cart.items.findIndex(
      (item) =>
        String(item.product?._id || item.product) === String(product._id) &&
        String(item.selectedSize || "Standard").toLowerCase() === size.toLowerCase() &&
        String(item.selectedColor || "Default").toLowerCase() === color.toLowerCase()
    );

    if (existingIndex > -1) {
      const newQty = cart.items[existingIndex].quantity + qtyToAdd;
      if (newQty > availableStock) {
        return res.status(400).json({
          success: false,
          message: `Cannot add more than available stock (${availableStock})`,
        });
      }
      cart.items[existingIndex].quantity = newQty;
      if (itemPrice > 0) cart.items[existingIndex].price = itemPrice;
      if (itemImage) cart.items[existingIndex].image = itemImage;
    } else {
      cart.items.push({
        product: product._id,
        name: product.name,
        image: itemImage,
        price: itemPrice,
        quantity: qtyToAdd,
        selectedSize: size,
        selectedColor: color,
        variant: variantStr,
      });
    }

    await cart.save();
    await cart.populate({
      path: "items.product",
      select: "name price sellingPrice mrp image stock isActive category sku colorVariants variants",
    });

    const items = cart.items.map((item) => {
      const p = parsePrice(
        item.price,
        item.product?.price,
        item.product?.sellingPrice,
        item.product?.mrp
      );
      const itemObj = item.toObject ? item.toObject() : item;
      return {
        ...itemObj,
        price: p,
      };
    });

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const count = items.reduce((sum, item) => sum + item.quantity, 0);

    return res.status(200).json({
      success: true,
      message: "Product added to cart",
      data: {
        cart,
        items,
        subtotal,
        count,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update cart item quantity
// @route   PUT /api/cart/:itemId
// @access  Private
const updateCartItemQty = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const { quantity, delta } = req.body;

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    const item =
      cart.items.id(itemId) ||
      cart.items.find(
        (i) =>
          String(i._id) === itemId ||
          `${String(i.product)}_${String(i.selectedColor || "Default")}_${String(i.selectedSize || "Standard")}` === itemId
      );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found in cart",
      });
    }

    let newQty = item.quantity;
    if (delta !== undefined) {
      newQty = item.quantity + Number(delta);
    } else if (quantity !== undefined) {
      newQty = Number(quantity);
    }

    if (newQty <= 0) {
      // Remove item if quantity drops to 0 or below
      cart.items.pull(item._id);
    } else {
      item.quantity = newQty;
    }

    await cart.save();
    await cart.populate({
      path: "items.product",
      select: "name price sellingPrice mrp image stock isActive category sku colorVariants variants",
    });

    const items = cart.items.map((item) => {
      const p = parsePrice(
        item.price,
        item.product?.price,
        item.product?.sellingPrice,
        item.product?.mrp
      );
      const itemObj = item.toObject ? item.toObject() : item;
      return {
        ...itemObj,
        price: p,
      };
    });

    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const count = items.reduce((sum, i) => sum + i.quantity, 0);

    return res.status(200).json({
      success: true,
      message: "Cart updated successfully",
      data: {
        cart,
        items,
        subtotal,
        count,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove single item from cart
// @route   DELETE /api/cart/:itemId
// @access  Private
const removeCartItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // Only remove the exact matching item
    cart.items = cart.items.filter(
      (item) =>
        String(item._id) !== itemId &&
        `${String(item.product)}_${String(item.selectedColor || "Default")}_${String(item.selectedSize || "Standard")}` !== itemId &&
        `${String(item.product?._id || item.product)}_${String(item.variant || "")}` !== itemId
    );

    await cart.save();
    await cart.populate({
      path: "items.product",
      select: "name price sellingPrice mrp image stock isActive category sku colorVariants variants",
    });

    const items = cart.items.map((item) => {
      const p = parsePrice(
        item.price,
        item.product?.price,
        item.product?.sellingPrice,
        item.product?.mrp
      );
      const itemObj = item.toObject ? item.toObject() : item;
      return {
        ...itemObj,
        price: p,
      };
    });

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const count = items.reduce((sum, item) => sum + item.quantity, 0);

    return res.status(200).json({
      success: true,
      message: "Item removed from cart",
      data: {
        cart,
        items,
        subtotal,
        count,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Clear entire cart
// @route   DELETE /api/cart
// @access  Private
const clearCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (cart) {
      cart.items = [];
      await cart.save();
    }

    return res.status(200).json({
      success: true,
      message: "Cart cleared successfully",
      data: {
        cart: cart || { user: req.user._id, items: [] },
        items: [],
        subtotal: 0,
        count: 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItemQty,
  removeCartItem,
  clearCart,
};
