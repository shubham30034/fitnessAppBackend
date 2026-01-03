// models/Category.js
const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
{
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        enum: [
            'supplement',
            'clothes', 
            'accessories',
            'equipment',
            'nutrition',
            'wellness',
            'technology',
            'books',
            'apparel',
            'footwear'
        ]
    },

    description: {
        type: String,
        maxlength: 500
    },

    image: {
        type: String
    },

    isActive: {
        type: Boolean,
        default: true
    },

    sortOrder: {
        type: Number,
        default: 0
    },

    subcategories: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubCategory'
    }],

    products: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    }]
},
{ timestamps: true }
);

// ✅ ONLY non-duplicate indexes
categorySchema.index({ isActive: 1 });
categorySchema.index({ sortOrder: 1 });

// Virtual for product count
categorySchema.virtual('productCount').get(function () {
    return this.products ? this.products.length : 0;
});

categorySchema.set('toJSON', { virtuals: true });
categorySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Category', categorySchema);
