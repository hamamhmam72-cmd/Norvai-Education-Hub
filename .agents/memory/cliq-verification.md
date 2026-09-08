---
name: CliQ verification boundary
description: The subscription flow separates receipt submission from bank settlement confirmation.
---

Receipts remain review evidence only; access is activated automatically only when an authenticated official settlement webhook reports a matching pending reference, plan amount, and settled status.

**Why:** An image can be forged or uploaded before funds arrive, so treating it as payment confirmation would grant unauthorized access.

**How to apply:** Keep provider-specific bank credentials in Replit Secrets and adapt the webhook payload at the integration boundary; never activate from OCR or client-submitted receipt data alone.