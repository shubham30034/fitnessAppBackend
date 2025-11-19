const Product = require('../../Model/ProductsModel/product');
const Category = require('../../Model/ProductsModel/category');
const SubCategory = require('../../Model/ProductsModel/subCategory');
const Order = require('../../Model/ProductsModel/orderSchema');
const puppeteer = require('puppeteer');

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
        console.log('🔍 Analytics: getSellerProductAnalytics called');
        const sellerId = req.user.id;
        const { period = '30' } = req.query; // days
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(period));

        console.log('🔍 Analytics: Seller ID:', sellerId);
        console.log('🔍 Analytics: Period:', period, 'days');
        console.log('🔍 Analytics: Start date:', startDate);

        // Get seller's products
        const products = await Product.find({ sellerId });
        console.log('🔍 Analytics: Found products:', products.length);

        // Get orders for seller's products (if any exist)
        let orders = [];
        try {
            orders = await Order.find({
                'products.productId': { $in: products.map(p => p._id) },
                createdAt: { $gte: startDate }
            }).populate('products.productId');
            console.log('🔍 Analytics: Found orders:', orders.length);
        } catch (orderError) {
            console.log('🔍 Analytics: No orders found or Order model not available:', orderError.message);
            orders = [];
        }

        // Calculate analytics
        let totalRevenue = 0;
        let totalOrders = orders.length;
        let totalProductsSold = 0;
        const productPerformance = [];
        const monthlyRevenue = {};

        // Calculate potential revenue from products (price * saleCount)
        const potentialRevenue = products.reduce((sum, product) => {
            return sum + (product.price * (product.saleCount || 0));
        }, 0);

        // Process orders if they exist
        if (orders.length > 0) {
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
                    averageRating: product.averageRating || 0,
                    reviewCount: product.reviewCount || 0,
                    viewCount: product.viewCount || 0,
                    isActive: product.isActive,
                    price: product.price,
                    potentialRevenue: product.price * (product.saleCount || 0)
                });
            }
        } else {
            // If no orders, create performance data from product data
            for (const product of products) {
                productPerformance.push({
                    productId: product._id,
                    productName: product.name,
                    revenue: 0, // No actual revenue without orders
                    quantitySold: product.saleCount || 0,
                    averageRating: product.averageRating || 0,
                    reviewCount: product.reviewCount || 0,
                    viewCount: product.viewCount || 0,
                    isActive: product.isActive,
                    price: product.price,
                    potentialRevenue: product.price * (product.saleCount || 0)
                });
            }
        }

        // Sort product performance by potential revenue if no actual revenue
        if (totalRevenue === 0) {
            productPerformance.sort((a, b) => b.potentialRevenue - a.potentialRevenue);
        } else {
            productPerformance.sort((a, b) => b.revenue - a.revenue);
        }

        const analyticsData = {
            summary: {
                totalProducts: products.length,
                activeProducts: products.filter(p => p.isActive).length,
                totalRevenue: totalRevenue || 0,
                potentialRevenue: potentialRevenue,
                totalOrders: totalOrders,
                totalProductsSold: totalProductsSold || products.reduce((sum, p) => sum + (p.saleCount || 0), 0),
                averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
                totalViews: products.reduce((sum, p) => sum + (p.viewCount || 0), 0),
                averageRating: products.length > 0 ? 
                    products.reduce((sum, p) => sum + (p.averageRating || 0), 0) / products.length : 0
            },
            productPerformance: productPerformance,
            monthlyRevenue: Object.entries(monthlyRevenue).map(([month, revenue]) => ({
                month,
                revenue
            })).sort((a, b) => b.month.localeCompare(a.month))
        };

        console.log('🔍 Analytics: Returning data:', {
            summary: analyticsData.summary,
            productCount: analyticsData.productPerformance.length,
            monthlyRevenueCount: analyticsData.monthlyRevenue.length
        });

        res.status(200).json({
            success: true,
            data: analyticsData
        });

    } catch (error) {
        console.error('🔍 Analytics: Get seller product analytics error:', error);
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

// ======================= SELLER ORDER MANAGEMENT =======================

// List orders for the authenticated seller (orders containing seller's products)
exports.listSellerOrders = async (req, res) => {
    try {
        const sellerId = req.user.id;

        // Find all product ids that belong to this seller
        const sellerProducts = await Product.find({ sellerId }).select('_id name productImages price');
        const productIdList = sellerProducts.map(p => p._id);

        if (productIdList.length === 0) {
            return res.status(200).json({ success: true, data: [] });
        }

        // Find orders that include any of the seller's products
        const orders = await Order.find({
            'products.productId': { $in: productIdList }
        })
            .populate({ path: 'userId', select: 'phone additionalInfo' })
            .sort({ createdAt: -1 });

        // Build response tailored for Sales UI
        const shaped = orders.map(order => {
            // Filter only this seller's products per order
            const orderProductsForSeller = order.products
                .filter(p => productIdList.some(id => id.toString() === p.productId.toString()))
                .map(p => {
                    const productDoc = sellerProducts.find(sp => sp._id.toString() === p.productId.toString());
                    return {
                        name: productDoc?.name || 'Product',
                        price: p.price,
                        quantity: p.quantity,
                        image: Array.isArray(productDoc?.productImages) && productDoc.productImages.length > 0 ? productDoc.productImages[0] : undefined
                    };
                });

            const totalAmount = orderProductsForSeller.reduce((sum, p) => sum + (p.price * p.quantity), 0);

            return {
                _id: order._id,
                orderNumber: `ORD-${order._id.toString().slice(-6).toUpperCase()}`,
                customer: {
                    name: order.userId?.additionalInfo?.name || 'Customer',
                    email: order.userId?.additionalInfo?.email || '',
                    phone: order.userId?.phone || ''
                },
                products: orderProductsForSeller,
                totalAmount,
                status: (order.status || 'Pending').toLowerCase(),
                paymentStatus: (order.paymentStatus || 'Pending').toLowerCase(),
                shippingAddress: {
                    address: order.address || '',
                    city: '',
                    state: '',
                    zipCode: ''
                },
                createdAt: order.createdAt,
                updatedAt: order.updatedAt
            };
        });

        res.status(200).json({ success: true, data: shaped });
    } catch (error) {
        console.error('Seller orders list error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch seller orders' });
    }
};

// Get single order details for the seller (only products belonging to seller)
exports.getSellerOrderDetails = async (req, res) => {
    try {
        const sellerId = req.user.id;
        const { orderId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ success: false, message: 'Invalid order ID' });
        }

        const sellerProducts = await Product.find({ sellerId }).select('_id name productImages price');
        const productIdList = sellerProducts.map(p => p._id.toString());

        const order = await Order.findById(orderId)
            .populate({ path: 'userId', select: 'phone additionalInfo' });

        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        // Keep only the part of the order related to this seller
        const orderProductsForSeller = order.products
            .filter(p => productIdList.includes(p.productId.toString()))
            .map(p => {
                const productDoc = sellerProducts.find(sp => sp._id.toString() === p.productId.toString());
                return {
                    name: productDoc?.name || 'Product',
                    price: p.price,
                    quantity: p.quantity,
                    image: Array.isArray(productDoc?.productImages) && productDoc.productImages.length > 0 ? productDoc.productImages[0] : undefined
                };
            });

        const totalAmount = orderProductsForSeller.reduce((sum, p) => sum + (p.price * p.quantity), 0);

        const shaped = {
            _id: order._id,
            orderNumber: `ORD-${order._id.toString().slice(-6).toUpperCase()}`,
            customer: {
                name: order.userId?.additionalInfo?.name || 'Customer',
                email: order.userId?.additionalInfo?.email || '',
                phone: order.userId?.phone || ''
            },
            products: orderProductsForSeller,
            totalAmount,
            status: (order.status || 'Pending').toLowerCase(),
            paymentStatus: (order.paymentStatus || 'Pending').toLowerCase(),
            shippingAddress: {
                address: order.address || '',
                city: '',
                state: '',
                zipCode: ''
            },
            createdAt: order.createdAt,
            updatedAt: order.updatedAt
        };

        res.status(200).json({ success: true, data: shaped });
    } catch (error) {
        console.error('Seller order details error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch order details' });
    }
};

// Update order status (seller can move order through allowed statuses)
exports.updateSellerOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ success: false, message: 'Invalid order ID' });
        }

        const allowed = ['pending', 'processing', 'shipped', 'completed', 'cancelled'];
        if (!allowed.includes((status || '').toLowerCase())) {
            return res.status(400).json({ success: false, message: 'Invalid status value' });
        }

        const updated = await Order.findByIdAndUpdate(orderId, { status: status.charAt(0).toUpperCase() + status.slice(1) }, { new: true });
        if (!updated) return res.status(404).json({ success: false, message: 'Order not found' });

        res.status(200).json({ success: true, message: 'Status updated' });
    } catch (error) {
        console.error('Update seller order status error:', error);
        res.status(500).json({ success: false, message: 'Failed to update order status' });
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

// Export products as PDF for superadmin
exports.exportProductsAsPDF = async (req, res) => {
    try {
        console.log('exportProductsAsPDF called with query:', req.query);
        const {
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

        // Build query (same as getAllProductsForAdmin but without pagination)
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
            if (minPrice) query.price.$gte = parseFloat(minPrice);
            if (maxPrice) query.price.$lte = parseFloat(maxPrice);
        }
        
        if (lowStock === 'true') {
            query.$expr = { $lte: ['$quantity', '$lowStockThreshold'] };
        }

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Get all products matching the query (no pagination for export)
        const products = await Product.find(query)
            .populate('category', 'name')
            .populate('subcategory', 'name')
            .populate('sellerId', 'additionalInfo')
            .sort(sort)
            .lean();

        console.log(`Found ${products.length} products for PDF export`);

        // Generate HTML content for PDF
        const htmlContent = generateProductsHTML(products, {
            search,
            category,
            subcategory,
            seller,
            status,
            minPrice,
            maxPrice,
            sortBy,
            sortOrder,
            lowStock,
            featured
        });

        // Launch puppeteer and generate PDF
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20mm',
                right: '15mm',
                bottom: '20mm',
                left: '15mm'
            }
        });

        await browser.close();

        // Set headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="products_export_${new Date().toISOString().split('T')[0]}.pdf"`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Export products as PDF error:', error);
        res.status(500).json({
            success: false,
            message: "Error exporting products as PDF",
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Helper function to generate HTML content for PDF
function generateProductsHTML(products, filters) {
    const currentDate = new Date().toLocaleDateString();
    const totalProducts = products.length;
    
    // Calculate summary statistics
    const activeProducts = products.filter(p => p.isActive).length;
    const featuredProducts = products.filter(p => p.isFeatured).length;
    const totalValue = products.reduce((sum, p) => sum + (p.price * p.quantity), 0);
    const totalRevenue = products.reduce((sum, p) => sum + (p.price * (p.saleCount || 0)), 0);

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Products Export Report</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 20px;
                color: #333;
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
                border-bottom: 2px solid #2563eb;
                padding-bottom: 20px;
            }
            .header h1 {
                color: #2563eb;
                margin: 0;
                font-size: 28px;
            }
            .header p {
                margin: 5px 0;
                color: #666;
            }
            .summary {
                display: flex;
                justify-content: space-around;
                margin-bottom: 30px;
                background: #f8fafc;
                padding: 20px;
                border-radius: 8px;
            }
            .summary-item {
                text-align: center;
            }
            .summary-item h3 {
                margin: 0;
                color: #2563eb;
                font-size: 24px;
            }
            .summary-item p {
                margin: 5px 0 0 0;
                color: #666;
                font-size: 14px;
            }
            .filters {
                margin-bottom: 20px;
                background: #f1f5f9;
                padding: 15px;
                border-radius: 6px;
            }
            .filters h3 {
                margin: 0 0 10px 0;
                color: #334155;
                font-size: 16px;
            }
            .filters p {
                margin: 2px 0;
                font-size: 14px;
                color: #64748b;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 20px;
                font-size: 12px;
            }
            th, td {
                border: 1px solid #e2e8f0;
                padding: 8px;
                text-align: left;
            }
            th {
                background-color: #f8fafc;
                font-weight: bold;
                color: #334155;
            }
            tr:nth-child(even) {
                background-color: #f8fafc;
            }
            .status-active {
                color: #059669;
                font-weight: bold;
            }
            .status-inactive {
                color: #dc2626;
                font-weight: bold;
            }
            .status-featured {
                color: #d97706;
                font-weight: bold;
            }
            .footer {
                margin-top: 30px;
                text-align: center;
                color: #666;
                font-size: 12px;
                border-top: 1px solid #e2e8f0;
                padding-top: 20px;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Products Export Report</h1>
            <p>Generated on: ${currentDate}</p>
            <p>Total Products: ${totalProducts}</p>
        </div>

        <div class="summary">
            <div class="summary-item">
                <h3>${totalProducts}</h3>
                <p>Total Products</p>
            </div>
            <div class="summary-item">
                <h3>${activeProducts}</h3>
                <p>Active Products</p>
            </div>
            <div class="summary-item">
                <h3>${featuredProducts}</h3>
                <p>Featured Products</p>
            </div>
            <div class="summary-item">
                <h3>₹${totalValue.toLocaleString()}</h3>
                <p>Total Inventory Value</p>
            </div>
            <div class="summary-item">
                <h3>₹${totalRevenue.toLocaleString()}</h3>
                <p>Total Revenue</p>
            </div>
        </div>

        <div class="filters">
            <h3>Applied Filters:</h3>
            ${filters.search ? `<p><strong>Search:</strong> ${filters.search}</p>` : ''}
            ${filters.category ? `<p><strong>Category:</strong> ${filters.category}</p>` : ''}
            ${filters.status ? `<p><strong>Status:</strong> ${filters.status}</p>` : ''}
            ${filters.seller ? `<p><strong>Seller:</strong> ${filters.seller}</p>` : ''}
            ${filters.minPrice || filters.maxPrice ? `<p><strong>Price Range:</strong> ₹${filters.minPrice || 0} - ₹${filters.maxPrice || '∞'}</p>` : ''}
            <p><strong>Sort By:</strong> ${filters.sortBy} (${filters.sortOrder})</p>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Product Name</th>
                    <th>SKU</th>
                    <th>Category</th>
                    <th>Brand</th>
                    <th>Price</th>
                    <th>Quantity</th>
                    <th>Seller</th>
                    <th>Status</th>
                    <th>Views</th>
                    <th>Sales</th>
                </tr>
            </thead>
            <tbody>
                ${products.map(product => `
                    <tr>
                        <td>${product.name || 'N/A'}</td>
                        <td>${product.sku || 'N/A'}</td>
                        <td>${product.category?.name || 'N/A'}</td>
                        <td>${product.brand || 'N/A'}</td>
                        <td>₹${(product.price || 0).toLocaleString()}</td>
                        <td>${product.quantity || 0}</td>
                        <td>${product.sellerId?.additionalInfo?.name || 'Unknown'}</td>
                        <td>
                            ${!product.isActive ? '<span class="status-inactive">Inactive</span>' : 
                              product.isFeatured ? '<span class="status-featured">Featured</span>' : 
                              '<span class="status-active">Active</span>'}
                        </td>
                        <td>${product.viewCount || 0}</td>
                        <td>${product.saleCount || 0}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <div class="footer">
            <p>This report was generated automatically by the Fitness App Admin Panel</p>
            <p>For any queries, please contact the system administrator</p>
        </div>
    </body>
    </html>
    `;
}
