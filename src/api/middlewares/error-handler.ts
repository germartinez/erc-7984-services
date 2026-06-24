import type { NextFunction, Request, Response } from 'express';

type ErrorResponse = {
  error: boolean;
  code: string;
  message: string;
  details?: unknown;
};

export class ApiError extends Error {
  public statusCode: number;
  public code: string;
  public details: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function globalErrorHandler(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  let statusCode = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected error occurred';
  let details: unknown = undefined;

  if (error instanceof ApiError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
    details = error.details;
  }

  console.error(
    {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      method: req.method,
      route: req.originalUrl,
      params: req.params,
      query: req.query,
      timestamp: new Date().toISOString(),
      statusCode,
      code,
    },
    `ApiError`,
  );

  if (res.headersSent) {
    return next(error);
  }

  const responsePayload: ErrorResponse = {
    error: true,
    code,
    message,
  };
  if (details) {
    responsePayload.details = details;
  }
  res.status(statusCode).json(responsePayload);
}
