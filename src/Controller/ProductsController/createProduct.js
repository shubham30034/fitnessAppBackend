const Product = require("../../Model/ProductsModel/product");
const mongoose = require("mongoose");
const Category = require("../../Model/ProductsModel/category");
const fs = require('fs');
const path = require('path');
const xss = require('xss');
const { uploadMultipleImagesToCloudinary } = require("../../Utils/imageUploader");
const { createProductValidation, updateProductValidation } = require("../../validator/productValidation");
const { sanitizeInput } = require("../../Utils/sanitizer");

// Utility function for input sanitization
const sanitizeProductData = (data) => {
    return {
        name: data.name ? xss(data.name.trim()) : undefined,
        description: data.description ? xss(data.description.trim()) : undefined,
        brand: data.brand ? xss(data.brand.trim()) : undefined,
        price: data.price ? Number(data.price) : undefined,
        originalPrice: data.originalPrice ? Number(data.originalPrice) : undefined,
        discountPercentage: data.discountPercentage ? Number(data.discountPercentage) : undefined,
        quantity: data.quantity ? Number(data.quantity) : undefined,
        lowStockThreshold: data.lowStockThreshold ? Number(data.lowStockThreshold) : undefined,
        weight: data.weight ? Number(data.weight) : undefined,
        dimensions: data.dimensions ? {
            length: data.dimensions.length ? Number(data.dimensions.length) : undefined,
            width: data.dimensions.width ? Number(data.dimensions.width) : undefined,
            height: data.dimensions.height ? Number(data.dimensions.height) : undefined
        } : undefined,
        category: data.category,
        subcategory: data.subcategory,
        metaTitle: data.metaTitle ? xss(data.metaTitle.trim()) : undefined,
        metaDescription: data.metaDescription ? xss(data.metaDescription.trim()) : undefined,
        keywords: data.keywords ? data.keywords.map(k => xss(k.trim())) : undefined,
        isActive: data.isActive !== undefined ? data.isActive : true,
        isFeatured: data.isFeatured !== undefined ? data.isFeatured : false
    };
};

// Create Product with enhanced validation and security
exports.createProduct = async (req, res) => {
    // Use transactions only in production, not in test environment
    const useTransactions = process.env.NODE_ENV !== 'test';
    let session;
    
    if (useTransactions) {
        session = await mongoose.startSession();
        session.startTransaction();
    }
    
    try {
        const sellerId = req.user.id;
        const rawData = req.body;
        
        // Sanitize input data
        const sanitizedData = sanitizeProductData(rawData);
        
        // Validate input
        const validationResult = createProductValidation({ 
            ...sanitizedData, 
            sellerId 
        });
        
        const { error } = validationResult;
        
        if (error) {
            if (useTransactions) {
                await session.abortTransaction();
            }
            return res.status(400).json({ 
                success: false, 
                message: error.details[0].message 
            });
        }

        // Verify category exists
        const categoryExists = await Category.findById(sanitizedData.category);
        
        if (!categoryExists) {
            if (useTransactions) {
                await session.abortTransaction();
            }
            return res.status(404).json({ 
                success: false, 
                message: "Category not found" 
            });
        }

        // Check for duplicate product name by same seller
        let existingProduct;
        try {
            existingProduct = await Product.findOne({
                name: sanitizedData.name,
                sellerId,
                isActive: true
            });
        } catch (findError) {
            console.error('Find error:', findError);
            throw findError;
        }
        
        if (existingProduct) {
            if (useTransactions) {
                await session.abortTransaction();
            }
            return res.status(400).json({
                success: false,
                message: "A product with this name already exists"
            });
        }

        // Create product
        const newProduct = new Product({
            ...sanitizedData,
            sellerId,
            productImages: [],
            variants: rawData.variants || []
        });

        // Generate unique slug before saving
        try {
            console.log('🔍 Generating unique slug for:', sanitizedData.name);
            newProduct.slug = await Product.generateUniqueSlug(sanitizedData.name);
            console.log('🔍 Generated slug:', newProduct.slug);
            
            // Double-check slug uniqueness before saving
            const existingSlug = await Product.findOne({ slug: newProduct.slug });
            if (existingSlug) {
                console.log('🔍 WARNING: Generated slug already exists, using timestamp fallback');
                newProduct.slug = `${sanitizedData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
                console.log('🔍 Final fallback slug:', newProduct.slug);
            }
        } catch (slugError) {
            console.error('Error generating slug:', slugError);
            // Fallback to timestamp-based slug
            newProduct.slug = `${sanitizedData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
            console.log('🔍 Using fallback slug:', newProduct.slug);
        }

        try {
            console.log('🔍 Attempting to save product with slug:', newProduct.slug);
            if (useTransactions) {
                await newProduct.save({ session });
            } else {
                await newProduct.save();
            }
            console.log('🔍 Product saved successfully');
        } catch (saveError) {
            console.error('Save error:', saveError);
            
            // If it's a duplicate key error, try with a timestamp-based slug
            if (saveError.code === 11000 && saveError.keyPattern?.slug) {
                console.log('🔍 Duplicate slug error during save, retrying with timestamp');
                newProduct.slug = `${sanitizedData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                console.log('🔍 New timestamp slug:', newProduct.slug);
                
                if (useTransactions) {
                    await newProduct.save({ session });
                } else {
                    await newProduct.save();
                }
                console.log('🔍 Product saved successfully with timestamp slug');
            } else {
                throw saveError;
            }
        }

        if (useTransactions) {
            try {
                await session.commitTransaction();
            } catch (commitError) {
                console.error('Commit error:', commitError);
                throw commitError;
            }
        }

        return res.status(201).json({
            success: true,
            message: "Product created successfully. Upload images separately.",
            data: {
                id: newProduct._id,
                name: newProduct.name,
                sku: newProduct.sku,
                slug: newProduct.slug
            }
        });

    } catch (error) {
        if (useTransactions) {
            await session.abortTransaction();
        }
        
        // Handle duplicate key errors specifically
        if (error.code === 11000) {
            console.error('Duplicate key error:', error.keyValue);
            return res.status(400).json({
                success: false,
                message: `Duplicate ${Object.keys(error.keyValue)[0]} found. Please use a different value.`,
                error: process.env.NODE_ENV === 'test' ? error.message : 'Duplicate key error'
            });
        }
        
        console.error('Product creation error:', error);
        
        return res.status(500).json({
            success: false,
            message: "Error creating product",
            error: process.env.NODE_ENV === 'test' ? error.message : 'Internal server error'
        });
    } finally {
        if (useTransactions) {
            try {
                session.endSession();
            } catch (endSessionError) {
                console.error('End session error:', endSessionError);
            }
        }
    }
};

// Update Product with enhanced security
exports.updateProduct = async (req, res) => {
    // Use transactions only in production, not in test environment
    const useTransactions = process.env.NODE_ENV !== 'test';
    let session;
    let sanitizedData;
    
    if (useTransactions) {
        session = await mongoose.startSession();
        session.startTransaction();
    }
    
    try {
        const productId = req.params.id;
        const sellerId = req.user.id;
        const rawData = req.body;

        // Validate product ID
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            if (useTransactions) {
                await session.abortTransaction();
            }
            return res.status(400).json({
                success: false,
                message: "Invalid product ID"
            });
        }

        // Sanitize input data
        sanitizedData = sanitizeProductData(rawData);

        // Validate input
        const { error } = updateProductValidation({ 
            productId, 
            ...sanitizedData 
        });
        
        if (error) {
            if (useTransactions) {
                await session.abortTransaction();
            }
            return res.status(400).json({ 
                success: false, 
                message: error.details ? error.details[0].message : 'Validation error'
            });
        }

        // Verify category exists
        if (sanitizedData.category) {
            const categoryExists = await Category.findById(sanitizedData.category);
            if (!categoryExists) {
                if (useTransactions) {
                    await session.abortTransaction();
                }
                return res.status(404).json({ 
                    success: false, 
                    message: "Category not found" 
                });
            }
        }

        // Find and verify product ownership
        const product = useTransactions 
            ? await Product.findOne({ 
                _id: productId, 
                sellerId 
            }).session(session)
            : await Product.findOne({ 
                _id: productId, 
                sellerId 
            });
        
        if (!product) {
            if (useTransactions) {
                await session.abortTransaction();
            }
            return res.status(404).json({ 
                success: false, 
                message: "Product not found or unauthorized" 
            });
        }

        // Check for duplicate name (excluding current product)
        if (sanitizedData.name && sanitizedData.name !== product.name) {
            const existingProduct = useTransactions
                ? await Product.findOne({
                    name: sanitizedData.name,
                    sellerId,
                    isActive: true,
                    _id: { $ne: productId }
                }).session(session)
                : await Product.findOne({
                    name: sanitizedData.name,
                    sellerId,
                    isActive: true,
                    _id: { $ne: productId }
                });
            
            if (existingProduct) {
                if (useTransactions) {
                    await session.abortTransaction();
                }
                return res.status(400).json({
                    success: false,
                    message: "A product with this name already exists"
                });
            }
        }

        // Update product
        Object.assign(product, sanitizedData);
        
        // If name changed, generate new unique slug
        if (sanitizedData.name && sanitizedData.name !== product.name) {
            try {
                console.log('🔍 Name changed, generating new slug for:', sanitizedData.name);
                console.log('🔍 Excluding product ID:', productId);
                product.slug = await Product.generateUniqueSlug(sanitizedData.name, productId);
                console.log('🔍 New slug generated:', product.slug);
                
                // Double-check slug uniqueness before saving
                const existingSlug = await Product.findOne({ 
                    slug: product.slug,
                    _id: { $ne: productId }
                });
                if (existingSlug) {
                    console.log('🔍 WARNING: Generated slug already exists, using timestamp fallback');
                    product.slug = `${sanitizedData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
                    console.log('🔍 Final fallback slug:', product.slug);
                }
            } catch (slugError) {
                console.error('Error generating slug:', slugError);
                // Fallback to timestamp-based slug
                product.slug = `${sanitizedData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
                console.log('🔍 Using fallback slug:', product.slug);
            }
        } else {
            console.log('🔍 Name unchanged, keeping existing slug:', product.slug);
        }
        
        try {
            console.log('🔍 Attempting to save updated product with slug:', product.slug);
            if (useTransactions) {
                await product.save({ session });
            } else {
                await product.save();
            }
            console.log('🔍 Product updated successfully');
        } catch (saveError) {
            console.error('Save error during update:', saveError);
            
            // If it's a duplicate key error, try with a timestamp-based slug
            if (saveError.code === 11000 && saveError.keyPattern?.slug) {
                console.log('🔍 Duplicate slug error during update, retrying with timestamp');
                product.slug = `${sanitizedData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                console.log('🔍 New timestamp slug for update:', product.slug);
                
                if (useTransactions) {
                    await product.save({ session });
                } else {
                    await product.save();
                }
                console.log('🔍 Product updated successfully with timestamp slug');
            } else {
                throw saveError;
            }
        }

        if (useTransactions) {
            await session.commitTransaction();
        }

        return res.status(200).json({
            success: true,
            message: "Product updated successfully",
            data: {
                id: product._id,
                name: product.name,
                sku: product.sku,
                slug: product.slug,
                updatedAt: product.updatedAt
            }
        });

    } catch (error) {
        if (useTransactions) {
            await session.abortTransaction();
        }
        
        // Handle duplicate key errors specifically
        if (error.code === 11000) {
            console.error('Duplicate key error:', error.keyValue);
            return res.status(400).json({
                success: false,
                message: `Duplicate ${Object.keys(error.keyValue)[0]} found. Please use a different value.`,
                error: process.env.NODE_ENV === 'test' ? error.message : 'Duplicate key error'
            });
        }
        
        console.error('Product update error:', error);
        console.error('Error stack:', error.stack);
        console.error('Sanitized data that caused error:', sanitizedData);
        
        return res.status(500).json({
            success: false,
            message: "Error updating product",
            error: process.env.NODE_ENV === 'test' ? error.message : 'Internal server error'
        });
    } finally {
        if (useTransactions) {
            session.endSession();
        }
    }
};

// Upload Product Images with enhanced security and optimization
exports.uploadProductImages = async (req, res) => {
    try {
        const productId = req.params.productId;
        const sellerId = req.user.id;

        // Validate product ID
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            cleanupFiles(req.files);
            return res.status(400).json({ 
                success: false, 
                message: "Invalid product ID" 
            });
        }

        // Find product and verify ownership
        const product = await Product.findOne({ 
            _id: productId, 
            sellerId 
        });
        
        if (!product) {
            cleanupFiles(req.files);
            return res.status(404).json({ 
                success: false, 
                message: "Product not found or unauthorized" 
            });
        }

        // Check image limit
        const existingCount = product.productImages.length;
        const newCount = req.files.length;
        const maxImages = 5;

        if (existingCount + newCount > maxImages) {
            cleanupFiles(req.files);
            return res.status(400).json({
                success: false,
                message: `Maximum ${maxImages} images allowed. You can upload ${maxImages - existingCount} more image(s).`
            });
        }

        // Import image optimization utilities
        const {
            optimizeProductImage,
            generateResponsiveUrls,
            cleanupOldImages,
            isSharpAvailable,
            generateFallbackResponsiveImages
        } = require('../../Utils/imageOptimizer');

        const optimizedImages = [];
        const uploadDir = path.dirname(req.files[0].path);

        // Process each uploaded file
        for (const file of req.files) {
            try {
                // Generate optimized versions
                let optimizedSizes;
                if (isSharpAvailable()) {
                    optimizedSizes = await optimizeProductImage(file.path, uploadDir, file.filename);
                } else {
                    console.log('Using fallback image processing');
                    optimizedSizes = await generateFallbackResponsiveImages(file.path, uploadDir, file.filename);
                }
                
                optimizedImages.push({
                    original: file.filename,
                    optimized: optimizedSizes
                });
            } catch (error) {
                console.error('Image optimization error:', error);
                cleanupFiles(req.files);
                return res.status(500).json({
                    success: false,
                    message: "Image optimization failed"
                });
            }
        }

        // Update product with new images
        const filenames = req.files.map(file => file.filename);
        product.productImages.push(...filenames);
        
        if (!product.productImagesOptimized) {
            product.productImagesOptimized = [];
        }
        product.productImagesOptimized.push(...optimizedImages);
        
        await product.save();

        // Generate responsive URLs
        const baseUrl = `/uploads/products/${productId}`;
        const responsiveData = optimizedImages.map(img => ({
            original: img.original,
            responsiveUrls: generateResponsiveUrls(baseUrl, img.original)
        }));

        res.status(200).json({
            success: true,
            message: "Images uploaded and optimized successfully",
            data: {
                productId: product._id,
                totalImages: product.productImages.length,
                optimizedImages: responsiveData
            }
        });

    } catch (error) {
        cleanupFiles(req.files);
        console.error('Product image upload error:', error);
        res.status(500).json({ 
            success: false, 
            message: "Upload failed", 
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Update specific product image with enhanced security
exports.updateSpecificProductImage = async (req, res) => {
    try {
        const productId = req.params.productId;
        const sellerId = req.user.id;
        const oldFilename = req.body.filename;

        // Validate inputs
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            cleanupFiles(req.files);
            return res.status(400).json({ 
                success: false, 
                message: "Invalid product ID" 
            });
        }

        if (!oldFilename) {
            cleanupFiles(req.files);
            return res.status(400).json({ 
                success: false, 
                message: "Please provide filename to replace" 
            });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: "No new image uploaded" 
            });
        }

        // Find product and verify ownership
        const product = await Product.findOne({ 
            _id: productId, 
            sellerId 
        });
        
        if (!product) {
            cleanupFiles(req.files);
            return res.status(404).json({ 
                success: false, 
                message: "Product not found or unauthorized" 
            });
        }

        // Find index of old filename
        const idx = product.productImages.findIndex(img => 
            img.trim().toLowerCase() === oldFilename.trim().toLowerCase()
        );

        if (idx === -1) {
            cleanupFiles(req.files);
            return res.status(400).json({ 
                success: false, 
                message: "Old filename not found in product images" 
            });
        }

        // Delete old image file
        const imageDir = path.join(__dirname, `../../../uploads/products/${productId}`);
        const oldFilePath = path.join(imageDir, product.productImages[idx]);
        
        if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
        }

        // Replace with new image
        const newFilename = req.files[0].filename;
        product.productImages[idx] = newFilename;

        // Update optimized images array if it exists
        if (product.productImagesOptimized && product.productImagesOptimized[idx]) {
            // Process new image for optimization
            const {
                optimizeProductImage,
                generateResponsiveUrls,
                isSharpAvailable,
                generateFallbackResponsiveImages
            } = require('../../Utils/imageOptimizer');

            const uploadDir = path.dirname(req.files[0].path);
            let optimizedSizes;
            
            if (isSharpAvailable()) {
                optimizedSizes = await optimizeProductImage(req.files[0].path, uploadDir, newFilename);
            } else {
                optimizedSizes = await generateFallbackResponsiveImages(req.files[0].path, uploadDir, newFilename);
            }

            product.productImagesOptimized[idx] = {
                original: newFilename,
                optimized: optimizedSizes
            };
        }

        await product.save();

        res.status(200).json({
            success: true,
            message: "Product image updated successfully",
            data: {
                productId: product._id,
                updatedImage: newFilename
            }
        });

    } catch (error) {
        cleanupFiles(req.files);
        console.error('Image update error:', error);
        res.status(500).json({ 
            success: false, 
            message: "Update failed", 
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get all products with pagination, filtering, and caching
exports.getAllProducts = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 12,
            category,
            subcategory,
            minPrice,
            maxPrice,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            search,
            brand,
            inStock,
            featured
        } = req.query;

        // Build query
        const query = { isActive: true };
        
        if (category) query.category = category;
        if (subcategory) query.subcategory = subcategory;
        if (brand) query.brand = { $regex: brand, $options: 'i' };
        if (featured === 'true') query.isFeatured = true;
        if (inStock === 'true') query.quantity = { $gt: 0 };
        
        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = Number(minPrice);
            if (maxPrice) query.price.$lte = Number(maxPrice);
        }
        
        if (search) {
            query.$text = { $search: search };
        }

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // Execute query with population
        const products = await Product.find(query)
            .populate("category", "name")
            .populate("subcategory", "name")
            .populate({
                path: "sellerId",
                select: "phone additionalInfo",
                populate: { path: "additionalInfo", select: "name email" }
            })
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        // Get total count for pagination
        const total = await Product.countDocuments(query);

        // Calculate pagination info
        const totalPages = Math.ceil(total / parseInt(limit));
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        res.status(200).json({
            success: true,
            message: "Products fetched successfully",
            data: {
                products,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages,
                    totalProducts: total,
                    hasNextPage,
                    hasPrevPage,
                    limit: parseInt(limit)
                }
            }
        });
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ 
            success: false, 
            message: "Server error", 
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get seller's own products with enhanced features
exports.getOwnProducts = async (req, res) => {
    try {
        const sellerId = req.user.id;

        // ✅ Always validate and cast sellerId to ObjectId
        let validSellerId;
        if (mongoose.Types.ObjectId.isValid(sellerId)) {
            validSellerId = sellerId; // Keep as string for query matching
        } else {
            return res.status(400).json({
                success: false,
                message: "Invalid seller ID"
            });
        }

        // Extract query parameters
        const {
            search,
            category,
            subcategory,
            status,
            page = 1,
            limit = 10,
            sortBy = "createdAt",
            sortOrder = "desc"
        } = req.query;

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);

        // Build query
        const query = { sellerId: validSellerId };

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } },
                { brand: { $regex: search, $options: "i" } },
                { sku: { $regex: search, $options: "i" } }
            ];
        }

        if (category) query.category = category;
        if (subcategory) query.subcategory = subcategory;
        if (status === "active") query.isActive = true;
        if (status === "inactive") query.isActive = false;

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === "desc" ? -1 : 1;

        // Calculate pagination
        const skip = (pageNum - 1) * limitNum;

        // Execute query
        const products = await Product.find(query)
            .populate("category", "name")
            .populate("subcategory", "name")
            .sort(sort)
            .skip(skip)
            .limit(limitNum)
            .lean();

        const total = await Product.countDocuments(query);
        const totalPages = Math.ceil(total / limitNum);

        // Calculate analytics
        let analytics;
        try {
            const result = await Product.aggregate([
                { $match: { sellerId: validSellerId } },
                {
                    $group: {
                        _id: null,
                        totalProducts: { $sum: 1 },
                        activeProducts: { $sum: { $cond: ["$isActive", 1, 0] } },
                        totalViews: { $sum: { $ifNull: ["$viewCount", 0] } },
                        totalSales: { $sum: { $ifNull: ["$saleCount", 0] } },
                        averageRating: { $avg: { $ifNull: ["$averageRating", 0] } },
                        lowStockProducts: {
                            $sum: {
                                $cond: [
                                    { $lte: ["$quantity", { $ifNull: ["$lowStockThreshold", 0] }] },
                                    1,
                                    0
                                ]
                            }
                        }
                    }
                }
            ]);

            analytics = result.length
                ? result[0]
                : {
                      totalProducts: 0,
                      activeProducts: 0,
                      totalViews: 0,
                      totalSales: 0,
                      averageRating: 0,
                      lowStockProducts: 0
                  };
        } catch (aggregateError) {
            console.error("Analytics aggregation error:", aggregateError);
            analytics = {
                totalProducts: 0,
                activeProducts: 0,
                totalViews: 0,
                totalSales: 0,
                averageRating: 0,
                lowStockProducts: 0
            };
        }

        res.status(200).json({
            success: true,
            data: {
                products,
                pagination: {
                    currentPage: pageNum,
                    totalPages,
                    totalProducts: total,
                    limit: limitNum
                },
                analytics
            }
        });
    } catch (error) {
        console.error("Get own products error:", error);
        console.error("Error stack:", error.stack);
        res.status(500).json({
            success: false,
            message: "Server error",
            error:
                process.env.NODE_ENV === "test"
                    ? error.message
                    : "Internal server error"
        });
    }
};
// Get single product with enhanced data
exports.getSingleProduct = async (req, res) => {
    try {
        const productId = req.params.id;

        // Validate product ID
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID"
            });
        }

        // Fetch + increment in one step, only active products
        const product = await Product.findOneAndUpdate(
            { _id: productId, isActive: true },
            { $inc: { viewCount: 1 } },
            { new: true } // return updated product
        )
        .populate("category", "name description")
        .populate("subcategory", "name")
        .populate({
            path: "sellerId",
            select: "phone additionalInfo",
            populate: { path: "additionalInfo", select: "name email" }
        });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        res.status(200).json({
            success: true,
            data: product
        });
    } catch (error) {
        console.error("Get single product error:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : "Internal server error"
        });
    }
};

// Get products by category with pagination
exports.getProductByCategory = async (req, res) => {
    try {
        const categoryId = req.params.categoryId;
        const { page = 1, limit = 12, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

        // Validate category ID
        if (!mongoose.Types.ObjectId.isValid(categoryId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid category ID"
            });
        }

        // Verify category exists
        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        // Build query
        const query = { 
            category: categoryId, 
            isActive: true 
        };

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Execute query
        const products = await Product.find(query)
            .populate("category", "name")
            .populate("subcategory", "name")
            .populate({
                path: "sellerId",
                select: "phone additionalInfo",
                populate: { path: "additionalInfo", select: "name email" }
            })
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        const total = await Product.countDocuments(query);
        const totalPages = Math.ceil(total / parseInt(limit));

        if (!products || products.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: "No products found in this category" 
            });
        }

        res.status(200).json({
            success: true,
            message: "Products fetched successfully",
            data: {
                category: {
                    id: category._id,
                    name: category.name,
                    description: category.description
                },
                products,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages,
                    totalProducts: total,
                    limit: parseInt(limit)
                }
            }
        });
        
    } catch (error) {
        console.error('Get products by category error:', error);
        res.status(500).json({
            success: false,
            message: "Error fetching products by category",
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Delete product with enhanced security
exports.deleteProduct = async (req, res) => {
    // Use transactions only in production, not in test environment
    const useTransactions = process.env.NODE_ENV !== 'test';
    let session;
    
    if (useTransactions) {
        session = await mongoose.startSession();
        session.startTransaction();
    }
    
    try {
        const productId = req.params.id;
        const sellerId = req.user.id;

        // Validate product ID
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            if (useTransactions) {
                await session.abortTransaction();
            }
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid product ID' 
            });
        }

        // Find product and verify ownership
        const product = useTransactions
            ? await Product.findOne({ 
                _id: productId, 
                sellerId 
            }).session(session)
            : await Product.findOne({ 
                _id: productId, 
                sellerId 
            });

        if (!product) {
            if (useTransactions) {
                await session.abortTransaction();
            }
            return res.status(404).json({ 
                success: false, 
                message: 'Product not found or unauthorized' 
            });
        }

        // Check if product has active orders
        const Order = require('../../Model/ProductsModel/orderSchema');
        const activeOrders = useTransactions
            ? await Order.find({
                'products.productId': productId,
                status: { $in: ['Pending', 'Confirmed', 'Shipped'] }
            }).session(session)
            : await Order.find({
                'products.productId': productId,
                status: { $in: ['Pending', 'Confirmed', 'Shipped'] }
            });

        if (activeOrders.length > 0) {
            if (useTransactions) {
                await session.abortTransaction();
            }
            return res.status(400).json({
                success: false,
                message: 'Cannot delete product with active orders'
            });
        }

        // Delete product images from filesystem
        const imageDir = path.join(__dirname, `../../uploads/products/${productId}`);
        if (fs.existsSync(imageDir)) {
            fs.readdirSync(imageDir).forEach(file => {
                const filePath = path.join(imageDir, file);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            });
            fs.rmdirSync(imageDir);
        }

        // Delete the product
        if (useTransactions) {
            await Product.findByIdAndDelete(productId).session(session);
        } else {
            await Product.findByIdAndDelete(productId);
        }

        if (useTransactions) {
            await session.commitTransaction();
        }

        res.status(200).json({ 
            success: true, 
            message: 'Product deleted successfully' 
        });

    } catch (error) {
        if (useTransactions) {
            await session.abortTransaction();
        }
        console.error('Delete product error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error', 
            error: process.env.NODE_ENV === 'test' ? error.message : 'Internal server error'
        });
    } finally {
        if (useTransactions) {
            session.endSession();
        }
    }
};

// Utility function to cleanup uploaded files
const cleanupFiles = (files) => {
    if (files && Array.isArray(files)) {
        files.forEach(file => {
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
        });
    }
};
