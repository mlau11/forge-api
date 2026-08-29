import { randomBytes } from "node:crypto";
import { db } from "../db.ts";
import type { UserRow } from "../lib/auth.ts";
import { generateSHA256 } from "./crypto.ts";

interface SessionRow {
  hashed_token: string;
  user_id: string;
  expires_at: number;
  created_at: number;
}

export type PublicUser = Pick<UserRow, "id" | "email">;
type SessionInsert = Omit<SessionRow, "created_at">;

export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30;
export const currentTimeInSeconds = () => Math.floor(Date.now() / 1000);
export const EXPIRES_AT = currentTimeInSeconds() + SESSION_DURATION_SECONDS;

const insertSession = db.prepare<SessionInsert>(
  "INSERT INTO sessions (hashed_token, user_id, expires_at) VALUES (@hashed_token, @user_id, @expires_at)",
);
export const deleteAllSessionsByUserId = db.prepare<[string]>(
  "DELETE FROM sessions WHERE user_id = ?",
);
const findUserByHashedToken = db.prepare<[string, number], PublicUser>(
  "SELECT u.id, u.email FROM users u JOIN sessions s ON u.id = s.user_id WHERE hashed_token = ? AND expires_at > ?",
);
const deleteSessionByHashedToken = db.prepare<[string]>(
  "DELETE FROM sessions WHERE hashed_token = ?",
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

export const getSessionUser = (rawToken: string): PublicUser | undefined => {
  const hashed_token = generateSHA256(rawToken);

  const result = findUserByHashedToken.get(
    hashed_token,
    currentTimeInSeconds(),
  );

  return result;
};

export const deleteSession = (rawToken: string) => {
  const hashed_token = generateSHA256(rawToken);

  const result = deleteSessionByHashedToken.run(hashed_token);

  return result.changes > 0;
};
