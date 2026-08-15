import { Router } from "express";
import { db } from "@workspace/db";
import { conversationsTable, messagesTable } from "@workspace/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/chat/sessions
router.get("/chat/sessions", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const sessions = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.userId, uid));
  res.json(
    sessions.map((s) => ({
      id: s.id,
      title: s.title,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }))
  );
});

// POST /api/chat/sessions
router.post("/chat/sessions", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const { title } = req.body;
  const [session] = await db
    .insert(conversationsTable)
    .values({ userId: uid, title: title ?? "New Chat" })
    .returning();
  res.status(201).json({
    id: session.id,
    title: session.title,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  });
});

// DELETE /api/chat/sessions/:id
router.delete("/chat/sessions/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const uid = req.user!.userId;
  await db
    .delete(conversationsTable)
    .where(and(eq(conversationsTable.id, id), eq(conversationsTable.userId, uid)));
  res.status(204).send();
});

// GET /api/chat/sessions/:id/messages
router.get("/chat/sessions/:id/messages", requireAuth, async (req, res) => {
  const sessionId = Number(req.params.id);
  const uid = req.user!.userId;
  const [session] = await db
    .select()
    .from(conversationsTable)
    .where(and(eq(conversationsTable.id, sessionId), eq(conversationsTable.userId, uid)))
    .limit(1);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const msgs = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, sessionId))
    .orderBy(asc(messagesTable.createdAt));
  res.json(
    msgs.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    }))
  );
});

// POST /api/chat/sessions/:id/messages (streaming)
router.post("/chat/sessions/:id/messages", requireAuth, async (req, res) => {
  const sessionId = Number(req.params.id);
  const uid = req.user!.userId;
  const { content } = req.body;

  const [session] = await db
    .select()
    .from(conversationsTable)
    .where(and(eq(conversationsTable.id, sessionId), eq(conversationsTable.userId, uid)))
    .limit(1);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  // Save user message
  await db.insert(messagesTable).values({
    conversationId: sessionId,
    role: "user",
    content,
  });

  // Auto-update title if first message
  if (session.title === "New Chat") {
    await db
      .update(conversationsTable)
      .set({ title: content.slice(0, 60) })
      .where(eq(conversationsTable.id, sessionId));
  }

  // Load history
  const history = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, sessionId))
    .orderBy(asc(messagesTable.createdAt));

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";
  try {
    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: history.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      config: {
        maxOutputTokens: 8192,
        systemInstruction:
          "You are Monk, an AI study assistant for IT and Software Engineering students. You help with programming concepts, debugging, algorithms, system design, and all technical topics. Be concise, precise, and educational. Use code blocks where appropriate.",
      },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }

    // Save assistant response
    await db.insert(messagesTable).values({
      conversationId: sessionId,
      role: "assistant",
      content: fullResponse,
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: "AI generation failed" })}\n\n`);
  }
  res.end();
});

export default router;
