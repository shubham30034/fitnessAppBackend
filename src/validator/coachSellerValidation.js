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

exports.signupValidation = (data) => {
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
    role: Joi.string()
      .valid('coach', 'seller', 'coachmanager')
      .required()
      .messages({
        'any.only': 'Role must be coach, seller, or coachmanager',
        'string.empty': 'Role is required',
      }),
    name: Joi.string().allow('', null),
    email: Joi.string().email().allow('', null),
    address: Joi.string().allow('', null),
  });

  return schema.validate(data, { abortEarly: false });
};