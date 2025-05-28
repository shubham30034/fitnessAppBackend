const Joi = require('joi');

exports.aiWorkoutPlannerValidation = ({goal, fitness_level, total_weeks}) => {
  const schema = Joi.object({
    goal: Joi.string().trim().min(5).max(200).required().messages({
      'string.base': 'Goal must be a string',
      'string.empty': 'Goal is required',
      'string.min': 'Goal must be at least 5 characters',
      'string.max': 'Goal must be at most 200 characters',
      'any.required': 'Goal is required',
    }),
    fitness_level: Joi.string()
      .valid('beginner', 'intermediate', 'advanced')
      .required()
      .messages({
        'any.only': 'Fitness level must be one of beginner, intermediate, or advanced',
        'any.required': 'Fitness level is required',
        'string.empty': 'Fitness level cannot be empty',
      }),
    total_weeks: Joi.number().integer().min(1).max(52).required().messages({
      'number.base': 'Total weeks must be a number',
      'number.integer': 'Total weeks must be an integer',
      'number.min': 'Total weeks must be at least 1',
      'number.max': 'Total weeks cannot exceed 52',
      'any.required': 'Total weeks is required',
    }),
  });

  return schema.validate({goal, fitness_level, total_weeks}, { abortEarly: false });
};




exports.paginationValidation = ({ page = 1, limit = 10 }) => {
  const schema = Joi.object({
    page: Joi.number().integer().min(1).messages({
      "number.base": `"page" must be a number`,
      "number.min": `"page" must be at least 1`,
    }),
    limit: Joi.number().integer().min(1).max(100).messages({
      "number.base": `"limit" must be a number`,
      "number.min": `"limit" must be at least 1`,
      "number.max": `"limit" cannot exceed 100`,
    }),
  });

  return schema.validate({ page, limit }, { abortEarly: false });
};




exports.exerciseFilterValidation = ({ muscle, level }) => {
  const schema = Joi.object({
    muscle: Joi.string().trim().required().messages({
      "any.required": `"muscle" is required`,
      "string.base": `"muscle" must be a string`,
      "string.empty": `"muscle" cannot be empty`,
    }),
    level: Joi.string().valid("beginner", "intermediate", "advanced").required().messages({
      "any.required": `"level" is required`,
      "any.only": `"level" must be one of [beginner, intermediate, advanced]`,
      "string.empty": `"level" cannot be empty`,
    }),
  });

  return schema.validate({ muscle, level }, { abortEarly: false });
};





