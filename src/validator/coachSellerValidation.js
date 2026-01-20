const Joi = require("joi");

// Accept: 10-digit, 91 + 10-digit, +91 + 10-digit
const phoneSchema = Joi.string()
  .trim()
  .pattern(/^(\d{10}|91\d{10}|\+91\d{10})$/)
  .required()
  .messages({
    "string.empty": "Phone number is required",
    "string.pattern.base":
      "Phone must be 10 digits or 91xxxxxxxxxx or +91xxxxxxxxxx",
  });

const passwordSchema = Joi.string()
  .min(6)
  .required()
  .messages({
    "string.empty": "Password is required",
    "string.min": "Password must be at least 6 characters long",
  });

exports.loginValidation = (data) => {
  const schema = Joi.object({
    phone: phoneSchema,
    password: passwordSchema,
  });

  return schema.validate(data, { abortEarly: false });
};

exports.signupValidation = (data) => {
  const schema = Joi.object({
    phone: phoneSchema,
    password: passwordSchema,
    role: Joi.string()
      .valid("coach", "seller", "coachmanager")
      .required()
      .messages({
        "any.only": "Role must be coach, seller, or coachmanager",
        "string.empty": "Role is required",
      }),
    name: Joi.string().allow("", null),
    email: Joi.string().email().allow("", null),
    address: Joi.string().allow("", null),
  });

  return schema.validate(data, { abortEarly: false });
};
