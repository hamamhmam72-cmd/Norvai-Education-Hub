import { Router } from "express";
import { db } from "@workspace/db";
import { certificatesTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/certificates
router.get("/certificates", requireAuth, async (req, res) => {
  const certs = await db
    .select()
    .from(certificatesTable)
    .where(eq(certificatesTable.userId, req.user!.userId))
    .orderBy(desc(certificatesTable.issuedAt));
  res.json(
    certs.map((c) => ({
      id: c.id,
      level: c.level,
      certificateNumber: c.certificateNumber,
      studentName: c.studentName,
      issuedAt: c.issuedAt.toISOString(),
    }))
  );
});

export default router;
