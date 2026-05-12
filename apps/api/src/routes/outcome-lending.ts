import { Router } from "express";
import {
  closeOutcomeLoan,
  createOutcomeLoanFromCollateralTransfer,
  getMainnetPoolState,
  listOutcomeCollateralPositions,
  listWalletOutcomeHoldings,
  listOutcomeLoans,
  openOutcomeLoan,
  quoteOutcomeCollateral,
  registerMainnetPoolDeposit,
  registerOutcomeCollateralLot,
  resolveOutcomeMarketByMint,
  withdrawMainnetPoolLiquidity,
} from "../services/outcome-lending.service.js";

const router = Router();

router.get("/api/mainnet-pool/state", async (req, res) => {
  try {
    const wallet_address =
      typeof req.query.wallet_address === "string" ? req.query.wallet_address : undefined;
    const pool_slug =
      typeof req.query.pool_slug === "string" ? req.query.pool_slug : undefined;
    const result = await getMainnetPoolState({ wallet_address, pool_slug });
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Pool state fetch failed",
    });
  }
});

router.get("/api/outcome-loans", async (req, res) => {
  try {
    const wallet_address =
      typeof req.query.wallet_address === "string" ? req.query.wallet_address : "";
    const result = await listOutcomeLoans({ wallet_address });
    res.status(200).json({ success: true, loans: result });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Outcome loans fetch failed",
    });
  }
});

router.get("/api/outcome-collateral/positions", async (req, res) => {
  try {
    const wallet_address =
      typeof req.query.wallet_address === "string" ? req.query.wallet_address : "";
    const positions = await listOutcomeCollateralPositions({ wallet_address });
    res.status(200).json({ success: true, positions });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Outcome collateral positions fetch failed",
    });
  }
});

router.get("/api/wallet/outcome-holdings", async (req, res) => {
  try {
    const wallet_address =
      typeof req.query.wallet_address === "string" ? req.query.wallet_address : "";
    const holdings = await listWalletOutcomeHoldings(wallet_address);
    res.status(200).json({ success: true, holdings });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Outcome holdings fetch failed",
    });
  }
});

router.get("/api/outcome-collateral/by-mint/:mint", async (req, res) => {
  try {
    const mint = typeof req.params.mint === "string" ? req.params.mint : "";
    const result = await resolveOutcomeMarketByMint(mint);
    res.status(result.success ? 200 : 502).json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      found: false,
      market: null,
      error: err instanceof Error ? err.message : "Outcome market lookup failed",
    });
  }
});

router.post("/api/mainnet-pool/deposit", async (req, res) => {
  try {
    const { wallet_address, tx_signature, amount_usdc, pool_slug } = req.body;
    console.info("[api][mainnet-pool][deposit] request", {
      wallet_address,
      tx_signature,
      amount_usdc,
      pool_slug,
    });
    const result = await registerMainnetPoolDeposit({
      wallet_address,
      tx_signature,
      amount_usdc,
      pool_slug,
    });
    console.info("[api][mainnet-pool][deposit] response", result);
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    console.error("[api][mainnet-pool][deposit] failed", {
      error: err instanceof Error ? err.message : err,
    });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Mainnet pool deposit failed",
    });
  }
});

router.post("/api/mainnet-pool/withdraw", async (req, res) => {
  try {
    const { wallet_address, amount_usdc, pool_slug } = req.body;
    const result = await withdrawMainnetPoolLiquidity({
      wallet_address,
      amount_usdc,
      pool_slug,
    });
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Mainnet pool withdraw failed",
    });
  }
});

router.post("/api/outcome-collateral/quote", async (req, res) => {
  try {
    const { market_ticker, outcome_mint, side, quantity, pool_slug } = req.body;
    const result = await quoteOutcomeCollateral({
      market_ticker,
      outcome_mint,
      side,
      quantity,
      pool_slug,
    });
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Collateral quote failed",
    });
  }
});

router.post("/api/outcome-collateral/deposit", async (req, res) => {
  try {
    const {
      wallet_address,
      tx_signature,
      market_ticker,
      outcome_mint,
      side,
      quantity,
      escrow_token_account,
      pool_slug,
    } = req.body;
    const result = await registerOutcomeCollateralLot({
      wallet_address,
      tx_signature,
      market_ticker,
      outcome_mint,
      side,
      quantity,
      escrow_token_account,
      pool_slug,
    });
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Collateral deposit failed",
    });
  }
});

router.post("/api/outcome-loans/open", async (req, res) => {
  try {
    const {
      wallet_address,
      collateral_lot_id,
      requested_borrow_usdc,
      pool_slug,
      interest_bps,
      expiry_hours,
    } = req.body;
    const result = await openOutcomeLoan({
      wallet_address,
      collateral_lot_id,
      requested_borrow_usdc,
      pool_slug,
      interest_bps,
      expiry_hours,
    });
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Outcome loan open failed",
    });
  }
});

router.post("/api/outcome-loans/create", async (req, res) => {
  try {
    const {
      wallet_address,
      tx_signature,
      market_ticker,
      outcome_mint,
      side,
      quantity,
      requested_borrow_usdc,
      escrow_token_account,
      pool_slug,
      interest_bps,
      expiry_hours,
    } = req.body;
    const result = await createOutcomeLoanFromCollateralTransfer({
      wallet_address,
      tx_signature,
      market_ticker,
      outcome_mint,
      side,
      quantity,
      requested_borrow_usdc,
      escrow_token_account,
      pool_slug,
      interest_bps,
      expiry_hours,
    });
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Outcome loan create failed",
    });
  }
});

router.post("/api/outcome-loans/close", async (req, res) => {
  try {
    const { wallet_address, loan_id, repay_tx_signature } = req.body;
    const result = await closeOutcomeLoan({
      wallet_address,
      loan_id,
      repay_tx_signature,
    });
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Outcome loan close failed",
    });
  }
});

export default router;
