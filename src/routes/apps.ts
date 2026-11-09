import { Router } from "express";
import { uuidv7 } from "uuidv7";
import z from "zod";
import { db } from "../db.ts";
import { findOwnedApp, getAppForUser, saveAppVersion } from "../lib/apps.ts";
import { authed, requireAuth } from "../middleware/auth.ts";

export const appsRouter = Router();

appsRouter.use(requireAuth);

const CreateAppSchema = z.object({
  name: z.string().min(1).max(50),
});

const ParamsSchema = z.object({ id: z.string().min(1) });

const ComponentSchema = z.looseObject({
  id: z.string(),
  type: z.string(),
});

const DefinitionSchema = z.object({
  components: z
    .array(ComponentSchema)
    .refine(
      (components) =>
        new Set(components.map((c) => c.id)).size === components.length,
      { message: "Component ids must be unique" },
    ),
});

export interface AppRow {
  id: string;
  user_id: string;
  name: string;
  created_at: number;
}

type AppInsert = Omit<AppRow, "created_at">;

type AllAppsSelect = Pick<AppRow, "id" | "name" | "created_at">;

const insertApp = db.prepare<AppInsert>(
  "INSERT INTO apps (id, user_id, name) VALUES (@id, @user_id, @name)",
);

const findAppsByUserId = db.prepare<[string], AllAppsSelect>(
  "SELECT id, name, created_at FROM apps WHERE user_id = ? ORDER BY created_at DESC",
);

appsRouter.post(
  "/apps",
  authed((req, res) => {
    const parsed = CreateAppSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues });
    }

    const id = uuidv7();
    insertApp.run({
      id,
      user_id: req.user.id,
      name: parsed.data.name,
    });

    return res.status(201).json({ id, name: parsed.data.name });
  }),
);

appsRouter.get(
  "/apps",
  authed((req, res) => {
    const data = findAppsByUserId.all(req.user.id);

    return res.status(200).json({ apps: data });
  }),
);

appsRouter.get(
  "/apps/:id",
  authed((req, res) => {
    const parsed = ParamsSchema.safeParse(req.params);

    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.issues });

    const appId = parsed.data.id;
    const userId = req.user.id;

    const app = getAppForUser(appId, userId);

    if (!app) return res.status(404).json({ error: "App not found" });

    return res.status(200).json(app);
  }),
);

appsRouter.post(
  "/apps/:id/versions",
  authed((req, res) => {
    const parsedReq = DefinitionSchema.safeParse(req.body);
    const parsedParams = ParamsSchema.safeParse(req.params);

    if (!parsedReq.success) {
      return res.status(400).json({ error: parsedReq.error.issues });
    }

    if (!parsedParams.success) {
      return res.status(400).json({ error: parsedParams.error.issues });
    }

    const appId = parsedParams.data.id;
    const userId = req.user.id;

    const app = findOwnedApp.get(appId, userId);
    if (!app) return res.status(404).json({ error: "App not found" });

    const newVersion = saveAppVersion(
      appId,
      JSON.stringify(parsedReq.data.components),
    );

    return res.status(201).json({ version: newVersion });
  }),
);
