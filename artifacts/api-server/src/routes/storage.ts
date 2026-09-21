// @ts-nocheck
import { randomUUID } from "node:crypto";
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const SIDEcar = "http://127.0.0.1:1106";

async function signObject(method: "PUT" | "GET", objectId: string, ttlMinutes: number) {
  const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
  const fullPath = `${privateDir.replace(/\/$/, "")}/uploads/${objectId}`;
  const parts = fullPath.split("/");
  const response = await fetch(`${SIDEcar}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: parts[1],
      object_name: parts.slice(2).join("/"),
      method,
      expires_at: new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString(),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`sidecar returned ${response.status}`);
  const { signed_url: signedUrl } = await response.json() as { signed_url?: string };
  if (!signedUrl) throw new Error("No signed URL returned");
  return signedUrl;
}

router.post("/storage/uploads/request-url", requireAuth, async (req, res): Promise<void> => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 180) : "";
  const size = Number(req.body?.size);
  const contentType = typeof req.body?.contentType === "string" ? req.body.contentType.slice(0, 120) : "";
  const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
  const allowedTypes = new Set([
    "image/png", "image/jpeg", "image/webp", "application/pdf",
    "audio/mpeg", "audio/mp4", "audio/wav", "audio/webm", "audio/ogg",
  ]);
  if (!name || !Number.isSafeInteger(size) || size < 1 || size > 25 * 1024 * 1024 || !allowedTypes.has(contentType) || !privateDir.startsWith("/")) {
    res.status(400).json({ error: "Invalid file metadata" });
    return;
  }
  const objectId = randomUUID();
  try {
    const uploadURL = await signObject("PUT", objectId, 15);
    res.json({ uploadURL, objectPath: `/objects/${objectId}`, metadata: { name, size, contentType } });
  } catch (error) {
    req.log?.error?.({ err: error, userId: req.user!.userId }, "Object upload URL failed");
    res.status(503).json({ error: "File storage is temporarily unavailable" });
  }
});

router.get("/storage/objects/:id/url", requireAuth, async (req, res): Promise<void> => {
  const objectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!/^[0-9a-f-]{36}$/i.test(objectId)) {
    res.status(400).json({ error: "Invalid object id" });
    return;
  }
  try {
    res.json({ url: await signObject("GET", objectId, 5) });
  } catch (error) {
    req.log?.error?.({ err: error, userId: req.user!.userId }, "Object download URL failed");
    res.status(503).json({ error: "File storage is temporarily unavailable" });
  }
});

export default router;
