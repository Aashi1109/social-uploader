import RequestContext, { IRequestContext } from "./request-context";
import { logger } from "@/core/logger";
import { getUUIDv7 } from "@/shared/utils/ids";
import { AsyncLocalStorage } from "async_hooks";
import { Request, Response, NextFunction } from "express";

const asyncLocalStorage = new AsyncLocalStorage<IRequestContext>();

const requestContextMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Generate a unique request ID or use one from headers if provided
  const requestId = getUUIDv7();
  const startTime = Date.now();

  const context: IRequestContext = {
    requestId,
    timings: {
      start: startTime,
    },
  };

  try {
    RequestContext.run(context, async () => {
      next();
    });
  } catch (error) {
    logger.error({ error }, "In context error");
  }
};

export default requestContextMiddleware;
