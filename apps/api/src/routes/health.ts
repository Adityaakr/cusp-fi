import { Router } from "express";

const router = Router();

router.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      dflow: !!process.env.DFLOW_API_KEY,
      supabase: !!process.env.SUPABASE_URL,
      solana: !!process.env.SOLANA_RPC_URL,
    },
  });
});

export default router;
