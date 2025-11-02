// src/utils/validation.js
import Joi from 'joi';

export const loginValidation = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

export const leaveValidation = Joi.object({
  leaveTypeId: Joi.number().integer().required(),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
  reason: Joi.string().max(500).required(),
  attachment: Joi.string().uri().optional(),
});