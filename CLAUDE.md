# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

"Feria" (package name `kropflow`) is a Next.js + Supabase app for tracking buying/reselling trips ("viajes"): a trader registers purchases, costs and sales for a trip, in multiple currencies, and gets a profit summary at the end.

## Commands

```bash
npm run dev              # start dev server (Turbopack)
npm run build             # production build
npm run lint               # eslint

node --test tests/*.test.mjs                 # run all unit tests (pure lib helpers)
node --test tests/divisas.test.mjs           # run a single unit test file

npx playwright test tests/feria-e2e.spec.js --project=chromium -g "Dashboard"   # e2e
```

E2e tests (`tests/feria-e2e.spec.js`) need `TEST_USER_EMAIL`/`TEST_USER_PASSWORD` in `.env.local` and hit a **live Supabase project** — `playwright.config.js` forces `workers: 1` because tests share that database and would conflict otherwise. If credentials aren't available, verify manually instead of skipping the check silently.

## Architecture

**Data layer:** Supabase (Postgres + RLS). `supabase/schema.sql` is the cumulative source of truth for the schema; `supabase/migrations/NNN_*.sql` are the incremental migrations that produced it — when changing the schema, write a new numbered migration, apply it via the `supabase` MCP server (configured in `.mcp.json`) or the Supabase dashboard, and reflect the result in `schema.sql`. Core tables: `viajes` (trips), `viaje_divisas` (per-trip currencies, seeded USD+Bs+COP by a DB trigger on trip creation), `compras`/`costos_adicionales`/`ventas` (purchases/costs/sales, each carrying a `divisa_id` into `viaje_divisas`), `productos` (user's product catalog).

**Trip phases, one at a time:** a trip moves through `preparacion → en_curso → ventas` (defined in `lib/viajeFases.mjs`, a pure/tested module — `FASES`, `FASE_META`, `faseIndex`, `avanceConfig`, `stepperState`). The detail page shows only the current phase's sections (no stepper you can click through) and derives what to render from `viaje.fase`/`viaje.estado`, not from local UI state. Advancing phase or closing the trip are the only transitions, both explicit user actions with a confirm step.

**Multi-currency:** every purchase/cost/sale is stored in the currency it was paid in (`divisa_id` → `viaje_divisas.tasa`, "units of that currency per 1 USD"). `lib/divisas.mjs` (pure/tested) holds the conversion math: `montoUsd(cantidad, precio, tasa)`, `costoFinalPorKg` (adds a per-kg transport surcharge), `ventaTotal` (uses a manually-entered total if present, else `cantidad × precio`). Always convert through these helpers rather than re-deriving the math inline — totals across the app (Resumen, per-phase mini-stats, tab totals) all key off them.

**`app/dashboard/viajes/[id]/page.js` is intentionally a large single file**: the phase indicator/summary and every phase's tab (`DivisasPanel`, `ComprasTab`, `CostosTab`, `VentasTab`, `ResumenTab`, `FaseStepper`, `useFaseResumen`) are co-located components in that one file, following the existing convention — don't split it apart unprompted. Cross-page reusable UI (used by both this page and `app/dashboard/inventario/page.js`) lives instead in `app/dashboard/_components/` (e.g. `ViewToggle`/`useViewPreference`, `ProductCard`) — that's the newer convention for anything shared across routes.

**Theme:** `app/globals.css` defines a "premium" green-accented theme (oklch, `--primary` ~`oklch(0.55 0.18 160)`) with a glassmorphism visual language (`backdrop-blur`, translucent `bg-card/60`, soft shadows, larger radii) — this replaced an earlier fully-neutral/monochrome theme, so don't assume zero-saturation colors when styling new UI. Font is Plus Jakarta Sans (`--font-sans`, loaded in `app/layout.js`).

**Per-product icons:** `ProductCard.js` maps a product's name to an icon via `getProductIcon()` — custom inline SVGs for a few products (tomato, onion, chili), `lucide-react` icons for general categories, and two icons rendered from PNG assets in `public/` (`lechuga.png`, `pimienta-alternativa.png`) masked with `currentColor` so they tint like the SVG icons. Add new products to `getProductIcon()`'s name-matching rather than inventing a separate icon path.

**Auth:** `context/AuthContext.js` wraps the app, holds the Supabase session + `profiles` row, and client-side redirects unauthenticated users away from any route not in its `PUBLIC_ROUTES` list — add new public routes there, not via middleware.

**Design docs:** `docs/superpowers/specs/` and `docs/superpowers/plans/` hold the design specs and implementation plans written before past features (brainstorming → writing-plans workflow). Check there for the rationale behind existing behavior before changing it — a spec usually explains *why*, not just *what*.

**`lib/webhooks.js`** (n8n integration for cash-closing) exists but is not currently wired into any page — don't assume it's live.
