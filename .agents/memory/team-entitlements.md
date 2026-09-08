---
name: Team entitlement boundary
description: Authorization rules for Norv collaborative Team features.
---

Collaborative project creation, member management, chat, image attachments, and shared code are Team-tier entitlements. Every Team resource action must verify the subscription on the server and then verify project membership and role; hiding controls in the frontend is never sufficient.

**Why:** Individual and Team plans have different prices and capabilities. Project data may contain private team conversations and source code, so a valid login alone must not grant access.

**How to apply:** Require an active Team subscription for Team endpoints. Require project membership for reads and messages, and owner/editor permission for mutations; admins may retain an explicit operational override.