import { Router } from "express";
import { verifyInviteCode } from "../middleware/auth.js";

const router = Router();

router.post("/api/verify-invite", async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      res.status(400).json({ valid: false, error: "Invite code required" });
      return;
    }
    const result = await verifyInviteCode(code);
    res.status(result.valid ? 200 : 400).json(result);
  } catch (err) {
    res.status(500).json({ valid: false, error: "Verification failed" });
  }
});

export default router;
