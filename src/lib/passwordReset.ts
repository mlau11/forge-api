import { hash } from "argon2";
import { randomBytes } from "node:crypto";
import { db } from "../db.ts";
import { generateSHA256 } from "./crypto.ts";
import { InvalidPasswordResetTokenError } from "./errors.ts";
import { currentTimeInSeconds, deleteAllSessionsByUserId } from "./session.ts";

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

const updatePassword = db.prepare<[string, string]>(
  "UPDATE users SET password_hash = ? WHERE id = ?",
);
const findPasswordResetToken = db.prepare<
  [string, number],
  { user_id: string }
>(
  "SELECT user_id FROM password_reset_tokens WHERE hashed_token = ? AND expires_at > ?",
);
const deletePasswordResetToken = db.prepare<[string]>(
  "DELETE FROM password_reset_tokens WHERE hashed_token = ?",
);

export const resetPassword = async (token: string, password: string) => {
  const hashed_token = generateSHA256(token);
  const currentTime = currentTimeInSeconds();

  const result = findPasswordResetToken.get(hashed_token, currentTime);

  if (!result) {
    throw new InvalidPasswordResetTokenError();
  }

  const password_hash = await hash(password);

  const resetPasswordTransaction = db.transaction((password_hash: string) => {
    updatePassword.run(password_hash, result.user_id);
    deleteAllSessionsByUserId.run(result.user_id);
    deletePasswordResetToken.run(hashed_token);
  });

  resetPasswordTransaction(password_hash);
};
