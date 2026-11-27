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

// Helper: Get or create user cart atomically (avoids E11000 duplicate key on concurrent requests)
const getOrCreateCart = async (userId) => {
  return Cart.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId, items: [] } },
    { upsert: true, new: true }
  );
};

// Helper: Run a cart mutation with automatic retry on Mongoose VersionError
const mutateCartWithRetry = async (userId, mutator, maxRetries = 3) => {
  let lastErr;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const cart = await getOrCreateCart(userId);
    const result = await mutator(cart);
    if (result && result.abort) {
      return result;
    }
    try {
      await cart.save();
      return { cart };
    } catch (err) {
      if (err.name === "VersionError" && attempt < maxRetries - 1) {
        lastErr = err;
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
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
        let variantPrice = 0;
        if (Array.isArray(item.product.colorVariants)) {
          const cv = item.product.colorVariants.find(
            (c) => (c.name || "").toLowerCase() === (item.selectedColor || "").toLowerCase()
          );
          if (cv && Array.isArray(cv.inventory)) {
            const inv = cv.inventory.find(
              (i) => (i.size || "").toLowerCase() === (item.selectedSize || "").toLowerCase()
            );
            if (inv && inv.price !== undefined && Number(inv.price) > 0) {
              variantPrice = Number(inv.price);
            }
          }
        }
        if (!variantPrice && Array.isArray(item.product.variants)) {
          const v = item.product.variants.find(
            (varItem) =>
              (varItem.color || "").toLowerCase() === (item.selectedColor || "").toLowerCase() &&
              (varItem.size || "").toLowerCase() === (item.selectedSize || "").toLowerCase()
          );
          if (v && v.price !== undefined && Number(v.price) > 0) {
            variantPrice = Number(v.price);
          }
        }

        const resolved =
          variantPrice ||
          (item.product.sellingPrice && Number(item.product.sellingPrice) > 0 ? Number(item.product.sellingPrice) : 0) ||
          (item.product.price && Number(item.product.price) > 0 ? Number(item.product.price) : 0) ||
          (item.product.mrp && Number(item.product.mrp) > 0 ? Number(item.product.mrp) : 0);

        if (resolved > 0) {
          item.price = resolved;
          hasRepairedPrices = true;
        }
      }
    });

    if (cart.items.length !== initialLen || hasRepairedPrices) {
      try {
        await cart.save();
      } catch (saveErr) {
        if (saveErr.name !== "VersionError") throw saveErr;
        // Concurrent update already modified cart; safe to return current items without failing GET
      }
    }

    const items = cart.items.map((item) => {
      let p = 0;
      if (item.price !== undefined && !isNaN(Number(item.price)) && Number(item.price) > 0) {
        p = Number(item.price);
      } else if (item.product?.sellingPrice !== undefined && Number(item.product.sellingPrice) > 0) {
        p = Number(item.product.sellingPrice);
      } else if (item.product?.price !== undefined && Number(item.product.price) > 0) {
        p = Number(item.product.price);
      } else if (item.product?.mrp !== undefined && Number(item.product.mrp) > 0) {
        p = Number(item.product.mrp);
      }
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
            if (matchedInv.price !== undefined && !isNaN(Number(matchedInv.price)) && Number(matchedInv.price) > 0) {
              variantPrice = Number(matchedInv.price);
            }
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
        if (flatV.price !== undefined && !isNaN(Number(flatV.price)) && Number(flatV.price) > 0) {
          variantPrice = Number(flatV.price);
        }
        if (flatV.stock !== undefined) availableStock = Number(flatV.stock);
      }
    }

    // Resolve final unit selling price: variantPrice > product.sellingPrice > product.price > candidate price > mrp
    let itemPrice = 0;
    if (variantPrice > 0) {
      itemPrice = variantPrice;
    } else if (product.sellingPrice !== undefined && !isNaN(Number(product.sellingPrice)) && Number(product.sellingPrice) > 0) {
      itemPrice = Number(product.sellingPrice);
    } else if (product.price !== undefined && !isNaN(Number(product.price)) && Number(product.price) > 0) {
      itemPrice = Number(product.price);
    } else if (price !== undefined && !isNaN(Number(price)) && Number(price) > 0) {
      itemPrice = Number(price);
    } else if (product.mrp !== undefined && !isNaN(Number(product.mrp)) && Number(product.mrp) > 0) {
      itemPrice = Number(product.mrp);
    }

    // Stock validation
    if (availableStock < qtyToAdd) {
      return res.status(400).json({
        success: false,
        message: `Only ${availableStock} item(s) available in stock for (${color} / ${size})`,
      });
    }

    const mutation = await mutateCartWithRetry(req.user._id, async (cart) => {
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
          return {
            abort: true,
            status: 400,
            message: `Cannot add more than available stock (${availableStock})`,
          };
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
    });

    if (mutation.abort) {
      return res.status(mutation.status).json({
        success: false,
        message: mutation.message,
      });
    }

    const cart = mutation.cart;
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

    const mutation = await mutateCartWithRetry(req.user._id, async (cart) => {
      if (!cart || cart.items.length === 0) {
        return { abort: true, status: 404, message: "Cart not found" };
      }

      // Try composite key / string match FIRST (before cart.items.id which throws on non-ObjectId strings)
      let item = cart.items.find(
        (i) =>
          String(i._id) === itemId ||
          `${String(i.product)}_${String(i.selectedColor || "Default")}_${String(i.selectedSize || "Standard")}` === itemId
      );
      // Fall back to Mongoose subdocument id lookup (only if itemId looks like an ObjectId)
      if (!item && /^[a-f\d]{24}$/i.test(itemId)) {
        try { item = cart.items.id(itemId); } catch { item = null; }
      }

      if (!item) {
        return { abort: true, status: 404, message: "Item not found in cart" };
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
    });

    if (mutation.abort) {
      return res.status(mutation.status).json({
        success: false,
        message: mutation.message,
      });
    }

    const cart = mutation.cart;
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

    const mutation = await mutateCartWithRetry(req.user._id, async (cart) => {
      if (!cart) {
        return { abort: true, status: 404, message: "Cart not found" };
      }

      // Only remove the exact matching item
      cart.items = cart.items.filter(
        (item) =>
          String(item._id) !== itemId &&
          `${String(item.product)}_${String(item.selectedColor || "Default")}_${String(item.selectedSize || "Standard")}` !== itemId &&
          `${String(item.product?._id || item.product)}_${String(item.variant || "")}` !== itemId
      );
    });

    if (mutation.abort) {
      return res.status(mutation.status).json({
        success: false,
        message: mutation.message,
      });
    }

    const cart = mutation.cart;
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
    const cart = await Cart.findOneAndUpdate(
      { user: req.user._id },
      { $set: { items: [] } },
      { new: true }
    );

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

// @desc    Merge guest cart items into authenticated user's cart
// @route   POST /api/cart/merge
// @access  Private
const mergeCart = async (req, res, next) => {
  try {
    const { guestItems } = req.body;
    if (!Array.isArray(guestItems) || guestItems.length === 0) {
      return res.status(400).json({ success: false, message: "No guest items to merge" });
    }

    // Resolve products once outside the retry loop
    const resolvedItems = [];
    for (const guestItem of guestItems) {
      const pid = guestItem.productId || guestItem._id || guestItem.id;
      if (!pid) continue;

      let product = null;
      if (isValidObjectId(String(pid))) {
        product = await Product.findById(pid);
      }
      if (!product || product.isActive === false) continue;

      const size = (guestItem.selectedSize || guestItem.size || "Standard").trim();
      const color = (guestItem.selectedColor || guestItem.color || "Default").trim();
      const qty = Math.max(1, parseInt(guestItem.qty || guestItem.quantity, 10) || 1);
      const price = parsePrice(guestItem.price, product.sellingPrice, product.price, product.mrp);
      const image = guestItem.image || product.image || "";

      resolvedItems.push({
        product: product._id,
        name: product.name,
        image,
        price,
        quantity: qty,
        selectedSize: size,
        selectedColor: color,
        variant: guestItem.variant || (color !== "Default" && size !== "Standard" ? `${color} / ${size}` : color !== "Default" ? color : size !== "Standard" ? size : "Standard"),
      });
    }

    const { cart } = await mutateCartWithRetry(req.user._id, async (cartDoc) => {
      cartDoc.items = cartDoc.items.filter((item) => Boolean(item.product));

      for (const itemToMerge of resolvedItems) {
        const existingIdx = cartDoc.items.findIndex(
          (item) =>
            String(item.product) === String(itemToMerge.product) &&
            String(item.selectedSize || "Standard").toLowerCase() === itemToMerge.selectedSize.toLowerCase() &&
            String(item.selectedColor || "Default").toLowerCase() === itemToMerge.selectedColor.toLowerCase()
        );

        if (existingIdx > -1) {
          cartDoc.items[existingIdx].quantity = Math.min(
            cartDoc.items[existingIdx].quantity + itemToMerge.quantity,
            99
          );
        } else {
          cartDoc.items.push(itemToMerge);
        }
      }
    });

    await cart.populate({
      path: "items.product",
      select: "name price sellingPrice mrp image stock isActive category sku colorVariants variants",
    });

    const items = cart.items.map((item) => {
      const p = parsePrice(item.price, item.product?.price, item.product?.sellingPrice, item.product?.mrp);
      const itemObj = item.toObject ? item.toObject() : item;
      return { ...itemObj, price: p };
    });

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const count = items.reduce((sum, item) => sum + item.quantity, 0);

    return res.status(200).json({
      success: true,
      message: "Cart merged successfully",
      data: { cart, items, subtotal, count },
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
  mergeCart,
};
