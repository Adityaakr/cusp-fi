import { Router } from "express";
import qvacRouter from "./qvac.js";
import vaultRouter from "./vault.js";
import lendRouter from "./lend.js";
import borrowRouter from "./borrow.js";
import directTradeRouter from "./direct-trade.js";
import leverageTradeRouter from "./leverage-trade.js";
import dflowRouter from "./dflow.js";
import kalshiRouter from "./kalshi.js";
import riskRouter from "./risk.js";
import inviteRouter from "./invite.js";
import healthRouter from "./health.js";
import crankRouter from "./crank.js";
import outcomeLendingRouter from "./outcome-lending.js";

const router = Router();

router.use(qvacRouter);
router.use(vaultRouter);
router.use(lendRouter);
router.use(borrowRouter);
router.use(directTradeRouter);
router.use(leverageTradeRouter);
router.use(dflowRouter);
router.use(kalshiRouter);
router.use(riskRouter);
router.use(inviteRouter);
router.use(healthRouter);
router.use(crankRouter);
router.use(outcomeLendingRouter);

export default router;
