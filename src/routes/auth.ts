import { Router } from "express";
import {
  LoginSchema,
  loginUser,
  registerUser,
  RegistrationSchema,
} from "../lib/auth.ts";
import {
  EmailTakenError,
  InvalidCredentialsError,
  InvalidPasswordResetTokenError,
} from "../lib/errors.ts";
import {
  ForgotPasswordSchema,
  requestPasswordReset,
  resetPassword,
  ResetPasswordSchema,
} from "../lib/passwordReset.ts";
import { deleteSession, SESSION_DURATION_SECONDS } from "../lib/session.ts";
import { requireAuth, type AuthorizedRequest } from "../middleware/auth.ts";

const SESSION_COOKIE = "session";
const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: SESSION_DURATION_SECONDS * 1000,
} as const;

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const parsed = RegistrationSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }

  try {
    const { email, id, rawToken } = await registerUser(parsed.data);

    res.cookie(SESSION_COOKIE, rawToken, sessionCookieOptions);

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

    res.cookie(SESSION_COOKIE, rawToken, sessionCookieOptions);

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
  const parsed = ForgotPasswordSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }

  requestPasswordReset(parsed.data.email);

  return res.status(200).json({
    message: "If the email is registered, then a reset link has been sent.",
  });
});

authRouter.post("/reset-password", async (req, res) => {
  const parsed = ResetPasswordSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }

  try {
    await resetPassword(parsed.data.token, parsed.data.password);

    return res.status(200).json({ message: "Password updated." });
  } catch (error) {
    if (error instanceof InvalidPasswordResetTokenError) {
      return res
        .status(400)
        .json({ error: "This password reset link is invalid or expired." });
    }

    throw error;
  }
});
