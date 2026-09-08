---
name: Native TypeScript tests
description: Constraints for lightweight regression tests in this workspace
---

Node 24's built-in test runner can execute focused TypeScript tests without adding a test framework, but direct source imports that traverse workspace package aliases or extensionless directory exports may fail before the test body runs.

**Why:** Keeping small concurrency tests independent of the database and workspace bundler makes them runnable in a clean checkout, while the production build and typecheck continue to validate the integrated modules.

**How to apply:** Put pure collaboration contracts and in-memory transport seams in dependency-light modules, and run them with `node --test` from the owning package.