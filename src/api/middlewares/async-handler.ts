import { NextFunction, Request, RequestHandler, Response } from 'express';

export function asyncHandler<TReq extends Request>(
  handler: (req: TReq, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return async (req, res, next) => {
    try {
      await handler(req as TReq, res, next);
    } catch (error) {
      next(error);
    }
  };
}
