# Liquid Reporting

Standalone reporting frontend for the accounting-convergence prototype.

## Run

```bash
npm install
npm run dev
```

It runs on `http://localhost:3001` and links back to the core accounting application at `http://localhost:3000`.

For a hosted build, configure the core application URL at build time:

```bash
VITE_CORE_APP_URL=https://accounting.example.test npm run build
```

The URL must use `http` or `https`; invalid values fall back to the local development address. Configure `VITE_REPORTING_APP_URL` in the core repository separately.

## Reporting BFF

Run both the local Reporting BFF and frontend with the same local token. The Vite development proxy injects it server-side, so it is never exposed to browser code:

```bash
LIQUID_BFF_DEMO_TOKEN=replace-with-a-local-value npm run api
LIQUID_BFF_DEMO_TOKEN=replace-with-a-local-value npm run dev
```

The BFF runs on `http://127.0.0.1:4001`; the frontend calls it through same-origin `/api` routes.

The BFF has synthetic endpoints for:

- `GET /api/v1/organisation`
- `GET /api/v1/reports/profit-loss`
- `GET /api/v1/reports/cash-flow`

`/api/v1/organisation` intentionally duplicates the Core BFF contract (Linear LIQ-12). It is the first candidate the later SDK convergence workflow should identify and classify; report read models are intentionally retained as Reporting-specific for the pilot. Do not invent a shared BFF yet.

The organisation switcher and Profit & Loss headline consume the BFF. Remaining report visuals are intentionally static synthetic fixture data, so the migration workflow has both live contracts and existing presentation fixtures to classify.

The server binds to loopback only, requires a bearer token from `LIQUID_BFF_DEMO_TOKEN`, only allows the local Reporting app origin by default, rate limits requests, and returns no-store responses. It refuses to start outside development/test mode. It is a demo boundary, not a production authentication implementation.

## PostHog

Product analytics is optional and privacy-constrained. Copy `.env.example` to `.env.local` and set a project token (`phc_...`) plus an official PostHog host. If those values are missing or invalid, the app renders without analytics.

You can also run the interactive installer:

```bash
npx -y @posthog/wizard@latest
```

That wizard cannot be completed non-interactively here, so both apps also include a manual React SDK setup. Autocapture and session replay are off. Only allowlisted events leave the browser (`report_opened`, `bff_status`, plus PostHog pageview/pageleave). Financial amounts, organisation names, and other PII are not captured.

## Intentional migration seam

This repository has an independent report shell, report picker, chart components, and financial statement table.

The left nav now duplicates the canonical Accounting-core workspace shell:

- same Liquid logo assets, independently copied into this repository;
- the same Dashboard, New (Reporting) / Create (Core), Sales, Purchases, Banking, Contacts, and Reports items;
- Reports is the active page, with All reports, Business performance, and Financial statements nested underneath.
- Intentionally drifted seams for the demo narrative: nav label drift (LIQ-8), a11y/aria mismatch (LIQ-5/LIQ-6), renamed Revenue summary vs Core `#sales-summary` deep link (LIQ-9), and forked status `.chip` styles vs Core `.status` pills (LIQ-7).

It is designed to contrast with the canonical `Accounting-core` UI so the Cursor SDK convergence workflow can discover:

- a cross-origin Reports navigation boundary;
- a separate component and report-routing model;
- duplicated financial visualisation patterns;
- different report UI conventions that require a plan before migration.

## Why it's built this way

Decision records: [`docs/decisions/`](docs/decisions/README.md).
