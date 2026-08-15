---
name: Norv_ai Stack & Architecture
description: Full-stack AI learning platform — auth, DB, API, frontend, AI integration decisions
---

# Norv_ai Architecture

**Why:** Durable decisions and wiring details that are non-obvious from reading the code alone.

## Auth
- JWT stored in localStorage as `norv_token`, 30-day expiry
- `SESSION_SECRET` env var used for signing (falls back to hardcoded dev key)
- `lib/api-client-react/src/custom-fetch.ts` already reads `norv_token` from localStorage and sets `Authorization: Bearer` header — the `_authTokenGetter` default is wired in module scope
- `bcryptjs` (not `bcrypt`) is used — bcrypt native module is in esbuild externals list

## DB Schema Tables
users, curricula, lectures, saved_lectures, completed_lectures, conversations (with userId), messages, summaries, debug_sessions, quizzes, quiz_attempts, subscription_requests

**Conversations table gotcha:** The Gemini template creates a bare `conversations` table without `userId`. We overrode it with `conversationsTable` (userId added) and kept `conversations` as an alias.

## API Routes (all under /api/)
auth/register, auth/login, auth/logout, auth/me, profile/setup, profile (PUT), profile/change-password, dashboard/stats, dashboard/recent-activity, dashboard/recommended-lectures, lectures CRUD + save/unsave/complete, curricula CRUD, chat/sessions CRUD + messages (SSE streaming), summaries CRUD, debug/analyze + sessions, quiz/generate + CRUD + submit + attempts, career, subscriptions/status + request, admin/subscriptions CRUD, admin/users, admin/stats

## Seed Accounts
- admin / admin123
- demo_student / student123

## AI Provider
- **OpenAI** via `OPENAI_API_KEY` secret (user's own key, not Replit-managed)
- Client initialized in `artifacts/api-server/src/lib/openai.ts`
- Model: `gpt-4o-mini` for all features
- Chat: streaming via `openai.chat.completions.create({ stream: true })`, system prompt sets Monk persona
- Summary / Debug / Quiz / Career: `response_format: { type: "json_object" }` for reliable JSON output

## How to apply
When extending the API: import from `@workspace/integrations-gemini-ai` for the AI client. Use `requireAuth` or `requireAdmin` middleware from `artifacts/api-server/src/middleware/auth.ts`.

## Access Gate / Paywall (added Aug 2026)
- Core learning routes (/dashboard, /lectures, /curricula, /chat, /summary, /debug, /quizzes, /career, /progress) are gated server-side via `requireActiveAccess` middleware in routes/index.ts — passes for admins, active non-expired subscriptions, or `users.access_activated=true`
- Free activation code "Norv.ai.h52" checked server-side in routes/access.ts (timing-safe compare, per-user in-memory rate limit); user explicitly specified this code in plaintext
- Frontend AccessGate (components/AccessGate.tsx) mirrors the gate; /profile, /subscription, /feedback stay ungated so users can pay/activate
- **Gotcha:** /upload must stay ungated — subscription receipt upload happens pre-activation

## Levels & Certificates
- Points formula in api-server/src/lib/level.ts; thresholds beginner 0 / intermediate 50 / advanced 150 / expert 300
- A level is "completed" when the next level is reached; expert counts as completed on reach (else unattainable)
- Certificates auto-awarded on GET /progress/level; unique(userId, level) + onConflictDoNothing prevents concurrent duplicates
- Certificate PNGs are drawn client-side on a canvas (CertificatesSection.tsx) — intentionally English/LTR as formal documents

## Bug patterns learned
- shadcn Form: bare FormLabel/FormControl/FormItem OUTSIDE a FormField render prop crashes the whole page with "useFormField should be used within <FormField>" — use plain label/div for non-form-bound fields
- OpenAPI spec is source of truth for HTTP methods: spec said PATCH /profile while server had PUT → generated client 404'd. Always match server method to spec
- Orval zod codegen: component schema names must not collide with generated per-operation names like `<operationId>Response`
- RTL: shadcn Sidebar takes side={isRTL ? "right" : "left"}; use logical Tailwind utilities (ms-/me-/start-/end-) not ml-/mr-
