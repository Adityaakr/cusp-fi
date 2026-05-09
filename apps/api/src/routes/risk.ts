import { Router } from "express";
import { performRiskCheck } from "../services/risk-engine.service.js";

const router = Router();

router.post("/api/risk-check", async (req, res) => {
  try {
    const { market_ticker, margin_usdc, leverage } = req.body;
    if (!market_ticker) {
      res.status(400).json({ approved: false, errors: ["market_ticker is required"] });
      return;
    }
    const result = await performRiskCheck({ market_ticker, margin_usdc, leverage });
    res.json(result);
  } catch (err) {
    res.status(500).json({
      approved: false,
      errors: [err instanceof Error ? err.message : "Risk check failed"],
    });
  }
});

export default router;
