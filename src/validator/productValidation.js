const Joi = require("joi");
const mongoose = require("mongoose");

/* =========================
   Helpers
========================= */
const objectId = (value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return helpers.message("Invalid ObjectId");
  }
  return value;
};

const keywordsSchema = Joi.array()
  .items(Joi.string().trim().min(1))
  .messages({
    "array.base": "keywords must be an array",
    "string.base": "keyword must be a string",
    "string.empty": "keyword cannot be empty",
    "string.min": "keyword cannot be empty",
  });


/* =========================
   Create Product Validation
========================= */
exports.validateCreateProduct = (data) => {
  const schema = Joi.object({
    name: Joi.string().trim().min(2).max(120).required().messages({
      "string.base": "name must be a string",
      "string.empty": "name is required",
      "string.min": "name must be at least 2 characters",
      "string.max": "name must be at most 120 characters",
      "any.required": "name is required",
    }),

    description: Joi.string().trim().min(5).max(5000).required().messages({
      "string.base": "description must be a string",
      "string.empty": "description is required",
      "string.min": "description must be at least 5 characters",
      "string.max": "description must be at most 5000 characters",
      "any.required": "description is required",
    }),

    brand: Joi.string().trim().max(80).optional().allow("").messages({
      "string.base": "brand must be a string",
      "string.max": "brand must be at most 80 characters",
    }),

    price: Joi.number().min(0).required().messages({
      "number.base": "price must be a number",
      "number.min": "price cannot be negative",
      "any.required": "price is required",
    }),

    originalPrice: Joi.number().min(0).optional().messages({
      "number.base": "originalPrice must be a number",
      "number.min": "originalPrice cannot be negative",
    }),

    quantity: Joi.number().integer().min(0).optional().messages({
      "number.base": "quantity must be a number",
      "number.integer": "quantity must be an integer",
      "number.min": "quantity must be >= 0",
    }),

    lowStockThreshold: Joi.number().integer().min(0).optional().messages({
      "number.base": "lowStockThreshold must be a number",
      "number.integer": "lowStockThreshold must be an integer",
      "number.min": "lowStockThreshold must be >= 0",
    }),

    category: Joi.string().required().custom(objectId).messages({
      "any.required": "category is required",
    }),

    subcategory: Joi.string()
      .optional()
      .allow(null, "")
      .custom((value, helpers) => {
        if (value === null || value === "") return value;
        return objectId(value, helpers);
      }),

    metaTitle: Joi.string().trim().max(70).optional().allow(""),
    metaDescription: Joi.string().trim().max(200).optional().allow(""),

    keywords: keywordsSchema.optional(),

    isActive: Joi.boolean().optional(),
    isFeatured: Joi.boolean().optional(),

    variants: Joi.array().optional(),
  })
    // ✅ Business rule
    .custom((obj, helpers) => {
      if (obj.originalPrice !== undefined && obj.price !== undefined) {
        if (Number(obj.originalPrice) <= Number(obj.price)) {
          return helpers.message("originalPrice must be greater than price");
        }
      }
      return obj;
    })
    .unknown(true);

  return schema.validate(data, { abortEarly: true });
};


/* =========================
   Update Product Validation
========================= */
exports.validateUpdateProduct = (data) => {
  const schema = Joi.object({
    productId: Joi.string().optional().custom(objectId),

    name: Joi.string().trim().min(2).max(120).optional(),
    description: Joi.string().trim().min(5).max(5000).optional(),
    brand: Joi.string().trim().max(80).optional().allow(""),

    price: Joi.number().min(0).optional(),
    originalPrice: Joi.number().min(0).optional(),

    quantity: Joi.number().integer().min(0).optional(),
    lowStockThreshold: Joi.number().integer().min(0).optional(),

    category: Joi.string().optional().custom(objectId),

    subcategory: Joi.string()
      .optional()
      .allow(null, "")
      .custom((value, helpers) => {
        if (value === null || value === "") return value;
        return objectId(value, helpers);
      }),

    metaTitle: Joi.string().trim().max(70).optional().allow(""),
    metaDescription: Joi.string().trim().max(200).optional().allow(""),

    keywords: keywordsSchema.optional(),
    isActive: Joi.boolean().optional(),
    isFeatured: Joi.boolean().optional(),

    variants: Joi.array().optional(),
  })
    .custom((obj, helpers) => {
      if (obj.originalPrice !== undefined && obj.price !== undefined) {
        if (Number(obj.originalPrice) <= Number(obj.price)) {
          return helpers.message("originalPrice must be greater than price");
        }
      }
      return obj;
    })
    .unknown(true);

  return schema.validate(data, { abortEarly: true });
};
