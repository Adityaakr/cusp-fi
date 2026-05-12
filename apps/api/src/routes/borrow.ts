import { Router } from "express";
import { processBorrowOpen, processBorrowClose } from "../services/borrow.service.js";

const router = Router();

router.post("/api/borrow/open", async (req, res) => {
  try {
    const { wallet_address, collateral_asset, borrow_asset, borrow_amount_ui, risk_mode, amount_ui } = req.body;
    const result = await processBorrowOpen({
      wallet_address, collateral_asset, borrow_asset, borrow_amount_ui, risk_mode, amount_ui,
    });
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Borrow open failed" });
  }
});

router.post("/api/borrow/close", async (req, res) => {
  try {
    const { wallet_address, repay_asset, repay_amount_ui } = req.body;
    const result = await processBorrowClose({ wallet_address, repay_asset, repay_amount_ui });
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Borrow close failed" });
  }
});

export default router;
