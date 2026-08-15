import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { computeProgress, awardCertificates } from "../lib/level.js";

const router = Router();

// GET /api/progress/level
router.get("/progress/level", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const progress = await computeProgress(uid);
  // Auto-award certificates for completed levels
  const newCertificates = await awardCertificates(uid, progress.completedLevels);
  res.json({
    ...progress,
    newCertificates: newCertificates.map((c) => ({
      id: c.id,
      level: c.level,
      certificateNumber: c.certificateNumber,
      issuedAt: c.issuedAt.toISOString(),
    })),
  });
});

export default router;
