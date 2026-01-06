const Joi = require("joi");

/* =====================================================
   COMMON HELPERS
===================================================== */

const stringArray = Joi.array().items(Joi.string().trim()).default([]);

/* =====================================================
   DIET PROFILE VALIDATION
   (Stored in DB)
===================================================== */

exports.dietProfileValidation = (data) => {
  const schema = Joi.object({
    age: Joi.number().integer().min(1).max(120).required().messages({
      "any.required": `"age" is required`,
      "number.base": `"age" must be a number`,
      "number.min": `"age" must be at least 1`,
      "number.max": `"age" must be realistic`,
    }),

    gender: Joi.string()
      .valid("male", "female", "other")
      .required()
      .messages({
        "any.required": `"gender" is required`,
        "any.only": `"gender" must be 'male', 'female', or 'other'`,
      }),

    heightCm: Joi.number().positive().max(300).required().messages({
      "any.required": `"heightCm" is required`,
      "number.base": `"heightCm" must be a number`,
      "number.positive": `"heightCm" must be greater than 0`,
      "number.max": `"heightCm" must be realistic`,
    }),

    weightKg: Joi.number().positive().max(500).required().messages({
      "any.required": `"weightKg" is required`,
      "number.base": `"weightKg" must be a number`,
      "number.positive": `"weightKg" must be greater than 0`,
      "number.max": `"weightKg" must be realistic`,
    }),

    goal: Joi.string().trim().min(3).required().messages({
      "any.required": `"goal" is required`,
      "string.min": `"goal" must be meaningful`,
    }),

    dietaryPreferences: stringArray,
    medicalConditions: stringArray,
  });

  return schema.validate(data, { abortEarly: false });
};

/* =====================================================
   AI DIET GENERATION VALIDATION
   (Cheap, controlled)
===================================================== */

exports.aiDietPlanValidation = (data) => {
  const schema = Joi.object({
    numDays: Joi.number().integer().min(1).max(14).default(7).messages({
      "number.base": `"numDays" must be a number`,
      "number.min": `"numDays" must be at least 1`,
      "number.max": `"numDays" cannot exceed 14`,
    }),
  });

  return schema.validate(data, { abortEarly: false });
};

/* =====================================================
   UPDATE WEEK (AI MODIFICATION)
===================================================== */

exports.updateWeekValidation = (data) => {
  const schema = Joi.object({
    weekNumber: Joi.number().integer().min(1).max(4).required().messages({
      "any.required": `"weekNumber" is required`,
      "number.base": `"weekNumber" must be a number`,
      "number.min": `"weekNumber" must be at least 1`,
      "number.max": `"weekNumber" cannot exceed 4`,
    }),

    userRequest: Joi.string().trim().min(5).required().messages({
      "any.required": `"userRequest" is required`,
      "string.min": `"userRequest" must be descriptive`,
    }),
  });

  return schema.validate(data, { abortEarly: false });
};

/* =====================================================
   UPDATE DAY (AI MODIFICATION)
===================================================== */

exports.updateDayValidation = (data) => {
  const schema = Joi.object({
    weekNumber: Joi.number().integer().min(1).max(4).required().messages({
      "any.required": `"weekNumber" is required`,
      "number.base": `"weekNumber" must be a number`,
      "number.min": `"weekNumber" must be at least 1`,
      "number.max": `"weekNumber" cannot exceed 4`,
    }),

    date: Joi.date().iso().required().messages({
      "any.required": `"date" is required`,
      "date.format": `"date" must be ISO format (YYYY-MM-DD)`,
    }),

    userRequest: Joi.string().trim().min(5).required().messages({
      "any.required": `"userRequest" is required`,
      "string.min": `"userRequest" must be descriptive`,
    }),
  });

  return schema.validate(data, { abortEarly: false });
};
