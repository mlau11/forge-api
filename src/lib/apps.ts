import { db } from "../db.ts";
import { uuidv7 } from "uuidv7";
import { isSQLiteError } from "./crypto.ts";

export const findOwnedApp = db.prepare<
  [string, string],
  { id: string; name: string }
>("SELECT id, name FROM apps WHERE id = ? AND user_id = ?");

const findLatestAppDefinition = db.prepare<
  [string, string],
  { definition: string }
>(
  `SELECT app_versions.definition
   FROM app_versions
   JOIN apps ON apps.id = app_versions.app_id
   WHERE app_versions.app_id = ? AND apps.user_id = ?
   ORDER BY app_versions.version DESC
   LIMIT 1`,
);

const insertAppDefinition = db.prepare<{
  id: string;
  definition: string;
  app_id: string;
  version: number;
}>(
  "INSERT INTO app_versions (id, definition, app_id, version) VALUES (@id, @definition, @app_id, @version)",
);

const getMaxVersion = db.prepare<[string], { maxVersion: number }>(
  "SELECT COALESCE(MAX(version), 0) AS maxVersion FROM app_versions WHERE app_id = ?",
);

export function getAppForUser(appId: string, userId: string) {
  const app = findOwnedApp.get(appId, userId);
  if (!app) return null;

  const appVersion = findLatestAppDefinition.get(appId, userId);
  return {
    id: app.id,
    name: app.name,
    definition: appVersion
      ? JSON.parse(appVersion.definition)
      : { components: [] },
  };
}

const saveOnce = db.transaction((appId: string, definition: string) => {
  const { maxVersion } = getMaxVersion.get(appId)!; // not possible to be undefined here; max on an empty table will return null, coalesce on null will return 0
  const newVersion = maxVersion + 1;
  insertAppDefinition.run({
    id: uuidv7(),
    definition,
    app_id: appId,
    version: newVersion,
  });
  return newVersion;
});

export function saveAppVersion(appId: string, definition: string): number {
  const MAX_ATTEMPTS = 5;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return saveOnce(appId, definition);
    } catch (error) {
      if (isSQLiteError(error) && error.code === "SQLITE_CONSTRAINT_UNIQUE") {
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Failed to save after ${MAX_ATTEMPTS} attempts`);
}
