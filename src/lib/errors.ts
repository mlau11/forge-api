export class EmailTakenError extends Error {
  constructor(email: string) {
    super(`${email} is already registered`);
    this.name = "EmailTakenError";
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid email or password");
    this.name = "InvalidCredentialsError";
  }
}

export class InvalidPasswordResetTokenError extends Error {
  constructor() {
    super("This password reset link is invalid or expired");
    this.name = "InvalidPasswordResetTokenError";
  }
}
