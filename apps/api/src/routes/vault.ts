import { Router } from "express";
import { processDeposit, processWithdrawal } from "../services/vault.service.js";

const router = Router();

router.post("/api/vault/deposit", async (req, res) => {
  try {
    const { wallet_address, tx_signature, amount_usdc } = req.body;
    if (!wallet_address || !tx_signature || !amount_usdc) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }
    const result = await processDeposit({ wallet_address, tx_signature, amount_usdc });
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Deposit failed" });
  }
});

router.post("/api/vault/withdraw", async (req, res) => {
  try {
    const { wallet_address, cusdc_amount } = req.body;
    if (!wallet_address || !cusdc_amount) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }
    const result = await processWithdrawal({ wallet_address, cusdc_amount });
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Withdrawal failed" });
  }
});

export default router;
