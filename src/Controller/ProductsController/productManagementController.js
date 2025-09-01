const Product = require('../../Model/ProductsModel/product');
const Category = require('../../Model/ProductsModel/category');
const SubCategory = require('../../Model/ProductsModel/subCategory');
const Order = require('../../Model/ProductsModel/orderSchema');

const mongoose = require('mongoose');

// ======================= SUPERADMIN PRODUCT MANAGEMENT =======================

// Get all products with advanced filtering and analytics
exports.getAllProductsForAdmin = async (req, res) => {
    try {
        console.log('getAllProductsForAdmin called with query:', req.query);
        const {
            page = 1,
            limit = 20,
            search,
            category,
            subcategory,
            seller,
            status,
            minPrice,
            maxPrice,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            lowStock,
            featured
        } = req.query;

        // Build query
        const query = {};
        
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { brand: { $regex: search, $options: 'i' } },
                { sku: { $regex: search, $options: 'i' } }
            ];
        }
        
        if (category) {
            // Find category by name and use its ObjectId
            const categoryDoc = await Category.findOne({ name: { $regex: category, $options: 'i' } });
            if (categoryDoc) {
                query.category = categoryDoc._id;
            }
        }
        if (subcategory) query.subcategory = subcategory;
        if (seller) query.sellerId = seller;
        if (status === 'active') query.isActive = true;
        if (status === 'inactive') query.isActive = false;
        if (featured === 'true') query.isFeatured = true;
        
        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = Number(minPrice);
            if (maxPrice) query.price.$lte = Number(maxPrice);
        }
        
        if (lowStock === 'true') {
            query.$expr = { $lte: ['$quantity', '$lowStockThreshold'] };
        }

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Execute query with population
        const products = await Product.find(query)
            .populate('category', 'name')
            .populate('subcategory', 'name')
            .populate({
                path: 'sellerId',
                select: 'phone additionalInfo',
                populate: { path: 'additionalInfo', select: 'name email' }
            })
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        const total = await Product.countDocuments(query);
        const totalPages = Math.ceil(total / parseInt(limit));

        // Calculate analytics
        const analytics = await Product.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalProducts: { $sum: 1 },
                    activeProducts: { $sum: { $cond: ['$isActive', 1, 0] } },
                    featuredProducts: { $sum: { $cond: ['$isFeatured', 1, 0] } },
                    lowStockProducts: { $sum: { $cond: [{ $lte: ['$quantity', '$lowStockThreshold'] }, 1, 0] } },
                    totalValue: { $sum: { $multiply: ['$price', '$quantity'] } },
                    totalRevenue: { $sum: { $multiply: ['$price', '$saleCount'] } },
                    averagePrice: { $avg: '$price' }
                }
            }
        ]);

        // Get active sellers count
        const activeSellersCount = await Product.aggregate([
            { $match: query },
            {
                $group: {
                    _id: '$sellerId',
                    hasActiveProducts: { $sum: { $cond: ['$isActive', 1, 0] } }
                }
            },
            {
                $match: {
                    hasActiveProducts: { $gt: 0 }
                }
            },
            {
                $group: {
                    _id: null,
                    activeSellers: { $sum: 1 }
                }
            }
        ]);

        res.status(200).json({
            success: true,
            data: {
                products,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages,
                    totalProducts: total,
                    limit: parseInt(limit)
                },
                analytics: {
                    ...analytics[0] || {
                        totalProducts: 0,
                        activeProducts: 0,
                        featuredProducts: 0,
                        lowStockProducts: 0,
                        totalValue: 0,
                        totalRevenue: 0,
                        averagePrice: 0
                    },
                    activeSellers: activeSellersCount[0]?.activeSellers || 0
                }
            }
        });

    } catch (error) {
        console.error('Get all products for admin error:', error);
        res.status(500).json({
            success: false,
            message: "Error fetching products",
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get product analytics for superadmin
exports.getProductAnalytics = async (req, res) => {
    try {
        const { period = '30' } = req.query; // days
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(period));

        // Product performance analytics
        const productAnalytics = await Product.aggregate([
            {
                $lookup: {
                    from: 'orders',
                    localField: '_id',
                    foreignField: 'products.productId',
                    as: 'orders'
                }
            },
            {
                $addFields: {
                    totalSold: {
                        $sum: '$orders.products.quantity'
                    },
                    totalRevenue: {
                        $sum: {
                            $map: {
                                input: '$orders.products',
                                as: 'orderProduct',
                                in: {
                                    $cond: [
                                        { $eq: ['$$orderProduct.productId', '$_id'] },
                                        { $multiply: ['$$orderProduct.price', '$$orderProduct.quantity'] },
                                        0
                                    ]
                                }
                            }
                        }
                    }
                }
            },
            {
                $project: {
                    name: 1,
                    price: 1,
                    quantity: 1,
                    isActive: 1,
                    totalSold: 1,
                    totalRevenue: 1,
                    viewCount: 1
                }
            },
            { $sort: { totalRevenue: -1 } },
            { $limit: 10 }
        ]);

        // Category performance
        const categoryAnalytics = await Product.aggregate([
            {
                $lookup: {
                    from: 'categories',
                    localField: 'category',
                    foreignField: '_id',
                    as: 'categoryInfo'
                }
            },
            {
                $group: {
                    _id: '$category',
                    categoryName: { $first: '$categoryInfo.name' },
                    productCount: { $sum: 1 },
                    totalRevenue: {
                        $sum: {
                            $multiply: ['$price', '$saleCount']
                        }
                    },

                }
            },
            { $sort: { totalRevenue: -1 } }
        ]);

        // Seller performance
        const sellerAnalytics = await Product.aggregate([
            {
                $lookup: {
                    from: 'users',
                    localField: 'sellerId',
                    foreignField: '_id',
                    as: 'sellerInfo'
                }
            },
            {
                $group: {
                    _id: '$sellerId',
                    sellerName: { $first: '$sellerInfo.additionalInfo.name' },
                    productCount: { $sum: 1 },
                    totalRevenue: {
                        $sum: {
                            $multiply: ['$price', '$saleCount']
                        }
                    },
                    activeProducts: { $sum: { $cond: ['$isActive', 1, 0] } }
                }
            },
            { $sort: { totalRevenue: -1 } },
            { $limit: 10 }
        ]);

        // Get overall analytics summary
        const overallAnalytics = await Product.aggregate([
            {
                $group: {
                    _id: null,
                    totalProducts: { $sum: 1 },
                    activeProducts: { $sum: { $cond: ['$isActive', 1, 0] } },
                    featuredProducts: { $sum: { $cond: ['$isFeatured', 1, 0] } },
                    lowStockProducts: { $sum: { $cond: [{ $lte: ['$quantity', '$lowStockThreshold'] }, 1, 0] } },
                    totalValue: { $sum: { $multiply: ['$price', '$quantity'] } },
                    totalRevenue: { $sum: { $multiply: ['$price', '$saleCount'] } },
                    averagePrice: { $avg: '$price' }
                }
            }
        ]);

        // Get active sellers count
        const activeSellersCount = await Product.aggregate([
            {
                $group: {
                    _id: '$sellerId',
                    hasActiveProducts: { $sum: { $cond: ['$isActive', 1, 0] } }
                }
            },
            {
                $match: {
                    hasActiveProducts: { $gt: 0 }
                }
            },
            {
                $group: {
                    _id: null,
                    activeSellers: { $sum: 1 }
                }
            }
        ]);

        res.status(200).json({
            success: true,
            data: {
                ...overallAnalytics[0] || {
                    totalProducts: 0,
                    activeProducts: 0,
                    featuredProducts: 0,
                    lowStockProducts: 0,
                    totalValue: 0,
                    totalRevenue: 0,
                    averagePrice: 0
                },
                activeSellers: activeSellersCount[0]?.activeSellers || 0,
                topProducts: productAnalytics,
                categoryPerformance: categoryAnalytics,
                sellerPerformance: sellerAnalytics
            }
        });

    } catch (error) {
        console.error('Get product analytics error:', error);
        res.status(500).json({
            success: false,
            message: "Error fetching product analytics",
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Bulk update product status
exports.bulkUpdateProductStatus = async (req, res) => {
    try {
        const { productIds, isActive, isFeatured } = req.body;

        if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Product IDs array is required"
            });
        }

        const updateData = {};
        if (isActive !== undefined) updateData.isActive = isActive;
        if (isFeatured !== undefined) updateData.isFeatured = isFeatured;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one field to update is required"
            });
        }

        const result = await Product.updateMany(
            { _id: { $in: productIds } },
            updateData
        );

        res.status(200).json({
            success: true,
            message: `Successfully updated ${result.modifiedCount} products`,
            data: {
                modifiedCount: result.modifiedCount,
                totalCount: productIds.length
            }
        });

    } catch (error) {
        console.error('Bulk update product status error:', error);
        res.status(500).json({
            success: false,
            message: "Error updating products",
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get product details with full analytics
exports.getProductDetailsForAdmin = async (req, res) => {
    try {
        const { productId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID"
            });
        }

        const product = await Product.findById(productId)
            .populate('category', 'name')
            .populate('subcategory', 'name')
            .populate({
                path: 'sellerId',
                select: 'phone additionalInfo',
                populate: { path: 'additionalInfo', select: 'name email' }
            });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        // Get product orders
        const orders = await Order.find({
            'products.productId': productId
        }).populate('userId', 'additionalInfo');



        // Calculate order analytics
        let totalRevenue = 0;
        let totalQuantity = 0;
        const monthlySales = {};

        for (const order of orders) {
            const orderProduct = order.products.find(p => p.productId.toString() === productId);
            if (orderProduct) {
                const revenue = orderProduct.price * orderProduct.quantity;
                totalRevenue += revenue;
                totalQuantity += orderProduct.quantity;

                const month = new Date(order.createdAt).toISOString().slice(0, 7);
                monthlySales[month] = (monthlySales[month] || 0) + revenue;
            }
        }

        res.status(200).json({
            success: true,
            data: {
                product,
                analytics: {
                    totalOrders: orders.length,
                    totalRevenue,
                    totalQuantity,
                    averageOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
                    monthlySales: Object.entries(monthlySales).map(([month, revenue]) => ({
                        month,
                        revenue
                    })).sort((a, b) => b.month.localeCompare(a.month))
                },

            }
        });

    } catch (error) {
        console.error('Get product details for admin error:', error);
        res.status(500).json({
            success: false,
            message: "Error fetching product details",
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// ======================= SELLER PRODUCT MANAGEMENT =======================

// Get seller's product analytics
exports.getSellerProductAnalytics = async (req, res) => {
    try {
        const sellerId = req.user.id;
        const { period = '30' } = req.query; // days
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(period));

        // Get seller's products
        const products = await Product.find({ sellerId });

        // Get orders for seller's products
        const orders = await Order.find({
            'products.productId': { $in: products.map(p => p._id) },
            createdAt: { $gte: startDate }
        }).populate('products.productId');

        // Calculate analytics
        let totalRevenue = 0;
        let totalOrders = 0;
        let totalProductsSold = 0;
        const productPerformance = [];
        const monthlyRevenue = {};

        for (const product of products) {
            const productOrders = orders.filter(order =>
                order.products.some(op => op.productId._id.toString() === product._id.toString())
            );

            let productRevenue = 0;
            let productQuantity = 0;

            for (const order of productOrders) {
                const orderProduct = order.products.find(op =>
                    op.productId._id.toString() === product._id.toString()
                );
                if (orderProduct) {
                    const revenue = orderProduct.price * orderProduct.quantity;
                    productRevenue += revenue;
                    productQuantity += orderProduct.quantity;
                    totalRevenue += revenue;
                    totalProductsSold += orderProduct.quantity;

                    const month = new Date(order.createdAt).toISOString().slice(0, 7);
                    monthlyRevenue[month] = (monthlyRevenue[month] || 0) + revenue;
                }
            }

            productPerformance.push({
                productId: product._id,
                productName: product.name,
                revenue: productRevenue,
                quantitySold: productQuantity,
                averageRating: product.averageRating,
                reviewCount: product.reviewCount,
                viewCount: product.viewCount,
                isActive: product.isActive
            });
        }

        totalOrders = orders.length;

        res.status(200).json({
            success: true,
            data: {
                summary: {
                    totalProducts: products.length,
                    activeProducts: products.filter(p => p.isActive).length,
                    totalRevenue,
                    totalOrders,
                    totalProductsSold,
                    averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0
                },
                productPerformance: productPerformance.sort((a, b) => b.revenue - a.revenue),
                monthlyRevenue: Object.entries(monthlyRevenue).map(([month, revenue]) => ({
                    month,
                    revenue
                })).sort((a, b) => b.month.localeCompare(a.month))
            }
        });

    } catch (error) {
        console.error('Get seller product analytics error:', error);
        res.status(500).json({
            success: false,
            message: "Error fetching seller analytics",
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get seller's product performance
exports.getSellerProductPerformance = async (req, res) => {
    try {
        const sellerId = req.user.id;
        const { productId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID"
            });
        }

        // Verify product belongs to seller
        const product = await Product.findOne({ _id: productId, sellerId });
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        // Get product orders
        const orders = await Order.find({
            'products.productId': productId
        }).populate('userId', 'additionalInfo');



        // Calculate performance metrics
        let totalRevenue = 0;
        let totalQuantity = 0;
        const monthlySales = {};
        const dailySales = {};

        for (const order of orders) {
            const orderProduct = order.products.find(p => p.productId.toString() === productId);
            if (orderProduct) {
                const revenue = orderProduct.price * orderProduct.quantity;
                totalRevenue += revenue;
                totalQuantity += orderProduct.quantity;

                const month = new Date(order.createdAt).toISOString().slice(0, 7);
                const day = new Date(order.createdAt).toISOString().slice(0, 10);
                
                monthlySales[month] = (monthlySales[month] || 0) + revenue;
                dailySales[day] = (dailySales[day] || 0) + revenue;
            }
        }

        res.status(200).json({
            success: true,
            data: {
                product: {
                    _id: product._id,
                    name: product.name,
                    price: product.price,
                    quantity: product.quantity,
                    isActive: product.isActive,

                    viewCount: product.viewCount,
                    createdAt: product.createdAt
                },
                performance: {
                    totalOrders: orders.length,
                    totalRevenue,
                    totalQuantity,
                    averageOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
                    conversionRate: product.viewCount > 0 ? (orders.length / product.viewCount) * 100 : 0
                },
                sales: {
                    monthly: Object.entries(monthlySales).map(([month, revenue]) => ({
                        month,
                        revenue
                    })).sort((a, b) => b.month.localeCompare(a.month)),
                    daily: Object.entries(dailySales).map(([day, revenue]) => ({
                        day,
                        revenue
                    })).sort((a, b) => b.day.localeCompare(a.day))
                },

            }
        });

    } catch (error) {
        console.error('Get seller product performance error:', error);
        res.status(500).json({
            success: false,
            message: "Error fetching product performance",
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Update product status (active/inactive, featured)
exports.updateProductStatus = async (req, res) => {
    try {
        const sellerId = req.user.id;
        const { productId } = req.params;
        const { isActive, isFeatured } = req.body;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID"
            });
        }

        // Verify product belongs to seller
        const product = await Product.findOne({ _id: productId, sellerId });
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        // Update status
        const updateData = {};
        if (isActive !== undefined) updateData.isActive = isActive;
        if (isFeatured !== undefined) updateData.isFeatured = isFeatured;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one field to update is required"
            });
        }

        Object.assign(product, updateData);
        await product.save();

        res.status(200).json({
            success: true,
            message: "Product status updated successfully",
            data: {
                productId: product._id,
                isActive: product.isActive,
                isFeatured: product.isFeatured
            }
        });

    } catch (error) {
        console.error('Update product status error:', error);
        res.status(500).json({
            success: false,
            message: "Error updating product status",
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Update product for admin (superadmin can update any product)
exports.updateProductForAdmin = async (req, res) => {
    try {
        const { productId } = req.params;
        const updateData = req.body;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID"
            });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        // Update the product
        Object.assign(product, updateData);
        await product.save();

        res.status(200).json({
            success: true,
            message: "Product updated successfully",
            data: {
                product
            }
        });

    } catch (error) {
        console.error('Update product for admin error:', error);
        res.status(500).json({
            success: false,
            message: "Error updating product",
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Delete product for admin (superadmin can delete any product)
exports.deleteProductForAdmin = async (req, res) => {
    try {
        const { productId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID"
            });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        // Delete the product
        await Product.findByIdAndDelete(productId);

        res.status(200).json({
            success: true,
            message: "Product deleted successfully",
            data: {
                productId
            }
        });

    } catch (error) {
        console.error('Delete product for admin error:', error);
        res.status(500).json({
            success: false,
            message: "Error deleting product",
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};
