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
    category: {
        type: String,
        trim: true
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
    // users who interested in this product(buy,like, etc)
    users:[{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    quantity: {
    type: Number,
    default: 1,
    min: 0
},
// checking if the product is in stock
isActive: {
    type: Boolean,
    default: true
},
category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
}
},{ timestamps: true });

module.exports = mongoose.model('Product', productSchema);