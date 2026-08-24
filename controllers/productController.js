const Product = require("../models/Product");
const Print = require("../models/Print");
const { isValidObjectId } = require("../utils/validators");
const slugify = require("slugify");

// Helper to normalize print IDs
const resolvePrintIds = async (printInputs) => {
  if (!printInputs) return [];
  const list = Array.isArray(printInputs) ? printInputs : [printInputs];
  const resolved = [];

  for (const item of list) {
    if (!item) continue;
    if (typeof item === "object" && item._id) {
      if (isValidObjectId(item._id)) resolved.push(item._id);
    } else if (typeof item === "string") {
      const trimmed = item.trim();
      if (isValidObjectId(trimmed)) {
        resolved.push(trimmed);
      } else {
        // Try finding print by slug id or name
        const found = await Print.findOne({
          $or: [
            { id: trimmed.toLowerCase() },
            { name: new RegExp(`^${trimmed}$`, "i") },
          ],
        });
        if (found) {
          resolved.push(found._id);
        }
      }
    }
  }
  return [...new Set(resolved)];
};

// @desc    Get all products with searching, filtering, sorting, and pagination
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res, next) => {
  try {
    const {
      search,
      category,
      age,
      print,
      prints,
      gender,
      size,
      color,
      minPrice,
      maxPrice,
      sort,
      isFeatured,
      isNewArrival,
      page = 1,
      limit = 20,
    } = req.query;

    const query = { isActive: true };

    // 1. Text Search (Search against name, description, category, categoryPill, subCategory, brand, sku, tags)
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      query.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { category: searchRegex },
        { categoryPill: searchRegex },
        { subCategory: searchRegex },
        { brand: searchRegex },
        { sku: searchRegex },
        { tags: { $in: [searchRegex] } },
      ];
    }

    // 2. Category Filter (can be comma-separated or single)
    if (category) {
      const catArray = (Array.isArray(category)
        ? category
        : category.split(",")
      ).map((c) => c.trim()).filter(Boolean);

      const catRegexes = catArray.map((c) => new RegExp(`^${c}$`, "i"));
      const catObjectIds = catArray.filter((c) => isValidObjectId(c));

      const categoryConditions = [
        { category: { $in: catRegexes } },
        { categoryPill: { $in: catRegexes } },
      ];
      if (catObjectIds.length > 0) {
        categoryConditions.push({ categoryId: { $in: catObjectIds } });
      }

      if (categoryConditions.length === 1) {
        Object.assign(query, categoryConditions[0]);
      } else {
        if (query.$or) {
          query.$and = [{ $or: query.$or }, { $or: categoryConditions }];
          delete query.$or;
        } else {
          query.$or = categoryConditions;
        }
      }
    }

    // 2.1. Subcategory Filter (supports subCategory, subcategory, sub_category)
    const rawSubCategory = req.query.subCategory || req.query.subcategory || req.query.sub_category;
    if (rawSubCategory) {
      const subArray = (Array.isArray(rawSubCategory)
        ? rawSubCategory
        : String(rawSubCategory).split(",")
      ).map((s) => s.trim()).filter(Boolean);

      const subRegexes = subArray.map((s) => new RegExp(`^${s}$`, "i"));
      const subObjectIds = subArray.filter((s) => isValidObjectId(s));

      const subConditions = [
        { subCategory: { $in: subRegexes } },
      ];
      if (subObjectIds.length > 0) {
        subConditions.push({ subCategoryId: { $in: subObjectIds } });
      }

      if (query.$and) {
        query.$and.push({ $or: subConditions });
      } else if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: subConditions }];
        delete query.$or;
      } else {
        query.$or = subConditions;
      }
    }

    // 3. Age Group Filter
    if (age) {
      const ageArray = Array.isArray(age)
        ? age
        : age.split(",").map((a) => a.trim());
      query.ageGroup = {
        $in: ageArray.map((a) => new RegExp(a, "i")),
      };
    }

    // 4. Print Filter (support single 'print' or multi-select 'prints')
    const rawPrints = prints || print;
    if (rawPrints) {
      const printTokens = (Array.isArray(rawPrints) ? rawPrints : String(rawPrints).split(","))
        .map((p) => p.trim())
        .filter(Boolean);

      const objectIdList = printTokens.filter((token) => isValidObjectId(token));
      const textTokens = printTokens;

      // Find any prints matching slug or name to also include their ObjectIds
      if (textTokens.length > 0) {
        const matchingPrints = await Print.find({
          $or: [
            { id: { $in: textTokens.map((t) => t.toLowerCase()) } },
            { name: { $in: textTokens.map((t) => new RegExp(`^${t}$`, "i")) } },
          ],
        });
        matchingPrints.forEach((mp) => {
          if (!objectIdList.includes(String(mp._id))) {
            objectIdList.push(mp._id);
          }
        });
      }

      const printConditions = [];
      if (objectIdList.length > 0) {
        printConditions.push({ prints: { $in: objectIdList } });
      }
      if (textTokens.length > 0) {
        const regexList = textTokens.map((t) => new RegExp(`^${t}$`, "i"));
        printConditions.push({ print: { $in: regexList } });
      }

      if (printConditions.length === 1) {
        Object.assign(query, printConditions[0]);
      } else if (printConditions.length > 1) {
        if (query.$or) {
          query.$and = [{ $or: query.$or }, { $or: printConditions }];
          delete query.$or;
        } else {
          query.$or = printConditions;
        }
      }
    }

    // 5. Gender Filter
    if (gender) {
      query.gender = new RegExp(`^${gender.trim()}$`, "i");
    }

    // 6. Size Filter
    if (size) {
      const sizeArray = Array.isArray(size) ? size : size.split(",").map((s) => s.trim());
      query.sizes = { $in: sizeArray };
    }

    // 7. Color Filter
    if (color) {
      query["colors.name"] = new RegExp(color.trim(), "i");
    }

    // 8. Price Range Filter
    if (minPrice !== undefined || maxPrice !== undefined) {
      query.price = {};
      if (minPrice !== undefined && !isNaN(Number(minPrice))) {
        query.price.$gte = Number(minPrice);
      }
      if (maxPrice !== undefined && !isNaN(Number(maxPrice))) {
        query.price.$lte = Number(maxPrice);
      }
    }

    // 9. Flags
    if (isFeatured === "true" || isFeatured === true) query.isFeatured = true;
    if (isNewArrival === "true" || isNewArrival === true) query.isNewArrival = true;

    // 10. Sorting
    let sortOption = { createdAt: -1 }; // default newest
    if (sort === "low") sortOption = { price: 1 };
    else if (sort === "high") sortOption = { price: -1 };
    else if (sort === "rating") sortOption = { rating: -1, reviewCount: -1 };
    else if (sort === "new") sortOption = { createdAt: -1 };
    else if (sort === "featured") sortOption = { isFeatured: -1, createdAt: -1 };

    // 11. Pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const totalProducts = await Product.countDocuments(query);
    const products = await Product.find(query)
      .populate("prints")
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum);

    return res.status(200).json({
      success: true,
      message: "Products fetched successfully",
      data: {
        products,
        pagination: {
          total: totalProducts,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(totalProducts / limitNum) || 1,
          hasNextPage: pageNum * limitNum < totalProducts,
          hasPrevPage: pageNum > 1,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single product by ID or Slug
// @route   GET /api/products/:id
// @access  Public
const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    let product = null;

    if (isValidObjectId(id)) {
      product = await Product.findById(id).populate("prints");
    }

    if (!product) {
      product = await Product.findOne({
        $or: [{ slug: id }, { sku: id.toUpperCase() }],
      }).populate("prints");
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product not found with identifier: ${id}`,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product fetched successfully",
      data: {
        product,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
const createProduct = async (req, res, next) => {
  try {
    const {
      name,
      description,
      details,
      price,
      mrp,
      discount,
      gst,
      category,
      categoryId,
      categoryPill,
      subCategory,
      subCategoryId,
      brand,
      image,
      gallery,
      images,
      colors,
      sizes,
      stock,
      lowStockThreshold,
      sku,
      ageGroup,
      gender,
      fabric,
      pattern,
      print,
      prints,
      sleeveType,
      neckType,
      fitType,
      season,
      colorVariants,
      variants,
      careInstructions,
      washCare,
      countryOfOrigin,
      manufacturer,
      productWeight,
      returnEligibility,
      badge,
      status,
      isFeatured,
      isNewArrival,
      isActive,
      tags,
    } = req.body;

    // Strict validation of required fields
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Product name is required",
      });
    }

    if (price === undefined || price === null || price === "" || isNaN(Number(price))) {
      return res.status(400).json({
        success: false,
        message: "Selling price is required",
      });
    }

    if (Number(price) < 0) {
      return res.status(400).json({
        success: false,
        message: "Selling price cannot be negative",
      });
    }

    const numericPrice = Number(price);
    const numericMrp = mrp !== undefined && mrp !== null && mrp !== "" ? Number(mrp) : numericPrice;

    if (numericMrp < 0) {
      return res.status(400).json({
        success: false,
        message: "MRP cannot be negative",
      });
    }

    if (numericMrp < numericPrice) {
      return res.status(400).json({
        success: false,
        message: "MRP / Original Price cannot be lower than Selling Price",
      });
    }

    if (!category || !category.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category is required",
      });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({
        success: false,
        message: "Product description is required",
      });
    }

    // Auto-generate SKU if not provided
    const productSku = (
      sku && sku.trim()
        ? sku.trim()
        : `SUN-${category.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`
    ).toUpperCase();

    const existingSku = await Product.findOne({ sku: productSku });
    if (existingSku) {
      return res.status(400).json({
        success: false,
        message: `Product with SKU '${productSku}' already exists`,
      });
    }

    // Process Color Variants & Inventory
    let formattedColorVariants = [];
    let formattedVariants = [];
    let totalStockFromVariants = 0;
    const collectedColors = [];
    const collectedSizes = new Set();
    const collectedImages = [];

    if (Array.isArray(colorVariants) && colorVariants.length > 0) {
      formattedColorVariants = colorVariants.map((cv, cvIdx) => {
        const colorName = cv.name ? cv.name.trim() : `Color ${cvIdx + 1}`;
        const colorHex = cv.hex ? cv.hex.trim() : "#E5E7EB";
        collectedColors.push({ name: colorName, hex: colorHex });

        const rawImages = Array.isArray(cv.images) ? cv.images : [];
        const normImages = rawImages.map((img, i) => {
          const url = typeof img === "string" ? img.trim() : (img.url ? img.url.trim() : "");
          const isPrimary = typeof img === "object" ? Boolean(img.isPrimary) : i === 0;
          if (url) collectedImages.push(url);
          return { url, isPrimary };
        }).filter((img) => Boolean(img.url));

        const primaryImgUrl = normImages.find((img) => img.isPrimary)?.url || normImages[0]?.url || "";

        const rawInventory = Array.isArray(cv.inventory) ? cv.inventory : [];
        const normInventory = rawInventory.map((inv, invIdx) => {
          const sz = inv.size ? inv.size.trim() : "Standard";
          const st = Math.max(0, parseInt(inv.stock, 10) || 0);
          const colorSlug = colorName.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, "");
          const sizeSlug = sz.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
          const variantSku = (inv.sku && inv.sku.trim() ? inv.sku.trim() : `${productSku}-${colorSlug || "DEF"}-${sizeSlug || "STD"}`).toUpperCase();

          totalStockFromVariants += st;
          collectedSizes.add(sz);

          const variantObj = {
            sku: variantSku,
            color: colorName,
            size: sz,
            stock: st,
            price: inv.price !== undefined && !isNaN(Number(inv.price)) ? Number(inv.price) : numericPrice,
            mrp: inv.mrp !== undefined && !isNaN(Number(inv.mrp)) ? Number(inv.mrp) : numericMrp,
            image: primaryImgUrl || image || "",
          };
          formattedVariants.push(variantObj);

          return {
            size: sz,
            stock: st,
            sku: variantSku,
            price: variantObj.price,
            mrp: variantObj.mrp,
          };
        });

        const cvSizes = Array.isArray(cv.sizes) && cv.sizes.length > 0 ? cv.sizes : normInventory.map((inv) => inv.size);
        cvSizes.forEach((sz) => collectedSizes.add(sz));

        return {
          name: colorName,
          displayName: cv.displayName ? cv.displayName.trim() : colorName,
          hex: colorHex,
          images: normImages,
          sizes: cvSizes,
          inventory: normInventory,
        };
      });
    } else if (Array.isArray(variants) && variants.length > 0) {
      formattedVariants = variants.map((v, idx) => {
        const st = Math.max(0, parseInt(v.stock, 10) || 0);
        totalStockFromVariants += st;
        if (v.size) collectedSizes.add(v.size);
        if (v.color) collectedColors.push({ name: v.color, hex: "#E5E7EB" });
        return {
          sku: (v.sku || `${productSku}-V${idx + 1}`).toUpperCase(),
          size: v.size || "",
          color: v.color || "",
          stock: st,
          price: v.price !== undefined ? Number(v.price) : numericPrice,
          mrp: v.mrp !== undefined ? Number(v.mrp) : numericMrp,
          image: v.image || image || "",
        };
      });
    }

    // Determine final stock
    const numericStock = formattedColorVariants.length > 0 || formattedVariants.length > 0
      ? totalStockFromVariants
      : Math.max(0, parseInt(stock, 10) || 0);

    // Determine main image and gallery (fallback to color variant images if not set)
    let mainImg = (image && image.trim()) || collectedImages[0] || "";
    if (!mainImg) {
      return res.status(400).json({
        success: false,
        message: "Please provide at least one product image or upload an image for a color variant.",
      });
    }

    let imgGallery = Array.isArray(gallery) && gallery.length > 0 ? gallery : (collectedImages.length > 0 ? collectedImages : [mainImg]);
    if (!imgGallery.includes(mainImg)) {
      imgGallery.unshift(mainImg);
    }
    imgGallery = Array.from(new Set(imgGallery));

    let structuredImages = {
      main: mainImg,
      front: images?.front || "",
      back: images?.back || "",
      side: images?.side || "",
      model: images?.model || "",
      additional: Array.isArray(images?.additional) ? images.additional : [],
    };

    // Resolve print IDs for populated references (Print is fully optional)
    const printSources = prints || (print ? [print] : []);
    const resolvedPrintIds = await resolvePrintIds(printSources);

    // Calculate auto discount
    const calculatedDiscount =
      numericMrp > numericPrice ? Math.round(((numericMrp - numericPrice) / numericMrp) * 100) : 0;

    // Calculate stock status
    const numericThreshold = lowStockThreshold !== undefined ? Number(lowStockThreshold) : 10;
    let initialStockStatus = "In Stock";
    if (numericStock <= 0) {
      initialStockStatus = "Out of Stock";
    } else if (numericStock <= numericThreshold) {
      initialStockStatus = "Low Stock";
    }

    const product = await Product.create({
      name: name.trim(),
      description: description.trim(),
      details: details ? details.trim() : "",
      price: numericPrice,
      mrp: numericMrp,
      discount: discount !== undefined ? Number(discount) : calculatedDiscount,
      gst: gst !== undefined ? Number(gst) : 5,
      category: category.toLowerCase().trim(),
      categoryId: isValidObjectId(categoryId) ? categoryId : undefined,
      categoryPill: categoryPill || category,
      subCategory: subCategory ? subCategory.trim() : "",
      subCategoryId: isValidObjectId(subCategoryId) ? subCategoryId : undefined,
      brand: brand && brand.trim() ? brand.trim() : "Little Sunbeam",
      image: mainImg,
      gallery: imgGallery,
      images: structuredImages,
      colorVariants: formattedColorVariants,
      colors: collectedColors.length > 0 ? collectedColors : (Array.isArray(colors) && colors.length > 0 ? colors : [{ name: "Default", hex: "#E5E7EB" }]),
      sizes: collectedSizes.size > 0 ? Array.from(collectedSizes) : (Array.isArray(sizes) && sizes.length > 0 ? sizes : ["Standard"]),
      stock: numericStock,
      lowStockThreshold: numericThreshold,
      stockStatus: initialStockStatus,
      sku: productSku,
      ageGroup: ageGroup || "0 - 3 Months",
      gender: gender || "Unisex",
      fabric: fabric ? fabric.trim() : "",
      pattern: pattern ? pattern.trim() : "",
      print: print ? String(print).trim() : (resolvedPrintIds.length > 0 ? String(resolvedPrintIds[0]) : ""),
      prints: resolvedPrintIds,
      sleeveType: sleeveType ? sleeveType.trim() : "",
      neckType: neckType ? neckType.trim() : "",
      fitType: fitType ? fitType.trim() : "",
      season: season ? season.trim() : "",
      variants: formattedVariants,
      careInstructions: careInstructions || "Machine wash cold with gentle baby detergent. Do not bleach. Tumble dry low.",
      washCare: washCare || "Gentle Hand/Machine Wash",
      countryOfOrigin: countryOfOrigin || "India",
      manufacturer: manufacturer || "Little Sunbeam Kidswear",
      productWeight: productWeight || "150g",
      returnEligibility: returnEligibility || "7-Day Return & Exchange Available",
      badge: badge || "",
      status: status || "Active",
      isFeatured: Boolean(isFeatured),
      isNewArrival: isNewArrival !== undefined ? Boolean(isNewArrival) : true,
      isActive: status === "Draft" || status === "Archived" ? false : (isActive !== undefined ? Boolean(isActive) : true),
      tags: Array.isArray(tags) ? tags : [],
    });

    const populatedProduct = await Product.findById(product._id).populate("prints");

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: {
        product: populatedProduct,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    let product = await Product.findById(id);
    if (!product) {
      product = await Product.findOne({ slug: id });
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const updates = { ...req.body };

    if (updates.name && updates.name.trim() !== product.name) {
      updates.slug =
        slugify(updates.name.trim(), { lower: true, strict: true }) +
        "-" +
        Math.random().toString(36).substring(2, 6);
    }

    if (updates.sku && updates.sku.toUpperCase() !== product.sku) {
      const skuExists = await Product.findOne({
        sku: updates.sku.toUpperCase(),
        _id: { $ne: product._id },
      });
      if (skuExists) {
        return res.status(400).json({
          success: false,
          message: "SKU is already in use by another product",
        });
      }
      updates.sku = updates.sku.toUpperCase();
    }

    if (updates.price !== undefined && Number(updates.price) < 0) {
      return res.status(400).json({
        success: false,
        message: "Selling price cannot be negative",
      });
    }

    if (updates.mrp !== undefined && Number(updates.mrp) < 0) {
      return res.status(400).json({
        success: false,
        message: "MRP cannot be negative",
      });
    }

    const finalPrice = updates.price !== undefined ? Number(updates.price) : product.price;
    const finalMrp = updates.mrp !== undefined ? Number(updates.mrp) : product.mrp;

    if (finalMrp < finalPrice) {
      return res.status(400).json({
        success: false,
        message: "MRP cannot be lower than Selling Price",
      });
    }

    // Recalculate discount
    if (finalMrp > finalPrice) {
      updates.discount = Math.round(((finalMrp - finalPrice) / finalMrp) * 100);
    } else {
      updates.discount = 0;
    }

    // Process Color Variants if updated
    if (Array.isArray(updates.colorVariants)) {
      let totalStockFromVariants = 0;
      const collectedColors = [];
      const collectedSizes = new Set();
      const collectedImages = [];
      const formattedVariants = [];

      updates.colorVariants = updates.colorVariants.map((cv, cvIdx) => {
        const colorName = cv.name ? cv.name.trim() : `Color ${cvIdx + 1}`;
        const colorHex = cv.hex ? cv.hex.trim() : "#E5E7EB";
        collectedColors.push({ name: colorName, hex: colorHex });

        const rawImages = Array.isArray(cv.images) ? cv.images : [];
        const normImages = rawImages.map((img, i) => {
          const url = typeof img === "string" ? img.trim() : (img.url ? img.url.trim() : "");
          const isPrimary = typeof img === "object" ? Boolean(img.isPrimary) : i === 0;
          if (url) collectedImages.push(url);
          return { url, isPrimary };
        }).filter((img) => Boolean(img.url));

        const primaryImgUrl = normImages.find((img) => img.isPrimary)?.url || normImages[0]?.url || "";

        const rawInventory = Array.isArray(cv.inventory) ? cv.inventory : [];
        const normInventory = rawInventory.map((inv) => {
          const sz = inv.size ? inv.size.trim() : "Standard";
          const st = Math.max(0, parseInt(inv.stock, 10) || 0);
          const colorSlug = colorName.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, "");
          const sizeSlug = sz.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
          const pSku = updates.sku || product.sku || "SUN";
          const variantSku = (inv.sku && inv.sku.trim() ? inv.sku.trim() : `${pSku}-${colorSlug || "DEF"}-${sizeSlug || "STD"}`).toUpperCase();

          totalStockFromVariants += st;
          collectedSizes.add(sz);

          const variantObj = {
            sku: variantSku,
            color: colorName,
            size: sz,
            stock: st,
            price: inv.price !== undefined && !isNaN(Number(inv.price)) ? Number(inv.price) : finalPrice,
            mrp: inv.mrp !== undefined && !isNaN(Number(inv.mrp)) ? Number(inv.mrp) : finalMrp,
            image: primaryImgUrl || updates.image || product.image || "",
          };
          formattedVariants.push(variantObj);

          return {
            size: sz,
            stock: st,
            sku: variantSku,
            price: variantObj.price,
            mrp: variantObj.mrp,
          };
        });

        const cvSizes = Array.isArray(cv.sizes) && cv.sizes.length > 0 ? cv.sizes : normInventory.map((inv) => inv.size);
        cvSizes.forEach((sz) => collectedSizes.add(sz));

        return {
          name: colorName,
          displayName: cv.displayName ? cv.displayName.trim() : colorName,
          hex: colorHex,
          images: normImages,
          sizes: cvSizes,
          inventory: normInventory,
        };
      });

      updates.stock = totalStockFromVariants;
      updates.colors = collectedColors;
      updates.sizes = Array.from(collectedSizes);
      updates.variants = formattedVariants;

      if (!updates.image && collectedImages.length > 0) {
        updates.image = collectedImages[0];
      }
      if (!updates.gallery && collectedImages.length > 0) {
        updates.gallery = Array.from(new Set(collectedImages));
      }
    }

    // Recalculate stock status
    const finalStock = updates.stock !== undefined ? Number(updates.stock) : product.stock;
    const finalThreshold = updates.lowStockThreshold !== undefined ? Number(updates.lowStockThreshold) : (product.lowStockThreshold || 10);
    if (finalStock <= 0) {
      updates.stockStatus = "Out of Stock";
    } else if (finalStock <= finalThreshold) {
      updates.stockStatus = "Low Stock";
    } else {
      updates.stockStatus = "In Stock";
    }

    if (updates.prints !== undefined || updates.print !== undefined) {
      const printSources = updates.prints !== undefined ? updates.prints : (updates.print ? [updates.print] : []);
      updates.prints = await resolvePrintIds(printSources);
      if (updates.print === undefined && updates.prints.length > 0) {
        updates.print = String(updates.prints[0]);
      }
    }

    if (updates.categoryId && !isValidObjectId(updates.categoryId)) {
      delete updates.categoryId;
    }
    if (updates.subCategoryId && !isValidObjectId(updates.subCategoryId)) {
      delete updates.subCategoryId;
    }

    if (updates.status) {
      if (updates.status === "Draft" || updates.status === "Archived") {
        updates.isActive = false;
      } else {
        updates.isActive = true;
      }
    }

    Object.assign(product, updates);
    await product.save();
    const updatedProduct = await Product.findById(product._id).populate("prints");

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: {
        product: updatedProduct,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    await Product.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully",
      data: {
        id,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
