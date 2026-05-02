import { Router, Request, Response } from "express";
import { getAllFamilies, getFamilyMembers, getFullGraph } from "../services/personService";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const families = await getAllFamilies();
    res.json(families);
  } catch (err) {
    console.error("Error fetching families:", err);
    res.status(500).json({ error: "Failed to fetch families" });
  }
});

router.get("/graph", async (_req: Request, res: Response) => {
  try {
    const graph = await getFullGraph();
    res.json(graph);
  } catch (err) {
    console.error("Error fetching graph:", err);
    res.status(500).json({ error: "Failed to fetch graph data" });
  }
});

router.get("/:name/members", async (req: Request, res: Response) => {
  try {
    const name = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
    const members = await getFamilyMembers(name);
    res.json(members);
  } catch (err) {
    console.error("Error fetching family members:", err);
    res.status(500).json({ error: "Failed to fetch family members" });
  }
});

export default router;
