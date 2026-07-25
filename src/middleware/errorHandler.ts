import type { NextFunction, Request, Response } from "express";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const message = err instanceof Error ? err.message : "Unexpected error";
  const status =
    /not found/i.test(message) ? 404
      : /missing required|unsupported|requires|already completed|no draft/i.test(message)
        ? 400
        : 500;

  res.status(status).json({
    error: message,
  });
}
