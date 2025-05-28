const Joi = require('joi');

exports.createProductValidation = ({ name, description, price, category, quantity, sellerId }) => {
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
    description: Joi.string().min(5).max(500).required().messages({
      'string.base': 'Description must be a string',
      'string.empty': 'Description is required',
      'string.min': 'Description must be at least 5 characters',
      'string.max': 'Description must be at most 500 characters',
      'any.required': 'Description is required',
    }),
    price: Joi.number().positive().required().messages({
      'number.base': 'Price must be a number',
      'number.positive': 'Price must be a positive number',
      'any.required': 'Price is required',
    }),
    category: Joi.string().min(2).max(50).required().messages({
      'string.base': 'Category must be a string',
      'string.empty': 'Category is required',
      'string.min': 'Category must be at least 2 characters',
      'string.max': 'Category must be at most 50 characters',
      'any.required': 'Category is required',
    }),
    quantity: Joi.number().integer().min(1).required().messages({
      'number.base': 'Quantity must be a number',
      'number.integer': 'Quantity must be an integer',
      'number.min': 'Quantity must be at least 1',
      'any.required': 'Quantity is required',
    }),
  });

  return schema.validate({ name, description, price, category, quantity, sellerId });
};



exports.updateProductValidation = ({ productId, name, description, price, category, quantity }) => {
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
    name: Joi.string().min(2).max(100).required().messages({
      'string.base': 'Name must be a string',
      'string.empty': 'Name is required',
      'string.min': 'Name must be at least 2 characters',
      'string.max': 'Name must be at most 100 characters',
      'any.required': 'Name is required',
    }),
    description: Joi.string().min(5).max(500).required().messages({
      'string.base': 'Description must be a string',
      'string.empty': 'Description is required',
      'string.min': 'Description must be at least 5 characters',
      'string.max': 'Description must be at most 500 characters',
      'any.required': 'Description is required',
    }),
    price: Joi.number().positive().required().messages({
      'number.base': 'Price must be a number',
      'number.positive': 'Price must be a positive number',
      'any.required': 'Price is required',
    }),
    category: Joi.string().min(2).max(50).required().messages({
      'string.base': 'Category must be a string',
      'string.empty': 'Category is required',
      'string.min': 'Category must be at least 2 characters',
      'string.max': 'Category must be at most 50 characters',
      'any.required': 'Category is required',
    }),
    quantity: Joi.number().integer().min(1).required().messages({
      'number.base': 'Quantity must be a number',
      'number.integer': 'Quantity must be an integer',
      'number.min': 'Quantity must be at least 1',
      'any.required': 'Quantity is required',
    }),
  });

  return schema.validate({ productId, name, description, price, category, quantity });
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
