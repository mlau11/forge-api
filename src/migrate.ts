import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "./db.ts";

const currentPath = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(currentPath, "..", "migrations");

export function migrate(dir: string = MIGRATIONS_DIR): void {
  const files = readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const applied = db.pragma("user_version", { simple: true }) as number;
  const run = db.transaction((sql: string, version: number) => {
    db.exec(sql);
    db.pragma(`user_version = ${version}`);
  });

  for (const file of files) {
    const version = Number(file.split("_")[0]);

    if (Number.isNaN(version)) {
      throw new Error(`Migration filename must start with a number: ${file}`);
    }

    if (version <= applied) continue;

    run(readFileSync(join(dir, file), "utf8"), version);

    console.log(`Applied ${file}`);
  }
}
