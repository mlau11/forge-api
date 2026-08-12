import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const currentPath = dirname(fileURLToPath(import.meta.url));
const dir = join(currentPath, "..", "migrations");
const files = readdirSync(dir)
  .filter((files) => files.endsWith(".sql"))
  .sort();
const db = new Database(":memory:");

for (const file of files) {
  try {
    db.exec(readFileSync(join(dir, file), "utf8"));
  } catch (error) {
    console.error(`Failed in ${file}`, (error as Error).message);
    process.exit(1);
  }
}

console.log(`schema OK (${files.length} migrations)`);
