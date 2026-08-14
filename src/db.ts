import Database from "better-sqlite3";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentPath = dirname(fileURLToPath(import.meta.url));
const DB_PATH =
  process.env.DATABASE_PATH ?? join(currentPath, "..", "data", "forge.db");
export const db = new Database(DB_PATH);

db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");
