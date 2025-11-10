import type { Request, Response, NextFunction } from "express";
import { API_TOKENS } from "@/shared/constants";

function bearerAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !API_TOKENS.includes(token)) {
    return res.status(401).json({ error: "unauthorized" });
  }
  return next();
}

export default bearerAuth;
