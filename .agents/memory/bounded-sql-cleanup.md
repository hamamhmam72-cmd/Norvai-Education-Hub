---
name: Bounded SQL cleanup
description: Avoid accidental unbounded deletes when Drizzle interpolates table-qualified columns inside PostgreSQL CTE subqueries.
---

For bounded cleanup CTEs, make the CTE output column resolve from the CTE itself in the final subquery. Do not interpolate a table-qualified source column inside `SELECT ... FROM <cte>` when the same source table is the outer DELETE target.

**Why:** PostgreSQL can interpret that qualified reference as a correlated reference to the outer DELETE row. If the CTE contains any row, the predicate then matches every target row and defeats the LIMIT.

**How to apply:** Test bounded deletes with more expired rows than the batch size and assert the exact remaining count, not merely that some rows were removed.