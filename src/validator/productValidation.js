const Joi = require("joi");
const mongoose = require("mongoose");

/* =========================
   Helpers
========================= */
const objectId = (value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return helpers.error("any.invalid");
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

    price: Joi.number().positive().required().messages({
      "number.base": "price must be a number",
      "number.positive": "price must be greater than 0",
      "any.required": "price is required",
    }),

    originalPrice: Joi.number().positive().optional().messages({
      "number.base": "originalPrice must be a number",
      "number.positive": "originalPrice must be greater than 0",
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

    category: Joi.string()
      .required()
      .custom(objectId, "ObjectId validation")
      .messages({
        "any.required": "category is required",
        "any.invalid": "Invalid category",
      }),

    subcategory: Joi.string()
      .optional()
      .allow(null, "")
      .custom((value, helpers) => {
        if (value === null || value === "") return value;
        return objectId(value, helpers);
      }, "ObjectId validation")
      .messages({
        "any.invalid": "Invalid subcategory",
      }),

    metaTitle: Joi.string().trim().max(70).optional().allow("").messages({
      "string.base": "metaTitle must be a string",
      "string.max": "metaTitle must be at most 70 characters",
    }),

    metaDescription: Joi.string().trim().max(200).optional().allow("").messages({
      "string.base": "metaDescription must be a string",
      "string.max": "metaDescription must be at most 200 characters",
    }),

    keywords: keywordsSchema.optional(),

    isActive: Joi.boolean().optional().messages({
      "boolean.base": "isActive must be a boolean",
    }),

    isFeatured: Joi.boolean().optional().messages({
      "boolean.base": "isFeatured must be a boolean",
    }),

    variants: Joi.array().optional().messages({
      "array.base": "variants must be an array",
    }),
  })
    // ✅ Rule: originalPrice must be >= price (if provided)
    .custom((obj, helpers) => {
      if (obj.originalPrice !== undefined && obj.price !== undefined) {
        if (Number(obj.originalPrice) < Number(obj.price)) {
          return helpers.error("any.invalid", {
            message: "originalPrice must be greater than or equal to price",
          });
        }
      }
      return obj;
    })
    // ✅ unknown fields allowed (so controller doesn't break)
    .unknown(true);

  return schema.validate(data, { abortEarly: true });
};

/* =========================
   Update Product Validation
   (all optional fields)
========================= */
exports.validateUpdateProduct = (data) => {
  const schema = Joi.object({
    // ✅ now meaningful if you pass { productId }
    productId: Joi.string()
      .optional()
      .custom(objectId, "ObjectId validation")
      .messages({
        "any.invalid": "Invalid productId",
      }),

    name: Joi.string().trim().min(2).max(120).optional(),
    description: Joi.string().trim().min(5).max(5000).optional(),
    brand: Joi.string().trim().max(80).optional().allow(""),

    price: Joi.number().positive().optional(),
    originalPrice: Joi.number().positive().optional(),

    quantity: Joi.number().integer().min(0).optional(),
    lowStockThreshold: Joi.number().integer().min(0).optional(),

    category: Joi.string()
      .optional()
      .custom(objectId, "ObjectId validation")
      .messages({
        "any.invalid": "Invalid category",
      }),

    subcategory: Joi.string()
      .optional()
      .allow(null, "")
      .custom((value, helpers) => {
        if (value === null || value === "") return value;
        return objectId(value, helpers);
      }, "ObjectId validation")
      .messages({
        "any.invalid": "Invalid subcategory",
      }),

    metaTitle: Joi.string().trim().max(70).optional().allow(""),
    metaDescription: Joi.string().trim().max(200).optional().allow(""),

    keywords: keywordsSchema.optional(),

    isActive: Joi.boolean().optional(),
    isFeatured: Joi.boolean().optional(),

    variants: Joi.array().optional(),
  })
    // ✅ update rule too: originalPrice >= price (if both exist)
    .custom((obj, helpers) => {
      if (obj.originalPrice !== undefined && obj.price !== undefined) {
        if (Number(obj.originalPrice) < Number(obj.price)) {
          return helpers.error("any.invalid", {
            message: "originalPrice must be greater than or equal to price",
          });
        }
      }
      return obj;
    })
    .unknown(true);

  return schema.validate(data, { abortEarly: true });
};
