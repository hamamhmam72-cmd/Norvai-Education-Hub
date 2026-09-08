---
name: Team realtime test lifecycle
description: Lifecycle constraints for database-backed Team WebSocket integration tests.
---

Team realtime PostgreSQL listener cleanup must be idempotent because server shutdown and the listener client's `end` event can both attempt to release the same pooled client.

**Why:** Integration tests that attach the real WebSocket listener otherwise fail during teardown with a double-release error, masking the assertions and leaving test fixtures behind.

**How to apply:** Use one guarded release path for pub/sub clients, terminate test WebSockets before server teardown, and scope database fixtures with unique identifiers plus explicit cleanup.