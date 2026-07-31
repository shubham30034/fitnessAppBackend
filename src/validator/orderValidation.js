const Joi = require("joi");

/* ================= ADDRESS ================= */
const addressSchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).required(),
  phone: Joi.string().pattern(/^[0-9]{10}$/).required(),
  line1: Joi.string().trim().min(5).max(100).required(),
  line2: Joi.string().trim().allow("", null),
  city: Joi.string().trim().min(2).max(50).required(),
  state: Joi.string().trim().min(2).max(50).required(),
  pincode: Joi.string().pattern(/^[0-9]{6}$/).required(),
});

/* ================= BUY NOW ================= */
exports.validateBuyNow = (data) =>
  Joi.object({
    productId: Joi.string().hex().length(24).required(),
    quantity: Joi.number().integer().min(1).default(1),
    address: addressSchema.required(),
  }).validate(data);

/* ================= CART CHECKOUT ================= */
exports.validateCartCheckout = (data) =>
  Joi.object({
    address: addressSchema.required(),
  }).validate(data);
