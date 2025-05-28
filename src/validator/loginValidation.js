const Joi = require("joi");

// Validate send OTP data
exports.sendOtpValidation = ({phone}) => {



  const schema = Joi.object({
    phone: Joi.string()
      .pattern(/^[0-9]{10}$/)
      .required()
      .messages({
        "string.pattern.base": "Phone number must be exactly 10 digits",
        "any.required": "Phone number is required",
      }),
  });

 return schema.validate({phone})
};

// Validate verify OTP data
exports.verifyOtpValidation = ({phone,otp }) => {
  const schema = Joi.object({
    phone: Joi.string()
      .pattern(/^[0-9]{10}$/)
      .required()
      .messages({
        "string.pattern.base": "Phone number must be exactly 10 digits",
        "any.required": "Phone number is required",
      }),
    otp: Joi.string()
      .length(4)
      .pattern(/^[0-9]{4}$/)
      .required()
      .messages({
        "string.length": "OTP must be exactly 4 digits",
        "string.pattern.base": "OTP must be numeric",
        "any.required": "OTP is required",
      }),
  });
 
 return schema.validate({phone,otp})
};



exports.additionalInfoValidate = ({ name, email, address }) => {
  const schema = Joi.object({
    name: Joi.string()
      .min(2)
      .max(50)
      .required()
      .messages({
        'string.base': 'Name must be a string',
        'string.empty': 'Name is required',
        'string.min': 'Name must be at least 2 characters',
        'string.max': 'Name must be at most 50 characters',
        'any.required': 'Name is required',
      }),
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Invalid email format',
        'string.empty': 'Email is required',
        'any.required': 'Email is required',
      }),
    address: Joi.string()
      .min(5)
      .max(100)
      .optional()
      .allow('')
      .messages({
        'string.base': 'Address must be a string',
        'string.min': 'Address must be at least 5 characters',
        'string.max': 'Address must be at most 100 characters',
      }),
  });

  return schema.validate({ name, email, address });
};



