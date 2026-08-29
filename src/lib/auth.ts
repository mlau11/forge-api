import { uuidv7 } from "uuidv7";
import z from "zod";
import { hash, verify } from "argon2";
import { randomBytes } from "node:crypto";
import { isSQLiteError } from "./crypto.ts";
import { EmailTakenError, InvalidCredentialsError } from "./errors.ts";
import { createSession } from "./session.ts";
import { db } from "../db.ts";

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: number;
}

type UserInsert = Omit<UserRow, "created_at">;
type RegistrationInput = z.infer<typeof RegistrationSchema>;
type LoginInput = z.infer<typeof LoginSchema>;

export const RegistrationSchema = z.object({
  email: z.email().toLowerCase(),
  password: z.string().min(10).max(200),
});

export const LoginSchema = z.object({
  email: z.email().toLowerCase(),
  password: z.string(),
});

const insertUser = db.prepare<UserInsert>(
  "INSERT INTO users (id, email, password_hash) VALUES (@id, @email, @password_hash)",
);
const findUserByEmail = db.prepare<[string], UserRow>(
  "SELECT id, email, password_hash FROM users WHERE email = ?",
);
const DUMMY_HASH = await hash(randomBytes(32).toString("hex"));

export const registerUser = async ({ email, password }: RegistrationInput) => {
  const id = uuidv7();

  try {
    const password_hash = await hash(password);

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

export const loginUser = async ({ email, password }: LoginInput) => {
  const result = findUserByEmail.get(email);

  if (!result) {
    await verify(DUMMY_HASH, password);
    throw new InvalidCredentialsError();
  }

  const isVerified = await verify(result.password_hash, password);

  if (!isVerified) {
    throw new InvalidCredentialsError();
  }

  const rawToken = createSession(result.id);

  return { id: result.id, email: result.email, rawToken };
};
