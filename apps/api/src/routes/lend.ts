import { Router } from "express";
import { processLendDeposit, processLendWithdrawal } from "../services/lend.service.js";

const router = Router();

router.post("/api/lend/deposit", async (req, res) => {
  try {
    const { wallet_address, input_asset, amount_ui, pool } = req.body;
    const result = await processLendDeposit({ wallet_address, input_asset, amount_ui, pool });
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Lend deposit failed" });
  }
});

router.post("/api/lend/withdraw", async (req, res) => {
  try {
    const { wallet_address, input_asset, amount_ui, pool } = req.body;
    const result = await processLendWithdrawal({ wallet_address, input_asset, amount_ui, pool });
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Lend withdrawal failed" });
  }
});

export default router;
