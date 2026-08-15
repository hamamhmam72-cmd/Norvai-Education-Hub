---
name: Gemini Integration esbuild Config
description: @google/genai must NOT be in esbuild externals — bundle it directly
---

# Gemini AI Integration + esbuild

**Why:** The api-server `build.mjs` has `@google/*` in the esbuild `external` array by default. When `@google/genai` is externalized, Node.js cannot find it at runtime because it lives in a workspace lib package, not directly in api-server's node_modules in a way that's resolvable from the dist output.

**Fix:** Remove `@google/*` (and `@google-cloud/*` is fine to keep) from the externals list in `artifacts/api-server/build.mjs`. The `protobufjs` entry stays external — it's listed separately and that's correct.

**How to apply:** Whenever `@workspace/integrations-gemini-ai` is added as a dependency to any artifact's API server, verify `@google/*` is NOT in the esbuild externals list for that artifact.
