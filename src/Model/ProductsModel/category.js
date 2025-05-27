// models/Category.js
const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        enum:['suppliment','clothes','accessories']
    },
    subcategories: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubCategory'
    }],
    products: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    }],
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);


