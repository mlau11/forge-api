import * as argon2 from "argon2";
import { Router } from "express";
import { randomBytes } from "node:crypto";
import { uuidv7 } from "uuidv7";
import z from "zod";
import { db } from "../db.ts";
import { isSQLiteError } from "../lib/crypto.ts";
import { EmailTakenError, InvalidCredentialsError } from "../lib/errors.ts";
import { requestPasswordReset } from "../lib/passwordReset.ts";
import {
  createSession,
  deleteSession,
  SESSION_DURATION_SECONDS,
  type PublicUser,
} from "../lib/session.ts";
import { requireAuth } from "../middleware/auth.ts";

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: number;
}

export interface AuthorizedRequest {
  user: PublicUser;
}

type UserInsert = Omit<UserRow, "created_at">;
type RegistrationInput = z.infer<typeof RegistrationSchema>;
type LoginInput = z.infer<typeof LoginSchema>;

export const authRouter = Router();

const RegistrationSchema = z.object({
  email: z.email().toLowerCase(),
  password: z.string().min(10).max(200),
});

const LoginSchema = z.object({
  email: z.email().toLowerCase(),
  password: z.string(),
});

const ResetPasswordSchema = z.object({ email: z.email().toLowerCase() });

const insertUser = db.prepare(
  "INSERT INTO users (id, email, password_hash) VALUES (@id, @email, @password_hash)",
);

export const registerUser = async ({ email, password }: RegistrationInput) => {
  const id = uuidv7();

  try {
    const password_hash = await argon2.hash(password);

    const register = db.transaction((user: UserInsert) => {
      insertUser.run(user);
      return createSession(id);
    });

    const rawToken = register({
      id,
      email,
      password_hash,
    });

    return { id, email, rawToken };
  } catch (error) {
    if (isSQLiteError(error) && error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      throw new EmailTakenError(email);
    }

    throw error;
  }
};

const findUserByEmail = db.prepare<[string], UserRow>(
  "SELECT id, email, password_hash FROM users WHERE email = ?",
);

const DUMMY_HASH = await argon2.hash(randomBytes(32).toString("hex"));

const loginUser = async ({ email, password }: LoginInput) => {
  const result = findUserByEmail.get(email);

  if (!result) {
    await argon2.verify(DUMMY_HASH, password);
    throw new InvalidCredentialsError();
  }

  const isVerified = await argon2.verify(result.password_hash, password);

  if (!isVerified) {
    throw new InvalidCredentialsError();
  }

  const rawToken = createSession(result.id);

  return { id: result.id, email: result.email, rawToken };
};

authRouter.post("/register", async (req, res) => {
  const parsed = RegistrationSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }

  try {
    const { email, id, rawToken } = await registerUser(parsed.data);

    res.cookie("session", rawToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: SESSION_DURATION_SECONDS * 1000,
    });

    return res.status(201).json({ id, email });
  } catch (error) {
    if (error instanceof EmailTakenError) {
      return res
        .status(409)
        .json({ error: "This email is already registered." });
    }
    throw error;
  }
});

authRouter.post("/login", async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }

  try {
    const { id, email, rawToken } = await loginUser(parsed.data);

    res.cookie("session", rawToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: SESSION_DURATION_SECONDS * 1000,
    });

    return res.status(200).json({ id, email });
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    throw error;
  }
});

authRouter.get("/me", requireAuth, (req, res) => {
  const { user } = req as AuthorizedRequest;
  res.json(user);
});

authRouter.post("/logout", (req, res) => {
  const token = req.cookies.session as string | undefined;

  if (token) deleteSession(token);

  res.clearCookie("session");

  return res.status(204).end();
});

authRouter.post("/forgot-password", (req, res) => {
  const parsed = ResetPasswordSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }

  requestPasswordReset(parsed.data.email);

  return res.status(200).json({
    message: "If the email is registered, then a reset link has been sent.",
  });
});
