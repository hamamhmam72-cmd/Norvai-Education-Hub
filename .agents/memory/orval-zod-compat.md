---
name: Orval Zod Codegen Compatibility
description: Orval v8 generates zod.int() which is Zod v4 only; fix for Zod v3 workspaces
---

# Orval + Zod v3 Compatibility

**Why:** Orval v8.23.0 generates `zod.int()` for OpenAPI `type: integer` fields. `zod.int()` is a Zod v4 API — it doesn't exist in Zod v3, causing codegen to produce broken output.

**Fix:** Change all `type: integer` fields in `lib/api-spec/openapi.yaml` to `type: number`. Orval then generates `zod.number()` which works in both Zod v3 and v4.

**How to apply:** Any time integer fields are added to the OpenAPI spec in this workspace, use `type: number` instead of `type: integer`. The DB schema can still use Drizzle's `integer()` column type — this only affects the OpenAPI spec / generated Zod validators.

```bash
# Quick fix command:
sed -i 's/type: integer/type: number/g' lib/api-spec/openapi.yaml
```
