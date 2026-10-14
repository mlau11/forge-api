import type { NextFunction, Request, RequestHandler, Response } from "express";
import { getSessionUser, type PublicUser } from "../lib/session.ts";

export interface AuthorizedRequest extends Request {
  user: PublicUser;
}

type AuthedHandler = (req: AuthorizedRequest, res: Response) => void;

export const authed =
  (handler: AuthedHandler): RequestHandler =>
  (req, res) =>
    handler(req as AuthorizedRequest, res);

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
