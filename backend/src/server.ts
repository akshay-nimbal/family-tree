import express from "express";
import path from "node:path";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { initDatabase, closeDatabase } from "./config/database";
import { initSchema } from "./config/schema";
import personsRouter from "./routes/persons";
import familiesRouter from "./routes/families";
import photoRouter from "./routes/photos";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
      : ["http://localhost:5173", "https://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.use("/api/persons", personsRouter);
app.use("/api/families", familiesRouter);
app.use("/api/photos", photoRouter);
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

async function start() {
  try {
    initDatabase();
    await initSchema();
    app.listen(PORT, () => {
      console.log(`Vamsha API server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

process.on("SIGTERM", async () => {
  console.log("Shutting down gracefully...");
  await closeDatabase();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("Shutting down...");
  await closeDatabase();
  process.exit(0);
});

start();
