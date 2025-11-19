const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    // Basic Information
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
    
    // Pricing
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
    
    // Inventory
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
    
    // Physical Properties
    weight: {
        type: Number,
        min: 0
    },
    dimensions: {
        length: { type: Number, min: 0 },
        width: { type: Number, min: 0 },
        height: { type: Number, min: 0 }
    },
    
    // Seller Information
    sellerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // Categories
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    subcategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubCategory'
    },
    
    // Images
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
    
    // Variants
    variants: [{
        name: String, // e.g., "Size", "Color"
        options: [{
            value: String, // e.g., "Large", "Red"
            price: Number,
            quantity: Number,
            sku: String
        }]
    }],
    
    // SEO
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
    
    // Analytics
    viewCount: {
        type: Number,
        default: 0
    },
    saleCount: {
        type: Number,
        default: 0
    },
    
    // Reviews
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
    
    // Status
    isActive: {
        type: Boolean,
        default: true
    },
    isFeatured: {
        type: Boolean,
        default: false
    },
    
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { 
    timestamps: true 
});

// Indexes for better performance
productSchema.index({ sellerId: 1, isActive: 1 });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ subcategory: 1, isActive: 1 });
productSchema.index({ name: 'text', description: 'text', brand: 'text' });
productSchema.index({ price: 1 });
productSchema.index({ averageRating: -1 });
productSchema.index({ viewCount: -1 });
productSchema.index({ saleCount: -1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ slug: 1 });

// Validators
productSchema.path('productImages').validate(function(images) {
    return images.length <= 5; // Increased from 3 to 5
}, 'Maximum 5 images are allowed per product.');

// Pre-save middleware to generate SKU and slug if not provided
productSchema.pre('save', function(next) {
    if (!this.sku) {
        this.sku = `SKU-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Only generate slug if it's not already set AND this is a new document
    // This prevents overriding manually generated unique slugs during updates
    if (!this.slug && this.isNew) {
        this.slug = this.name.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
    }
    
    // Calculate discount percentage
    if (this.originalPrice && this.price < this.originalPrice) {
        this.discountPercentage = Math.round(((this.originalPrice - this.price) / this.originalPrice) * 100);
    }
    
    this.updatedAt = new Date();
    next();
});

// Virtual for discounted price
productSchema.virtual('discountedPrice').get(function() {
    if (this.originalPrice && this.price < this.originalPrice) {
        return this.price;
    }
    return this.price;
});

// Static method to generate unique slug
productSchema.statics.generateUniqueSlug = async function(name, excludeId = null) {
    console.log('🔍 generateUniqueSlug called with:', { name, excludeId });
    
    let baseSlug = name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    
    console.log('🔍 Base slug:', baseSlug);
    
    let slug = baseSlug;
    let counter = 1;
    
    while (true) {
        const query = { slug: slug };
        if (excludeId) {
            query._id = { $ne: excludeId };
        }
        
        console.log('🔍 Checking slug uniqueness:', slug, 'with query:', query);
        
        const existingProduct = await this.findOne(query);
        
        if (!existingProduct) {
            console.log('🔍 Slug is unique:', slug);
            break; // Slug is unique
        }
        
        console.log('🔍 Slug exists, incrementing counter');
        slug = `${baseSlug}-${counter}`;
        counter++;
    }
    
    console.log('🔍 Final unique slug:', slug);
    return slug;
};

// Instance method to check if product is in stock
productSchema.methods.isInStock = function() {
    return this.quantity > 0;
};

// Instance method to check if product is low in stock
productSchema.methods.isLowStock = function() {
    return this.quantity <= this.lowStockThreshold;
};

// Static method to find products by category with pagination
productSchema.statics.findByCategory = function(categoryId, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    return this.find({ category: categoryId, isActive: true })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });
};

module.exports = mongoose.model('Product', productSchema);
