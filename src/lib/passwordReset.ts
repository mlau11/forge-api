import { randomBytes } from "node:crypto";
import { db } from "../db.ts";
import { generateSHA256 } from "./crypto.ts";
import { currentTimeInSeconds } from "./session.ts";

const RESET_TOKEN_DURATION = 60 * 60;

const findUserByEmail = db.prepare<[string], { id: string }>(
  "SELECT id FROM users WHERE email = ?",
);

const insertPasswordResetToken = db.prepare<{
  hashed_token: string;
  user_id: string;
  expires_at: number;
}>(
  "INSERT INTO password_reset_tokens (hashed_token, user_id, expires_at) VALUES (@hashed_token, @user_id, @expires_at)",
);

export const requestPasswordReset = (email: string): string | undefined => {
  const result = findUserByEmail.get(email);

  if (!result) return;

  const token = randomBytes(32).toString("base64url");
  const expires_at = currentTimeInSeconds() + RESET_TOKEN_DURATION;

  insertPasswordResetToken.run({
    hashed_token: generateSHA256(token),
    user_id: result.id,
    expires_at,
  });

  // temporary log due to no email provider
  console.log(`[reset] http://localhost:5173/reset?token=${token}`);

  return token;
};
