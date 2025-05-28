const Joi = require('joi');

exports.calculateBMIValidation = (data) => {
  const schema = Joi.object({
    weight: Joi.number()
      .positive()
      .max(500)
      .required()
      .messages({
        'any.required': `"weight" is required`,
        'number.base': `"weight" must be a number`,
        'number.positive': `"weight" must be a positive number`,
        'number.max': `"weight" cannot exceed 500`,
      }),
    height: Joi.number()
      .positive()
      .max(300)
      .required()
      .messages({
        'any.required': `"height" is required`,
        'number.base': `"height" must be a number`,
        'number.positive': `"height" must be a positive number`,
        'number.max': `"height" cannot exceed 300`,
      }),
  });

  return schema.validate(data, { abortEarly: false });
};


