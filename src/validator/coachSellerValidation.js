const Joi = require('joi');

exports.loginValidation = (data) => {
  const schema = Joi.object({
    phone: Joi.string()
      .pattern(/^\d{10,15}$/)
      .required()
      .messages({
        'string.empty': 'Phone number is required',
        'string.pattern.base': 'Phone number must be 10 to 15 digits',
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