import { Router } from "express";
import { syncMarkets } from "../services/market-sync.service.js";
import { runLiquidationCheck } from "../services/liquidation.service.js";
import { updateYield } from "../services/yield.service.js";

const router = Router();

router.post("/api/crank/sync-markets", async (_req, res) => {
  try {
    const result = await syncMarkets();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Sync failed" });
  }
});

router.post("/api/crank/liquidate", async (_req, res) => {
  try {
    const result = await runLiquidationCheck();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Liquidation check failed" });
  }
});

router.post("/api/crank/update-yield", async (_req, res) => {
  try {
    const result = await updateYield();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Yield update failed" });
  }
});

export default router;
