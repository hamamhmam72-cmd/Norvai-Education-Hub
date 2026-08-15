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
