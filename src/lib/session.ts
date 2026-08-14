import { randomBytes } from "node:crypto";
import { db } from "../db.ts";
import { generateSHA256 } from "./crypto.ts";

export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30;
export const EXPIRES_AT =
  Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS;

const insertSession = db.prepare(
  "INSERT INTO sessions (hashed_token, user_id, expires_at) VALUES (@hashed_token, @user_id, @expires_at)",
);

export const createSession = (userId: string): string => {
  const rawToken = randomBytes(32).toString("base64url");

  insertSession.run({
    hashed_token: generateSHA256(rawToken),
    user_id: userId,
    expires_at: EXPIRES_AT,
  });

  return rawToken;
};
