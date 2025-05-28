const Joi = require('joi');

exports.createAdminValidation = (data) => {
  const schema = Joi.object({
    name: Joi.string()
      .min(3)
      .max(50)
      .required()
      .messages({
        'string.empty': 'Name is required',
        'string.min': 'Name must be at least 3 characters',
        'string.max': 'Name must be at most 50 characters',
      }),
    phone: Joi.string()
      .pattern(/^\d{10,15}$/)
      .required()
      .messages({
        'string.empty': 'Phone number is required',
        'string.pattern.base': 'Phone number must be 10 to 15 digits',
      }),
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.empty': 'Email is required',
        'string.email': 'Email must be a valid email address',
      }),
    password: Joi.string()
      .min(6)
      .required()
      .messages({
        'string.empty': 'Password is required',
        'string.min': 'Password must be at least 6 characters long',
      }),
  });

  return schema.validate(data, { abortEarly: false });
};