import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { migrate } from "./migrate.ts";
import { authRouter } from "./routes/auth.ts";

const app = express();
const PORT = 3001;

try {
  migrate();
} catch (error) {
  console.error("Migration failed:", error);
  process.exit(1);
}

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
