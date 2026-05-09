import { Router } from "express";
import { processLeverageTradeOpen, processLeverageTradeClose } from "../services/leverage-trade.service.js";

const router = Router();

router.post("/api/trade/leverage", async (req, res) => {
  try {
    const { wallet_address, margin_amount_ui, leverage, market_query, side, max_slippage_bps } = req.body;
    const result = await processLeverageTradeOpen({
      wallet_address, margin_amount_ui, leverage, market_query, side, max_slippage_bps,
    });
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Leverage trade failed" });
  }
});

router.post("/api/trade/leverage/close", async (req, res) => {
  try {
    const { position_id, wallet_address } = req.body;
    const result = await processLeverageTradeClose({ position_id, wallet_address });
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Leverage close failed" });
  }
});

export default router;
