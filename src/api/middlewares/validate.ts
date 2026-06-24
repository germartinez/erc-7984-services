import type { Request, RequestHandler } from 'express';
import { ZodObject } from 'zod';
import { ApiError } from './error-handler';

export type ValidatedRequest<P = unknown, Q = unknown, B = unknown> = Request & {
  validated: {
    params: P;
    query: Q;
    body: B;
  };
};

export function validate(schemas: {
  params?: ZodObject<any>;
  query?: ZodObject<any>;
  body?: ZodObject<any>;
}): RequestHandler {
  return (req, res, next) => {
    try {
      req.validated = req.validated || {};

      const validateAndAssign = (
        data: unknown,
        schema: ZodObject<any>,
        key: 'params' | 'query' | 'body',
      ): void => {
        const parsed = schema.safeParse(data);
        if (!parsed.success) {
          throw new ApiError(
            400,
            `INVALID_${key.toUpperCase()}`,
            `Invalid request ${key}`,
            parsed.error.issues,
          );
        }
        req.validated![key] = parsed.data;
      };

      if (schemas.params) validateAndAssign(req.params, schemas.params, 'params');
      if (schemas.query) validateAndAssign(req.query, schemas.query, 'query');
      if (schemas.body) validateAndAssign(req.body, schemas.body, 'body');

      next();
    } catch (err) {
      next(err);
    }
  };
}
