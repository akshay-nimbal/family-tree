import { Router, Request, Response } from "express";
import {
  validatePersonInput,
  validateRelationshipInput,
  validateUUID,
} from "../middleware/validation";
import {
  createPerson,
  getPersonById,
  updatePerson,
  createRelationship,
  removeRelationship,
  searchPersons,
  checkDuplicates,
  getPersonRelationships,
  findRelationshipPaths,
  mergePersonRecords,
} from "../services/personService";

const router = Router();

function param(req: Request, name: string): string {
  const v = req.params[name];
  return Array.isArray(v) ? v[0] : v;
}

router.post("/", validatePersonInput, async (req: Request, res: Response) => {
  try {
    const person = await createPerson(req.body);
    res.status(201).json(person);
  } catch (err) {
    console.error("Error creating person:", err);
    res.status(500).json({ error: "Failed to create person" });
  }
});

router.get("/search", async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    if (!query || query.length < 2) {
      res.status(400).json({ error: "Search query must be at least 2 characters" });
      return;
    }
    const familyName = req.query.family as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const results = await searchPersons(query, familyName, limit);
    res.json(results);
  } catch (err) {
    console.error("Error searching persons:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

router.get("/check-duplicates", async (req: Request, res: Response) => {
  try {
    const name = req.query.name as string;
    if (!name || name.length < 2) {
      res.status(400).json({ error: "name must be at least 2 characters" });
      return;
    }
    const phone = req.query.phone as string | undefined;
    const email = req.query.email as string | undefined;
    const results = await checkDuplicates(name, phone, email);
    res.json(results);
  } catch (err) {
    console.error("Error checking duplicates:", err);
    res.status(500).json({ error: "Duplicate check failed" });
  }
});

router.get(
  "/:id",
  validateUUID("id"),
  async (req: Request, res: Response) => {
    try {
      const person = await getPersonById(param(req, "id"));
      if (!person) {
        res.status(404).json({ error: "Person not found" });
        return;
      }
      res.json(person);
    } catch (err) {
      console.error("Error fetching person:", err);
      res.status(500).json({ error: "Failed to fetch person" });
    }
  }
);

router.patch(
  "/:id",
  validateUUID("id"),
  async (req: Request, res: Response) => {
    try {
      const person = await updatePerson(param(req, "id"), req.body);
      if (!person) {
        res.status(404).json({ error: "Person not found" });
        return;
      }
      res.json(person);
    } catch (err) {
      console.error("Error updating person:", err);
      res.status(500).json({ error: "Failed to update person" });
    }
  }
);

router.get(
  "/:id/relationships",
  validateUUID("id"),
  async (req: Request, res: Response) => {
    try {
      const relationships = await getPersonRelationships(param(req, "id"));
      res.json(relationships);
    } catch (err) {
      console.error("Error fetching relationships:", err);
      res.status(500).json({ error: "Failed to fetch relationships" });
    }
  }
);

router.get(
  "/:id/paths/:otherId",
  validateUUID("id"),
  async (req: Request, res: Response) => {
    try {
      const paths = await findRelationshipPaths(
        param(req, "id"),
        param(req, "otherId")
      );
      res.json(paths);
    } catch (err) {
      console.error("Error finding paths:", err);
      res.status(500).json({ error: "Failed to find relationship paths" });
    }
  }
);

router.post(
  "/relationships",
  validateRelationshipInput,
  async (req: Request, res: Response) => {
    try {
      await createRelationship(req.body);
      res.status(201).json({ message: "Relationship created" });
    } catch (err) {
      console.error("Error creating relationship:", err);
      res.status(500).json({ error: "Failed to create relationship" });
    }
  }
);

router.delete(
  "/relationships",
  validateRelationshipInput,
  async (req: Request, res: Response) => {
    try {
      await removeRelationship(
        req.body.fromPersonId,
        req.body.toPersonId,
        req.body.type
      );
      res.json({ message: "Relationship removed" });
    } catch (err) {
      console.error("Error removing relationship:", err);
      res.status(500).json({ error: "Failed to remove relationship" });
    }
  }
);

router.post(
  "/:id/merge/:mergeId",
  validateUUID("id"),
  async (req: Request, res: Response) => {
    try {
      const result = await mergePersonRecords(
        param(req, "id"),
        param(req, "mergeId")
      );
      if (!result) {
        res.status(404).json({ error: "Person not found" });
        return;
      }
      res.json(result);
    } catch (err) {
      console.error("Error merging records:", err);
      res.status(500).json({ error: "Failed to merge records" });
    }
  }
);

export default router;
