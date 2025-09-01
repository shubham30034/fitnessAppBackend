const Joi = require('joi');

// Validation for updating coach profile
exports.updateCoachProfileValidation = (data) => {
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
    bio: Joi.string()
      .max(1000)
      .allow('', null)
      .messages({
        'string.max': 'Bio cannot exceed 1000 characters',
      }),
    experience: Joi.number()
      .min(0)
      .max(50)
      .messages({
        'number.base': 'Experience must be a number',
        'number.min': 'Experience cannot be negative',
        'number.max': 'Experience cannot exceed 50 years',
      }),
    monthlyFee: Joi.number()
      .min(0)
      .messages({
        'number.base': 'Monthly fee must be a number',
        'number.min': 'Monthly fee cannot be negative',
      }),
    currency: Joi.string()
      .valid('INR', 'USD', 'EUR')
      .messages({
        'any.only': 'Currency must be INR, USD, or EUR',
      }),
    specialization: Joi.array()
      .items(Joi.string().valid('fitness', 'yoga', 'nutrition', 'cardio', 'strength', 'flexibility', 'weight-loss', 'muscle-gain', 'rehabilitation', 'sports-specific'))
      .messages({
        'array.base': 'Specialization must be an array',
        'any.only': 'Invalid specialization value',
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

// Validation for session cancellation
exports.cancelSessionValidation = (data) => {
  const schema = Joi.object({
    reason: Joi.string()
      .max(200)
      .allow('', null)
      .messages({
        'string.max': 'Reason cannot exceed 200 characters',
      }),
  });

  return schema.validate(data, { abortEarly: false });
};

// ===================== IN-APP PURCHASE VALIDATION =====================

// Validation for Apple App Store receipt verification
exports.appleReceiptValidation = (data) => {
  const schema = Joi.object({
    receiptData: Joi.string()
      .required()
      .messages({
        'string.empty': 'Receipt data is required',
        'any.required': 'Receipt data is required'
      }),
    productId: Joi.string()
      .required()
      .messages({
        'string.empty': 'Product ID is required',
        'any.required': 'Product ID is required'
      }),
    transactionId: Joi.string()
      .required()
      .messages({
        'string.empty': 'Transaction ID is required',
        'any.required': 'Transaction ID is required'
      }),
    userId: Joi.string()
      .required()
      .messages({
        'string.empty': 'User ID is required',
        'any.required': 'User ID is required'
      }),
    coachId: Joi.string()
      .required()
      .messages({
        'string.empty': 'Coach ID is required',
        'any.required': 'Coach ID is required'
      }),
    deviceId: Joi.string()
      .optional()
      .messages({
        'string.empty': 'Device ID must not be empty'
      }),
    appVersion: Joi.string()
      .optional()
      .messages({
        'string.empty': 'App version must not be empty'
      }),
    osVersion: Joi.string()
      .optional()
      .messages({
        'string.empty': 'OS version must not be empty'
      })
  });

  return schema.validate(data, { abortEarly: false });
};

// Validation for Google Play purchase verification
exports.googlePurchaseValidation = (data) => {
  const schema = Joi.object({
    purchaseToken: Joi.string()
      .required()
      .messages({
        'string.empty': 'Purchase token is required',
        'any.required': 'Purchase token is required'
      }),
    productId: Joi.string()
      .required()
      .messages({
        'string.empty': 'Product ID is required',
        'any.required': 'Product ID is required'
      }),
    orderId: Joi.string()
      .optional()
      .messages({
        'string.empty': 'Order ID must not be empty'
      }),
    userId: Joi.string()
      .required()
      .messages({
        'string.empty': 'User ID is required',
        'any.required': 'User ID is required'
      }),
    coachId: Joi.string()
      .required()
      .messages({
        'string.empty': 'Coach ID is required',
        'any.required': 'Coach ID is required'
      }),
    packageName: Joi.string()
      .required()
      .messages({
        'string.empty': 'Package name is required',
        'any.required': 'Package name is required'
      }),
    deviceId: Joi.string()
      .optional()
      .messages({
        'string.empty': 'Device ID must not be empty'
      }),
    appVersion: Joi.string()
      .optional()
      .messages({
        'string.empty': 'App version must not be empty'
      }),
    osVersion: Joi.string()
      .optional()
      .messages({
        'string.empty': 'OS version must not be empty'
      })
  });

  return schema.validate(data, { abortEarly: false });
};

// Validation for subscription cancellation
exports.cancelSubscriptionValidation = (data) => {
  const schema = Joi.object({
    reason: Joi.string()
      .max(500)
      .optional()
      .messages({
        'string.max': 'Reason cannot exceed 500 characters'
      })
  });

  return schema.validate(data, { abortEarly: false });
};

// Validation for creating in-app products
exports.createInAppProductValidation = (data) => {
  const schema = Joi.object({
    name: Joi.string()
      .min(2)
      .max(100)
      .required()
      .messages({
        'string.min': 'Name must be at least 2 characters long',
        'string.max': 'Name cannot exceed 100 characters',
        'string.empty': 'Name is required',
        'any.required': 'Name is required'
      }),
    description: Joi.string()
      .min(10)
      .max(1000)
      .required()
      .messages({
        'string.min': 'Description must be at least 10 characters long',
        'string.max': 'Description cannot exceed 1000 characters',
        'string.empty': 'Description is required',
        'any.required': 'Description is required'
      }),
    productType: Joi.string()
      .valid('subscription', 'one_time')
      .required()
      .messages({
        'any.only': 'Product type must be subscription or one_time',
        'any.required': 'Product type is required'
      }),
    subscriptionDetails: Joi.object({
      duration: Joi.number()
        .min(1)
        .when('productType', {
          is: 'subscription',
          then: Joi.required(),
          otherwise: Joi.optional()
        })
        .messages({
          'number.base': 'Duration must be a number',
          'number.min': 'Duration must be at least 1 day',
          'any.required': 'Duration is required for subscription products'
        }),
      sessionsPerMonth: Joi.number()
        .min(1)
        .max(31)
        .when('productType', {
          is: 'subscription',
          then: Joi.required(),
          otherwise: Joi.optional()
        })
        .messages({
          'number.base': 'Sessions per month must be a number',
          'number.min': 'Sessions per month must be at least 1',
          'number.max': 'Sessions per month cannot exceed 31',
          'any.required': 'Sessions per month is required for subscription products'
        }),
      autoRenewable: Joi.boolean()
        .when('productType', {
          is: 'subscription',
          then: Joi.required(),
          otherwise: Joi.optional()
        })
        .messages({
          'boolean.base': 'Auto renewable must be a boolean',
          'any.required': 'Auto renewable is required for subscription products'
        })
    }).when('productType', {
      is: 'subscription',
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    pricing: Joi.object({
      basePrice: Joi.number()
        .min(0)
        .required()
        .messages({
          'number.base': 'Base price must be a number',
          'number.min': 'Base price cannot be negative',
          'any.required': 'Base price is required'
        }),
      currency: Joi.string()
        .valid('INR', 'USD', 'EUR')
        .default('INR')
        .messages({
          'any.only': 'Currency must be INR, USD, or EUR'
        }),
      applePrice: Joi.number()
        .min(0)
        .optional()
        .messages({
          'number.base': 'Apple price must be a number',
          'number.min': 'Apple price cannot be negative'
        }),
      googlePrice: Joi.number()
        .min(0)
        .optional()
        .messages({
          'number.base': 'Google price must be a number',
          'number.min': 'Google price cannot be negative'
        })
    }).required(),
    appleProduct: Joi.object({
      productId: Joi.string()
        .required()
        .messages({
          'string.empty': 'Apple product ID is required',
          'any.required': 'Apple product ID is required'
        }),
      bundleId: Joi.string()
        .required()
        .messages({
          'string.empty': 'Bundle ID is required',
          'any.required': 'Bundle ID is required'
        }),
      displayName: Joi.string()
        .max(100)
        .optional()
        .messages({
          'string.max': 'Display name cannot exceed 100 characters'
        }),
      description: Joi.string()
        .max(500)
        .optional()
        .messages({
          'string.max': 'Description cannot exceed 500 characters'
        }),
      price: Joi.number()
        .min(0)
        .optional()
        .messages({
          'number.base': 'Price must be a number',
          'number.min': 'Price cannot be negative'
        }),
      priceLocale: Joi.string()
        .optional()
        .messages({
          'string.empty': 'Price locale must not be empty'
        }),
      subscriptionGroup: Joi.string()
        .optional()
        .messages({
          'string.empty': 'Subscription group must not be empty'
        }),
      subscriptionPeriod: Joi.string()
        .valid('P1W', 'P1M', 'P3M', 'P6M', 'P1Y')
        .optional()
        .messages({
          'any.only': 'Subscription period must be one of: P1W, P1M, P3M, P6M, P1Y'
        })
    }).required(),
    googleProduct: Joi.object({
      productId: Joi.string()
        .required()
        .messages({
          'string.empty': 'Google product ID is required',
          'any.required': 'Google product ID is required'
        }),
      packageName: Joi.string()
        .required()
        .messages({
          'string.empty': 'Package name is required',
          'any.required': 'Package name is required'
        }),
      title: Joi.string()
        .max(100)
        .optional()
        .messages({
          'string.max': 'Title cannot exceed 100 characters'
        }),
      description: Joi.string()
        .max(500)
        .optional()
        .messages({
          'string.max': 'Description cannot exceed 500 characters'
        }),
      price: Joi.number()
        .min(0)
        .optional()
        .messages({
          'number.base': 'Price must be a number',
          'number.min': 'Price cannot be negative'
        }),
      priceCurrencyCode: Joi.string()
        .optional()
        .messages({
          'string.empty': 'Price currency code must not be empty'
        }),
      subscriptionPeriod: Joi.string()
        .valid('P1W', 'P1M', 'P3M', 'P6M', 'P1Y')
        .optional()
        .messages({
          'any.only': 'Subscription period must be one of: P1W, P1M, P3M, P6M, P1Y'
        }),
      trialPeriod: Joi.string()
        .optional()
        .messages({
          'string.empty': 'Trial period must not be empty'
        }),
      gracePeriod: Joi.string()
        .optional()
        .messages({
          'string.empty': 'Grace period must not be empty'
        })
    }).required(),
    coach: Joi.string()
      .optional()
      .messages({
        'string.empty': 'Coach ID must not be empty'
      }),
    isGlobal: Joi.boolean()
      .default(false)
      .messages({
        'boolean.base': 'Is global must be a boolean'
      }),
    metadata: Joi.object({
      category: Joi.string()
        .valid('fitness', 'yoga', 'nutrition', 'premium', 'basic')
        .default('fitness')
        .messages({
          'any.only': 'Category must be one of: fitness, yoga, nutrition, premium, basic'
        }),
      tags: Joi.array()
        .items(Joi.string())
        .optional()
        .messages({
          'array.base': 'Tags must be an array'
        }),
      features: Joi.array()
        .items(Joi.string())
        .optional()
        .messages({
          'array.base': 'Features must be an array'
        })
    }).optional()
  });

  return schema.validate(data, { abortEarly: false });
};
