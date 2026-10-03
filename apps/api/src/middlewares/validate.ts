import { RequestHandler } from "express";
import { ZodTypeAny } from "zod";
export const validate =
  (schema: ZodTypeAny): RequestHandler =>
  (req, _res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
export const validateQuery =
  (schema: ZodTypeAny): RequestHandler =>
  (req, _res, next) => {
    try {
      schema.parse(req.query);
      next();
    } catch (error) {
      next(error);
    }
  };
export const validateParams =
  (schema: ZodTypeAny): RequestHandler =>
  (req, _res, next) => {
    try {
      schema.parse(req.params);
      next();
    } catch (error) {
      next(error);
    }
  };
