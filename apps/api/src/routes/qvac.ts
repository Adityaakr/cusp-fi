import { Router } from "express";
import { routeQvacCommand } from "../qvac/router.js";
import { executeAssistantIntent, previewAssistantIntent } from "../qvac/assistant.js";

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

router.post("/api/qvac/assistant/preview", async (req, res) => {
  try {
    const result = await previewAssistantIntent(req.body.intent, req.body.context ?? {});
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Internal QVAC preview error",
    });
  }
});

router.post("/api/qvac/assistant/execute", async (req, res) => {
  try {
    const result = await executeAssistantIntent(req.body.command, req.body.intent);
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Internal QVAC execute error",
    });
  }
});

export default router;
