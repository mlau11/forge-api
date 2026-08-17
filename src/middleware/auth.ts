import type { NextFunction, Request, Response } from "express";
import { getSessionUser } from "../lib/session.ts";

export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const sessionToken = req.cookies.session;

  if (!sessionToken) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const user = getSessionUser(sessionToken);

  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  req.user = user;
  next();
};
