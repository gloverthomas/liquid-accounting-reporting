# 0004 — Reporting stays a separate app until the planned migration

- **Status:** Accepted · recorded 2026-09-26

## Context

Reporting grew as a separate app. The end state is one canonical product (Core), but the migration should be planned, bounded and proven, with the Cursor SDK workflow as the planner.

## Decision

- Reporting keeps an independent report shell, report picker, chart components and statement table, and a left nav that duplicates Core's workspace shell.
- Some drift is **intentional** so the convergence workflow has real differences to find: nav label drift (LIQ-8), a11y/aria mismatch (LIQ-5/LIQ-6), the Revenue summary vs Core `#sales-summary` deep link (LIQ-9), and forked status `.chip` styles vs Core `.status` pills (LIQ-7).
- The Cursor SDK workflow is expected to discover these seams and plan a migration into Core, not a big-bang rewrite.

## Consequences

- Some differences between Core and Reporting are known and deliberate. Check the ticket before "fixing" drift, since it may be a planned migration item.
- UI fixes need parity proof across both apps (Playwright parity and help-proof jobs).

## Alternatives considered

- **Rewrite Reporting inside Core in one go** — rejected: high risk, and it hides which contracts really differ.

## Where it lives

README "Intentional migration seam", Linear LIQ-5 to LIQ-9, LIQ-12.
