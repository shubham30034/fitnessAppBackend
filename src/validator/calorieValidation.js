const Joi = require("joi");

exports.aiDietPlanValidation = (data) => {
  const schema = Joi.object({
    age: Joi.number().integer().min(1).required().messages({
      "any.required": `"age" is required`,
      "number.base": `"age" must be a number`,
      "number.min": `"age" must be at least 1`,
    }),
    gender: Joi.string().valid("male", "female", "other").required().messages({
      "any.required": `"gender" is required`,
      "any.only": `"gender" must be 'male', 'female', or 'other'`,
    }),
    heightCm: Joi.number().positive().required().messages({
      "any.required": `"heightCm" is required`,
      "number.base": `"heightCm" must be a number`,
      "number.positive": `"heightCm" must be greater than 0`,
    }),
    weightKg: Joi.number().positive().required().messages({
      "any.required": `"weightKg" is required`,
      "number.base": `"weightKg" must be a number`,
      "number.positive": `"weightKg" must be greater than 0`,
    }),
    goal: Joi.string().required().messages({
      "any.required": `"goal" is required`,
    }),
    dietaryPreferences: Joi.array().items(Joi.string()).default([]),
    medicalConditions: Joi.array().items(Joi.string()).default([]),
    numWeeks: Joi.number().integer().min(1).max(4).default(1).messages({
      "number.base": `"numWeeks" must be a number`,
      "number.min": `"numWeeks" must be at least 1`,
      "number.max": `"numWeeks" cannot exceed 4`,
    }),
  });

  return schema.validate(data, { abortEarly: false });
};



exports.updateWeekValidation = (data) => {
  const schema = Joi.object({
    weekNumber: Joi.number().integer().min(1).required().messages({
      'any.required': `"weekNumber" is required`,
      'number.base': `"weekNumber" must be a number`,
      'number.min': `"weekNumber" must be at least 1`
    }),
    userRequest: Joi.string().required().messages({
      'any.required': `"userRequest" is required`,
      'string.base': `"userRequest" must be a string`
    }),
  });

  return schema.validate(data, { abortEarly: false });
};



exports.updateDayValidation = (data) => {
  const schema = Joi.object({
    weekNumber: Joi.number().integer().min(1).required().messages({
      'any.required': `"weekNumber" is required`,
      'number.base': `"weekNumber" must be a number`,
      'number.min': `"weekNumber" must be at least 1`
    }),
    date: Joi.date().required().messages({
      'any.required': `"date" is required`,
      'date.base': `"date" must be a valid date`
    }),
    userRequest: Joi.string().required().messages({
      'any.required': `"userRequest" is required`,
      'string.base': `"userRequest" must be a string`
    }),
  });

  return schema.validate(data, { abortEarly: false });
};

