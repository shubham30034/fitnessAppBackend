const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    sellerId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    productImages: [{
        type: String,
        required: true
    }],
    users:[{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    quantity: {
        type: Number,
        default: 1,
        min: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    }
}, { 
    timestamps: true
});

// Add a validator on productImages array length
productSchema.path('productImages').validate(function(images) {
    return images.length <= 3;
}, 'Maximum 3 images are allowed per product.');

module.exports = mongoose.model('Product', productSchema);
