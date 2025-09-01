const Joi = require('joi');

// Validation for creating a coach
exports.createCoachValidation = (data) => {
  const schema = Joi.object({
    name: Joi.string()
      .min(2)
      .max(50)
      .required()
      .messages({
        'string.empty': 'Name is required',
        'string.min': 'Name must be at least 2 characters long',
        'string.max': 'Name cannot exceed 50 characters',
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
        'string.email': 'Please provide a valid email address',
      }),
    password: Joi.string()
      .min(6)
      .required()
      .messages({
        'string.empty': 'Password is required',
        'string.min': 'Password must be at least 6 characters long',
      }),
    experience: Joi.string()
      .max(500)
      .allow('', null)
      .messages({
        'string.max': 'Experience cannot exceed 500 characters',
      }),
    bio: Joi.string()
      .max(1000)
      .allow('', null)
      .messages({
        'string.max': 'Bio cannot exceed 1000 characters',
      }),
  });

  return schema.validate(data, { abortEarly: false });
};

// Validation for updating a coach
exports.updateCoachValidation = (data) => {
  const schema = Joi.object({
    name: Joi.string()
      .min(2)
      .max(50)
      .messages({
        'string.min': 'Name must be at least 2 characters long',
        'string.max': 'Name cannot exceed 50 characters',
      }),
    email: Joi.string()
      .email()
      .messages({
        'string.email': 'Please provide a valid email address',
      }),
    experience: Joi.string()
      .max(500)
      .allow('', null)
      .messages({
        'string.max': 'Experience cannot exceed 500 characters',
      }),
    bio: Joi.string()
      .max(1000)
      .allow('', null)
      .messages({
        'string.max': 'Bio cannot exceed 1000 characters',
      }),
  });

  return schema.validate(data, { abortEarly: false });
};

// Validation for coach schedule
exports.coachScheduleValidation = (data) => {
  const schema = Joi.object({
    days: Joi.array()
      .items(Joi.string().valid('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'))
      .messages({
        'array.base': 'Days must be an array',
        'any.only': 'Invalid day value. Must be one of: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday',
      }),
    startTime: Joi.string()
      .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .messages({
        'string.pattern.base': 'Start time must be in HH:MM format (24-hour)',
      }),
    endTime: Joi.string()
      .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .messages({
        'string.pattern.base': 'End time must be in HH:MM format (24-hour)',
      }),
  });

  return schema.validate(data, { abortEarly: false });
};

// Validation for coach manager login
exports.coachManagerLoginValidation = (data) => {
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
