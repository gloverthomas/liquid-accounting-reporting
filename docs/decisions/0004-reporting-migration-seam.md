# 0004 — Reporting stays a separate app until the planned migration

- **Status:** Accepted · recorded 2026-09-26

## Context

Reporting grew as a separate app. The end state is one canonical product (Core), but the migration should be planned, bounded and proven, with the Cursor SDK workflow as the planner.

## Decision

- Reporting keeps an independent report shell, report picker, chart components and statement table, and a left nav that duplicates Core's workspace shell.
- Some drift was **intentional** so the convergence workflow had real differences to find: nav label drift (LIQ-8), a11y/aria mismatch (LIQ-5/LIQ-6), the Revenue summary vs Core `#sales-summary` deep link (LIQ-9), and forked status `.chip` styles vs Core `.status` pills (LIQ-7). **Update 26 Sep 2026:** those visible gaps are fixed, and parity is now asserted by `e2e/shell-parity.spec.ts`, `e2e/deep-links.spec.ts`, `e2e/status-pills.spec.ts` and Core's cross-repo parity suite. The structural seam (separate shell, report model and BFF) remains until the migration.
- The Cursor SDK workflow is expected to discover these seams and plan a migration into Core, not a big-bang rewrite.

## Consequences

- New demo defects should get their own ticket and be documented here, so nobody "fixes" a deliberate gap by accident.
- UI fixes need parity proof across both apps (Playwright parity and help-proof jobs).

## Alternatives considered

- **Rewrite Reporting inside Core in one go** — rejected: high risk, and it hides which contracts really differ.

## Where it lives

README "Intentional migration seam", Linear LIQ-5 to LIQ-9, LIQ-12.
