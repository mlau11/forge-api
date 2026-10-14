import { Router } from "express";
import { uuidv7 } from "uuidv7";
import z from "zod";
import { db } from "../db.ts";
import { authed, requireAuth } from "../middleware/auth.ts";

export const appsRouter = Router();

appsRouter.use(requireAuth);

const CreateAppSchema = z.object({
  name: z.string().min(1).max(50),
});

export interface AppRow {
  id: string;
  user_id: string;
  name: string;
  created_at: number;
}

type AppInsert = Omit<AppRow, "created_at">;

const insertApp = db.prepare<AppInsert>(
  "INSERT INTO apps (id, user_id, name) VALUES (@id, @user_id, @name)",
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
