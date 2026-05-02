import { Router, Request, Response } from "express";
import multer from "multer";
import path from "node:path";
import crypto from "node:crypto";
import { getSession } from "../config/database";

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = crypto.randomUUID() + ext;
    cb(null, safeName);
  },
});

function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  if (ALLOWED_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, and WebP images are allowed"));
  }
}

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE } });

const router = Router();

router.post(
  "/:personId",
  upload.single("photo"),
  async (req: Request, res: Response) => {
    try {
      const personId = Array.isArray(req.params.personId)
        ? req.params.personId[0]
        : req.params.personId;

      if (!req.file) {
        res.status(400).json({ error: "No photo file provided" });
        return;
      }

      const photoUrl = `/uploads/${req.file.filename}`;

      const session = getSession();
      try {
        const result = await session.run(
          `MATCH (p:Person {id: $id}) SET p.photoUrl = $photoUrl, p.updatedAt = $now RETURN p.id AS id`,
          { id: personId, photoUrl, now: new Date().toISOString() }
        );
        if (result.records.length === 0) {
          res.status(404).json({ error: "Person not found" });
          return;
        }
      } finally {
        await session.close();
      }

      res.json({ photoUrl });
    } catch (err) {
      console.error("Error uploading photo:", err);
      res.status(500).json({ error: "Failed to upload photo" });
    }
  }
);

export default router;
