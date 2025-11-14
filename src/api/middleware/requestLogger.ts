import { logger } from "@/core/logger";
import { pinoHttp } from "pino-http";
import RequestContext from "./contexts/request-context";
import { NextFunction, Request, Response } from "express";

export default (req: Request, res: Response, next: NextFunction) =>
  pinoHttp({
    logger,
    genReqId: (req) => RequestContext.getRequestId() || "",
  })(req, res, next);
