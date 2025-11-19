const Joi = require('joi');
const mongoose = require('mongoose');

exports.createProductValidation = ({ name, description, price, category, quantity, sellerId, brand, subcategory, originalPrice, discountPercentage, lowStockThreshold, weight, dimensions, metaTitle, metaDescription, keywords, isActive, isFeatured }) => {
  const schema = Joi.object({
    sellerId: Joi.string().required().messages({
      'any.required': 'Seller ID is required',
      'string.empty': 'Seller ID cannot be empty',
    }),
    name: Joi.string().min(2).max(100).required().messages({
      'string.base': 'Name must be a string',
      'string.empty': 'Name is required',
      'string.min': 'Name must be at least 2 characters',
      'string.max': 'Name must be at most 100 characters',
      'any.required': 'Name is required',
    }),
    description: Joi.string().min(5).max(1000).required().messages({
      'string.base': 'Description must be a string',
      'string.empty': 'Description is required',
      'string.min': 'Description must be at least 5 characters',
      'string.max': 'Description must be at most 1000 characters',
      'any.required': 'Description is required',
    }),
    price: Joi.number().positive().required().messages({
      'number.base': 'Price must be a number',
      'number.positive': 'Price must be a positive number',
      'any.required': 'Price is required',
    }),
    originalPrice: Joi.number().positive().optional().messages({
      'number.base': 'Original price must be a number',
      'number.positive': 'Original price must be a positive number',
    }),
    discountPercentage: Joi.number().min(0).max(100).optional().messages({
      'number.base': 'Discount percentage must be a number',
      'number.min': 'Discount percentage must be at least 0',
      'number.max': 'Discount percentage must be at most 100',
    }),
    category: Joi.string().min(2).max(50).required().messages({
      'string.base': 'Category must be a string',
      'string.empty': 'Category is required',
      'string.min': 'Category must be at least 2 characters',
      'string.max': 'Category must be at most 50 characters',
      'any.required': 'Category is required',
    }),
    subcategory: Joi.string().custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    }, 'ObjectId validation').optional().allow('').messages({
      'any.invalid': 'Subcategory ID must be a valid MongoDB ObjectId',
    }),
    quantity: Joi.number().integer().min(0).required().messages({
      'number.base': 'Quantity must be a number',
      'number.integer': 'Quantity must be an integer',
      'number.min': 'Quantity must be at least 0',
      'any.required': 'Quantity is required',
    }),
    brand: Joi.string().max(50).optional().allow('').messages({
      'string.base': 'Brand must be a string',
      'string.max': 'Brand must be at most 50 characters',
    }),
    lowStockThreshold: Joi.number().integer().min(0).optional().messages({
      'number.base': 'Low stock threshold must be a number',
      'number.integer': 'Low stock threshold must be an integer',
      'number.min': 'Low stock threshold must be at least 0',
    }),
    weight: Joi.number().positive().optional().messages({
      'number.base': 'Weight must be a number',
      'number.positive': 'Weight must be a positive number',
    }),
    dimensions: Joi.object({
      length: Joi.number().positive().optional(),
      width: Joi.number().positive().optional(),
      height: Joi.number().positive().optional()
    }).optional().messages({
      'object.base': 'Dimensions must be an object',
    }),
    metaTitle: Joi.string().max(60).optional().allow('').messages({
      'string.base': 'Meta title must be a string',
      'string.max': 'Meta title must be at most 60 characters',
    }),
    metaDescription: Joi.string().max(160).optional().allow('').messages({
      'string.base': 'Meta description must be a string',
      'string.max': 'Meta description must be at most 160 characters',
    }),
    keywords: Joi.array().items(Joi.string()).optional().messages({
      'array.base': 'Keywords must be an array',
    }),
    isActive: Joi.boolean().optional().messages({
      'boolean.base': 'Active status must be a boolean',
    }),
    isFeatured: Joi.boolean().optional().messages({
      'boolean.base': 'Featured status must be a boolean',
    }),
  });

  return schema.validate({ name, description, price, category, quantity, sellerId, brand, subcategory, originalPrice, discountPercentage, lowStockThreshold, weight, dimensions, metaTitle, metaDescription, keywords, isActive, isFeatured });
};

exports.updateProductValidation = ({ productId, name, description, price, category, quantity, brand, subcategory, originalPrice, discountPercentage, lowStockThreshold, weight, dimensions, metaTitle, metaDescription, keywords, isActive, isFeatured }) => {
  // Custom Joi validator for ObjectId
  const objectIdValidator = (value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      return helpers.error('any.invalid');
    }
    return value;
  };

  const schema = Joi.object({
    productId: Joi.string().custom(objectIdValidator, 'ObjectId validation').required().messages({
      'any.invalid': 'Invalid product ID',
      'any.required': 'Product ID is required',
      'string.empty': 'Product ID cannot be empty',
    }),
    name: Joi.string().min(2).max(100).optional().messages({
      'string.base': 'Name must be a string',
      'string.min': 'Name must be at least 2 characters',
      'string.max': 'Name must be at most 100 characters',
    }),
    description: Joi.string().min(5).max(1000).optional().messages({
      'string.base': 'Description must be a string',
      'string.min': 'Description must be at least 5 characters',
      'string.max': 'Description must be at most 1000 characters',
    }),
    price: Joi.number().positive().optional().messages({
      'number.base': 'Price must be a number',
      'number.positive': 'Price must be a positive number',
    }),
    originalPrice: Joi.number().positive().optional().messages({
      'number.base': 'Original price must be a number',
      'number.positive': 'Original price must be a positive number',
    }),
    discountPercentage: Joi.number().min(0).max(100).optional().messages({
      'number.base': 'Discount percentage must be a number',
      'number.min': 'Discount percentage must be at least 0',
      'number.max': 'Discount percentage must be at most 100',
    }),
    category: Joi.string().min(2).max(50).optional().messages({
      'string.base': 'Category must be a string',
      'string.min': 'Category must be at least 2 characters',
      'string.max': 'Category must be at most 50 characters',
    }),
    subcategory: Joi.string().custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    }, 'ObjectId validation').optional().allow('').messages({
      'any.invalid': 'Subcategory ID must be a valid MongoDB ObjectId',
    }),
    quantity: Joi.number().integer().min(0).optional().messages({
      'number.base': 'Quantity must be a number',
      'number.integer': 'Quantity must be an integer',
      'number.min': 'Quantity must be at least 0',
    }),
    brand: Joi.string().max(50).optional().allow('').messages({
      'string.base': 'Brand must be a string',
      'string.max': 'Brand must be at most 50 characters',
    }),
    lowStockThreshold: Joi.number().integer().min(0).optional().messages({
      'number.base': 'Low stock threshold must be a number',
      'number.integer': 'Low stock threshold must be an integer',
      'number.min': 'Low stock threshold must be at least 0',
    }),
    weight: Joi.number().positive().optional().messages({
      'number.base': 'Weight must be a number',
      'number.positive': 'Weight must be a positive number',
    }),
    dimensions: Joi.object({
      length: Joi.number().positive().optional(),
      width: Joi.number().positive().optional(),
      height: Joi.number().positive().optional()
    }).optional().messages({
      'object.base': 'Dimensions must be a valid object',
    }),
    metaTitle: Joi.string().max(60).optional().allow('').messages({
      'string.base': 'Meta title must be a string',
      'string.max': 'Meta title must be at most 60 characters',
    }),
    metaDescription: Joi.string().max(160).optional().allow('').messages({
      'string.base': 'Meta description must be a string',
      'string.max': 'Meta description must be at most 160 characters',
    }),
    keywords: Joi.array().items(Joi.string()).optional().messages({
      'array.base': 'Keywords must be an array',
    }),
    isActive: Joi.boolean().optional().messages({
      'boolean.base': 'Active status must be a boolean',
    }),
    isFeatured: Joi.boolean().optional().messages({
      'boolean.base': 'Featured status must be a boolean',
    }),
  });

  return schema.validate({ productId, name, description, price, category, quantity, brand, subcategory, originalPrice, discountPercentage, lowStockThreshold, weight, dimensions, metaTitle, metaDescription, keywords, isActive, isFeatured });
};

exports.buyProductValidation = ({ productId, quantity, address }) => {
  const schema = Joi.object({
    productId: Joi.string()
      .required()
      .messages({ "any.required": "Product ID is required" }),
    quantity: Joi.number()
      .integer()
      .min(1)
      .required()
      .messages({
        "number.base": "Quantity must be a number",
        "number.min": "Quantity must be at least 1",
        "any.required": "Quantity is required",
      }),
    address: Joi.string()
      .trim()
      .min(5)
      .required()
      .messages({
        "string.base": "Address must be a string",
        "string.min": "Address is too short",
        "any.required": "Address is required",
      }),
  });

  return schema.validate({ productId, quantity, address });
};

exports.createSubCategoryValidation = (data) => {
  const schema = Joi.object({
    name: Joi.string().trim().min(1).required().messages({
      'string.empty': 'Subcategory name is required',
      'any.required': 'Subcategory name is required',
    }),
    categoryId: Joi.string()
      .required()
      .custom((value, helpers) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          return helpers.error('any.invalid');
        }
        return value;
      }, 'ObjectId validation')
      .messages({
        'any.invalid': 'Category ID must be a valid MongoDB ObjectId',
        'any.required': 'Category ID is required',
      }),
  });

  return schema.validate(data);
};

// Review validation
exports.createReviewValidation = ({ productId, rating, title, comment }) => {
  const schema = Joi.object({
    productId: Joi.string()
      .required()
      .custom((value, helpers) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          return helpers.error('any.invalid');
        }
        return value;
      }, 'ObjectId validation')
      .messages({
        'any.invalid': 'Product ID must be a valid MongoDB ObjectId',
        'any.required': 'Product ID is required',
      }),
    rating: Joi.number()
      .integer()
      .min(1)
      .max(5)
      .required()
      .messages({
        'number.base': 'Rating must be a number',
        'number.integer': 'Rating must be an integer',
        'number.min': 'Rating must be at least 1',
        'number.max': 'Rating must be at most 5',
        'any.required': 'Rating is required',
      }),
    title: Joi.string()
      .max(100)
      .optional()
      .messages({
        'string.base': 'Title must be a string',
        'string.max': 'Title must be at most 100 characters',
      }),
    comment: Joi.string()
      .max(1000)
      .optional()
      .messages({
        'string.base': 'Comment must be a string',
        'string.max': 'Comment must be at most 1000 characters',
      }),
  });

  return schema.validate({ productId, rating, title, comment });
};

// Wishlist validation
exports.wishlistValidation = ({ productId, notes }) => {
  const schema = Joi.object({
    productId: Joi.string()
      .required()
      .custom((value, helpers) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          return helpers.error('any.invalid');
        }
        return value;
      }, 'ObjectId validation')
      .messages({
        'any.invalid': 'Product ID must be a valid MongoDB ObjectId',
        'any.required': 'Product ID is required',
      }),
    notes: Joi.string()
      .max(200)
      .optional()
      .messages({
        'string.base': 'Notes must be a string',
        'string.max': 'Notes must be at most 200 characters',
      }),
  });

  return schema.validate({ productId, notes });
};
