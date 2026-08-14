export class EmailTakenError extends Error {
  constructor(email: string) {
    super(`${email} is already registered`);
    this.name = "EmailTakenError";
  }
}
