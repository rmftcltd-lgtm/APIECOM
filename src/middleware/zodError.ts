import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { errorHandler } from "./errorHandler.js";

export function asyncErrorAwareHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Validation failed",
      details: err.flatten(),
    });
    return;
  }
  errorHandler(err, req, res, next);
}
