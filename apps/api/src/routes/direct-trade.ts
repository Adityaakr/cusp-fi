import { Router } from "express";
import { processDirectTrade } from "../services/direct-trade.service.js";

const router = Router();

router.post("/api/trade/direct", async (req, res) => {
  try {
    const { wallet_address, input_asset, input_amount_ui, market_query, side, max_slippage_bps } = req.body;
    const result = await processDirectTrade({
      wallet_address, input_asset, input_amount_ui, market_query, side, max_slippage_bps,
    });
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Direct trade failed" });
  }
});

export default router;
