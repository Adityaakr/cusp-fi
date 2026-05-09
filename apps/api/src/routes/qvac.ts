import { Router } from "express";
import { routeQvacCommand } from "../qvac/router.js";

const router = Router();

router.post("/api/qvac", async (req, res) => {
  try {
    const result = await routeQvacCommand(req.body);
    const status = result.success ? 200 : 400;
    res.status(status).json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      intent_id: "unknown",
      error: err instanceof Error ? err.message : "Internal QVAC router error",
    });
  }
});

export default router;
