import { createHash } from "node:crypto";

export const isSQLiteError = (e: unknown): e is Error & { code: string } => {
  return (
    e instanceof Error &&
    "code" in e &&
    typeof (e as { code: unknown }).code === "string"
  );
};

export const generateSHA256 = (data: string) => {
  return createHash("sha256").update(data).digest("base64");
};
