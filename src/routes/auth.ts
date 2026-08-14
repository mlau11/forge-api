import * as argon2 from "argon2";
import { Router } from "express";
import { randomBytes } from "node:crypto";
import { uuidv7 } from "uuidv7";
import z from "zod";
import { db } from "../db.ts";
import { isSQLiteError } from "../lib/crypto.ts";
import { EmailTakenError } from "../lib/errors.ts";
import { createSession, SESSION_DURATION_SECONDS } from "../lib/session.ts";

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: number;
}

type UserInsert = Omit<UserRow, "created_at">;
type RegistrationInput = z.infer<typeof RegistrationSchema>;

export const authRouter = Router();

const RegistrationSchema = z.object({
  email: z.email(),
  password: z.string().min(10).max(200),
});

const insertUser = db.prepare(
  "INSERT INTO users (id, email, password_hash) VALUES (@id, @email, @password_hash)",
);

export const registerUser = async (body: RegistrationInput) => {
  const { email, password } = body;
  const id = uuidv7();
  const normalizedEmail = email.toLowerCase();

  try {
    const password_hash = await argon2.hash(password);

    const register = db.transaction((user: UserInsert) => {
      insertUser.run(user);
      return createSession(id);
    });

    const rawToken = randomBytes(32).toString("base64url");

    register({
      id,
      email: normalizedEmail,
      password_hash,
    });

    return { id, email: normalizedEmail, rawToken };
  } catch (error) {
    if (isSQLiteError(error) && error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      throw new EmailTakenError(normalizedEmail);
    }

    throw error;
  }
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
