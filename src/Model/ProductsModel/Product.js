const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
{
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },

    description: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000
    },

    sku: {
        type: String,
        unique: true,
        sparse: true,
        trim: true
    },

    brand: {
        type: String,
        trim: true,
        maxlength: 50
    },

    price: {
        type: Number,
        required: true,
        min: 0
    },

    originalPrice: {
        type: Number,
        min: 0
    },

    discountPercentage: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },

    quantity: {
        type: Number,
        default: 0,
        min: 0
    },

    lowStockThreshold: {
        type: Number,
        default: 5,
        min: 0
    },

    weight: {
        type: Number,
        min: 0
    },

    dimensions: {
        length: { type: Number, min: 0 },
        width: { type: Number, min: 0 },
        height: { type: Number, min: 0 }
    },

    sellerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        required: true
    },

    subcategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SubCategory"
    },

    productImages: [{
        type: String,
        required: true
    }],

    productImagesOptimized: [{
        original: String,
        optimized: {
            thumbnail: String,
            small: String,
            medium: String,
            large: String,
            original: String
        }
    }],

    variants: [{
        name: String,
        options: [{
            value: String,
            price: Number,
            quantity: Number,
            sku: String
        }]
    }],

    metaTitle: {
        type: String,
        maxlength: 60
    },

    metaDescription: {
        type: String,
        maxlength: 160
    },

    keywords: [String],

    slug: {
        type: String,
        unique: true,
        sparse: true
    },

    viewCount: {
        type: Number,
        default: 0
    },

    saleCount: {
        type: Number,
        default: 0
    },

    averageRating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },

    reviewCount: {
        type: Number,
        default: 0
    },

    isActive: {
        type: Boolean,
        default: true
    },

    isFeatured: {
        type: Boolean,
        default: false
    }
},
{ timestamps: true }
);

/* =======================
   INDEXES (ONLY HERE)
======================= */

// Filters
productSchema.index({ sellerId: 1, isActive: 1 });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ subcategory: 1, isActive: 1 });
productSchema.index({ price: 1 });
productSchema.index({ averageRating: -1 });
productSchema.index({ viewCount: -1 });
productSchema.index({ saleCount: -1 });
productSchema.index({ createdAt: -1 });

// 🔥 TEXT SEARCH (ONLY ONE INDEX ON name)
productSchema.index({
    name: "text",
    description: "text",
    brand: "text"
});

module.exports = mongoose.model("Product", productSchema);
