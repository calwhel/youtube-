import type { NextFunction, Request, Response } from "express";

import type { PlatformConfig } from "../config";
import { readAuthCookie } from "../utils/auth-cookie";

export function createAuthMiddleware(config: PlatformConfig) {
  return function authenticate(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const headerToken = req.header("x-auth-token") ?? req.header("authorization");
    const normalizedHeader =
      headerToken?.startsWith("Bearer ") === true
        ? headerToken.slice(7)
        : headerToken;
    const cookieToken = readAuthCookie(req);
    const normalized = normalizedHeader ?? cookieToken;

    if (!normalized || normalized !== config.authToken) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    next();
  };
}
