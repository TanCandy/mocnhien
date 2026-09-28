# Production Readiness Plan — mocnhien (Mộc Nhiên Authentic)

**Repo:** `TanCandy/mocnhien` (GitHub, no issues/PRs, no `.github/workflows` currently)
**Stack:** React 19 + Vite 6 + TypeScript + Tailwind 4 (SPA) served by a single Express 5 + Mongoose 9 API. JWT auth in an httpOnly cookie. Docker multi-stage build (`Dockerfile`) + `docker-compose.yml`. No test framework, no CI/CD, no ESLint/Prettier today.
**Deploy target assumption:** Railway (inferred from comments in `backend/server.js` referencing "Railway firewall"). If this is wrong, re-point the CORS/health/env sections at the actual platform — everything else still applies.

This document is the single source of truth for hardening this repo and shipping it to production. It is written to be executed by an AI coding agent, one task at a time.

---

## Rules for the implementing agent

1. **Work P0 first, in order, one task at a time.** Do not start P1 until every P0 task's acceptance criteria pass.
2. **Smallest safe diff per task.** One task = one focused change, not a drive-by refactor.
3. **Do not invent a rewrite of the app.** No new frameworks, no swapping Express/Mongoose/React out, no restructuring the repo layout beyond what a task explicitly calls for.
4. **Never leave behind:** hardcoded secrets, hardcoded webhook URLs, an open/wildcard CORS policy, or a JWT secret fallback. If you find another instance of any of these while working, fix it or flag it — do not add a new one.
5. **After every P0 change**, do a manual regression pass before moving on: **login, register, forgot/reset password, order CRUD/approval, tracking, quotes, admin nav.** Use `mongodb-memory-server` for a disposable local DB if no dev DB is available (`npm install --no-save mongodb-memory-server` in `backend/`).
6. **Prefer existing patterns in the repo.** Match the style of `backend/config/env.js`, `backend/middleware/*.js`, existing controllers. Don't introduce a second validation library, a second logger, etc. if one is already chosen in this doc.
7. **Every new env var must be added to `backend/.env.example`** in the same commit/change that introduces it, with a short comment.
8. **Never commit a real `.env` file.** `.env*` is gitignored except `.env.example` — keep it that way.
9. **Flag risky changes and require staging verification** before they touch prod. Specifically: the CORS allowlist change (P0-1) and the `npm audit fix` upgrades (P0-4, especially `react-router`) — these can break real user flows if misconfigured or if the patched major version changed behavior. Do not push these straight to prod without a staging pass.

### Definition of done for this document
Every P0 checkbox is checked, verified via its "How to verify" steps, and regression-tested per Rule 5. P1 items are tracked but do not block calling P0 "shipped."

---

## Current architecture snapshot

- One Express app (`backend/server.js`) serves both the JSON API (`/api/*`) and the built SPA (static files from `dist/`, with an SPA-fallback route) — single deployable unit.
- Routes mounted in `backend/routes/index.js`: `/api/auth`, `/api/me`, `/api/orders`, `/api/quotes`, `/api/dashboard`, `/api/user`, plus legacy top-level aliases `/forgot-password` and `/reset-password`.
- Auth: JWT issued on login/register, stored in an httpOnly cookie (also accepted via `Authorization: Bearer`). `backend/middleware/authMiddleware.js` re-fetches the user from MongoDB on **every** request and attaches the live `role` to `req.user` — backend authorization is always fresh, not JWT-stale.
- The only role-staleness issue is client-side: `src/components/AdminRoute.tsx` decodes `role` directly from the JWT for nav-gating, while `src/context/UserContext.tsx` fetches the live role from `/api/user/profile`. This is a UX inconsistency, not a privilege-escalation bug (backend still enforces the real role).
- Data: `backend/models/User.js`, `backend/models/Order.js`. `Order` has legacy/duplicate fields left over from past migrations (`address` vs structured address fields, `trackingId` vs `tracking_code` vs `uspsTracking`, `total_price` vs `totalUSD`/`totalVND`).
- Integrations: Resend (transactional email, password reset) and a hardcoded Google Apps Script webhook URL in `backend/controllers/orderController.js` for syncing orders to a Google Sheet.
- Dead code: root-level `middleware.ts` is a Next.js App Router middleware template (`import ... from "next/server"`). This project has no Next.js dependency — Vite/Express never executes this file.

---

## Already-fixed items — do not re-do these

These were fixed and live-verified in-browser in a prior session. Confirm they're still in place; do not duplicate the work.

- `src/pages/AdminOrders.tsx` — removed duplicate `totalVND` field from the `Order` interface.
- `src/pages/AdminOrders.tsx` — Payment Status `<select>` `onChange` now uses the functional `setFormData((prev) => ({ ...prev, paymentStatus: e.target.value }))` form (previously crashed with `ReferenceError: prev is not defined`).
- `src/pages/AdminOrders.tsx` — order-creation exchange-rate validation now only requires a rate when `priceUSD > 0`, matching backend's `adminCreateOrder` logic.
- `src/pages/Tracking.tsx` — `useRef<ReturnType<typeof setTimeout> | undefined>(undefined)` (previously a TS compile error from calling `useRef()` with no argument).
- `vite.config.ts` — `@types/node` added to root `devDependencies` to fix missing `path`/`__dirname` types.

---

## P0 — Must fix before any production traffic

- [x] **P0-1: CORS accepts every origin**
  - **Problem:** In `backend/server.js` (around lines 40-51), the CORS origin callback's `else` branch calls `callback(null, true)` unconditionally, accepting any origin regardless of the `allowedOrigins` allowlist, combined with `credentials: true`. This defeats the allowlist and is a CSRF/cross-origin credential-theft surface given cookie-based auth.
  - **Files to touch:** `backend/server.js`, `backend/.env.example`.
  - **Exact change:**
    ```js
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    app.use(cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }));
    ```
    Add to `backend/.env.example`:
    ```
    # Comma-separated list of origins allowed to call this API with credentials
    ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
    ```
    Set the real prod frontend origin(s) in the prod environment's `ALLOWED_ORIGINS`.
  - **How to verify:** From the actual frontend origin, confirm login/API calls still work (check browser Network tab for CORS errors). From an arbitrary origin (e.g., `curl -H "Origin: https://evil.example" -I <api-url>/api/user/profile`), confirm the response does NOT include `Access-Control-Allow-Origin: https://evil.example`.
  - **⚠️ Risky change — requires staging verification** before prod. A misconfigured `ALLOWED_ORIGINS` will lock out the real frontend.

- [x] **P0-2: JWT_SECRET silently falls back to a hardcoded value**
  - **Problem:** `backend/server.js` (around lines 104-107) logs a warning if `JWT_SECRET` is unset, then sets `process.env.JWT_SECRET = "dev-only-insecure-fallback-secret"` and continues running. `backend/config/env.js` already has a `required(name)` helper that throws — it is never called for `JWT_SECRET`.
  - **Files to touch:** `backend/server.js`, `backend/config/env.js`.
  - **Exact change:** In `backend/config/env.js`, change `JWT_SECRET: process.env.JWT_SECRET,` to `JWT_SECRET: required("JWT_SECRET"),`. Remove the fallback block in `backend/server.js` (lines ~104-107) entirely — if `JWT_SECRET` is missing, requiring `./config/env` at the top of `server.js` will already throw and crash the process on boot, which is the desired behavior in every environment (dev included — use a real `.env` locally).
  - **How to verify:** Start the server with `JWT_SECRET` unset — process must exit with an error, not start listening. Start it with `JWT_SECRET` set — starts normally, login/register issue valid tokens.
  - **Note:** Rotate the real prod `JWT_SECRET` now, since it may have been running on the hardcoded fallback value at some point if it was ever unset in that environment.

- [x] **P0-3: No rate limiting on auth endpoints**
  - **Problem:** No `express-rate-limit` (or equivalent) exists in `backend/package.json`. `/api/auth/login`, `/api/auth/register`, `/forgot-password`, `/reset-password` are fully unthrottled — brute-force, credential-stuffing, and unlimited password-reset-email sending (cost/abuse on Resend) are all possible today.
  - **Files to touch:** `backend/package.json`, a new `backend/middleware/rateLimiter.js`, `backend/routes/authRoutes.js`, `backend/routes/index.js` (for the two legacy top-level aliases).
  - **Exact change:**
    ```bash
    cd backend && npm install express-rate-limit
    ```
    Create `backend/middleware/rateLimiter.js`:
    ```js
    const rateLimit = require("express-rate-limit");

    const authRateLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 10,
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: "Too many attempts, please try again later." },
    });

    module.exports = { authRateLimiter };
    ```
    Apply `authRateLimiter` to the login, register, forgot-password, and reset-password routes in `backend/routes/authRoutes.js`, and to the two legacy aliases in `backend/routes/index.js` (`/forgot-password`, `/reset-password`).
  - **How to verify:** Send 11+ rapid requests to `/api/auth/login` from the same IP within 15 minutes — the 11th+ should return 429 with the configured message. Normal single-attempt login still succeeds.

- [x] **P0-4: HIGH-severity dependency vulnerabilities**
  - **Problem:** `npm audit` (run at repo root and in `backend/`) reports:
    - Frontend: **react-router 7.x — HIGH** (arbitrary constructor invocation via vendored `turbo-stream` deserialization → unauth RCE; open redirect; CSRF via PUT/PATCH/DELETE; DoS via inefficient route matching / unbounded path expansion), plus moderate `qs` issues.
    - Backend: **path-to-regexp 8.x — HIGH** (ReDoS via sequential optional groups / multiple wildcards), **form-data — HIGH** (CRLF injection via unescaped multipart field/filenames), **mongoose 9.x — MODERATE** (prototype pollution via `__proto__`-prefixed dotted paths in update casting), plus `qs` DoS.
  - **Files to touch:** root `package.json` / `package-lock.json`, `backend/package.json` / `backend/package-lock.json`.
  - **Exact change:**
    ```bash
    npm audit fix
    cd backend && npm audit fix
    ```
    Then re-run `npm audit` in both locations and confirm 0 high/critical remain. If `npm audit fix` alone doesn't clear a high-severity issue, evaluate `npm audit fix --force` for that specific package only, understanding it may bump a major version.
  - **How to verify:** `npm audit --audit-level=high` (root and `backend/`) exits clean. Then run the **full manual regression pass** (Rule 5) — react-router's patched version in particular can change route-matching/loader behavior, so click through every route: home, login, register, forgot/reset password, tracking, quotes, order list/detail, admin order create/edit/approve, admin nav.
  - **⚠️ Risky change — requires staging verification.** Do not push straight to prod.

- [x] **P0-5: Health check reports healthy even when the database is down**
  - **Problem:** `backend/server.js` starts `app.listen` before the DB connects (`connectDatabase()` runs after, catching its own errors and just logging), and `/health` (lines ~69-71) unconditionally returns `{ ok: true }` regardless of DB state. An orchestrator/load balancer sees a "healthy" container that 500s on every DB-backed request.
  - **Files to touch:** `backend/server.js`.
  - **Exact change:**
    ```js
    const mongoose = require("mongoose");

    app.get("/health", (req, res) => {
      const dbConnected = mongoose.connection.readyState === 1;
      if (!dbConnected) {
        return res.status(503).json({ ok: false, db: "disconnected", timestamp: new Date().toISOString() });
      }
      res.json({ ok: true, db: "connected", timestamp: new Date().toISOString() });
    });
    ```
    Keep `/` as-is (pure liveness ping, no DB check) so basic process liveness can still be distinguished from DB readiness if needed.
  - **How to verify:** With Mongo reachable, `GET /health` returns 200 `{ ok: true, db: "connected", ... }`. Stop/block Mongo access and confirm `GET /health` returns 503 `{ ok: false, db: "disconnected", ... }`. Update the platform's health-check config (Railway or equivalent) to treat non-200 as unhealthy if it doesn't already.

- [x] **P0-6: Hardcoded Google Sheets webhook URL in source**
  - **Problem:** `backend/controllers/orderController.js` has a `WEBHOOK_URL` constant with a literal Google Apps Script URL embedded in source — requires a code change + redeploy to rotate, and it's exposed in version control.
  - **Files to touch:** `backend/controllers/orderController.js`, `backend/.env.example`, `backend/config/env.js`.
  - **Exact change:** In `backend/config/env.js`, add `WEBHOOK_URL: process.env.WEBHOOK_URL || "",` to the `env` object. In `orderController.js`, replace the hardcoded `WEBHOOK_URL` constant with `const { env } = require("../config/env"); ... env.WEBHOOK_URL` at its usage site inside `syncOrderToGoogleSheets` (or equivalent). If `WEBHOOK_URL` is empty, skip the sync call and log a warning instead of throwing. Add to `backend/.env.example`:
    ```
    # Google Apps Script webhook URL for syncing orders to Google Sheets
    WEBHOOK_URL=
    ```
    Set the real value in the prod environment only (not in source).
  - **How to verify:** With `WEBHOOK_URL` set, creating/approving an order still triggers the Google Sheets sync as before. With `WEBHOOK_URL` unset, order operations still succeed and a warning is logged instead of a crash. `grep -r "script.google.com" backend/` returns no hardcoded URLs.

- [x] **P0-7: No security headers (helmet/CSP)**
  - **Problem:** No `helmet` dependency exists in `backend/package.json`. No CSP, `X-Content-Type-Options`, `Strict-Transport-Security`, etc. are set on any response.
  - **Files to touch:** `backend/package.json`, `backend/server.js`.
  - **Exact change:**
    ```bash
    cd backend && npm install helmet
    ```
    In `backend/server.js`, near the top of the middleware stack (before or right after the CORS middleware):
    ```js
    const helmet = require("helmet");
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
        },
      },
    }));
    ```
    Adjust `connectSrc`/`imgSrc` if the frontend calls any external API or loads images from another origin — check `src/lib/api.ts` and any `<img src=...>` usage pointing off-origin before finalizing the CSP. Enable HSTS (`helmet` includes it by default) only once HTTPS is confirmed at the edge (Railway/CDN) for every environment this runs in.
  - **How to verify:** `curl -I <api-url>/health` shows `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, and related headers. Load the frontend in a browser and confirm no CSP violations appear in the console for legitimate app functionality (scripts, styles, images, API calls all still load).

---

## P1 — Should fix before/soon after go-live

- [x] **P1-1: No input validation layer**
  - **Problem:** No `zod`/`joi`/`express-validator` in either `package.json`. Validation is ad hoc inline logic scattered through controllers (e.g., `backend/controllers/authController.js`, `backend/controllers/orderController.js`). This also widens the practical exposure of the mongoose prototype-pollution CVE (P0-4) since unvalidated keys can reach `.update()` calls.
  - **Files to touch:** `backend/package.json`, new `backend/validation/` directory, `backend/controllers/authController.js`, `backend/controllers/orderController.js`.
  - **Exact change:** `cd backend && npm install zod`. Add schemas for: register (`name`, `email`, `password`, `phoneNumber`, `primaryAddress` — match `backend/models/User.js` required fields), login (`email`, `password`), `adminCreateOrder`/`adminUpdateOrder` (whitelist exactly the fields in `backend/models/Order.js`), and quote requests. Validate at the top of each controller function; return 400 with the validation error message on failure, matching the existing error response shape used elsewhere (see `backend/middleware/errorHandler.js`'s `{ message }` shape).
  - **How to verify:** Submitting a register/login/order request missing a required field or with an unexpected extra field (e.g., `__proto__` or `constructor.prototype` keys) returns 400, not a 500 or silent acceptance. Valid requests behave exactly as before.

- [x] **P1-2: PII in plaintext logs**
  - **Problem:** `backend/controllers/orderController.js` has multiple `console.log(JSON.stringify(order))`-style calls dumping full order objects (customer name, contact info, addresses) to stdout with no redaction, no log levels, no structure.
  - **Files to touch:** `backend/package.json`, `backend/controllers/orderController.js`, `backend/server.js`.
  - **Exact change:** `cd backend && npm install pino pino-http`. Replace `console.log`/`console.error`/`console.warn` calls in `orderController.js` (and ideally `server.js`) with a shared `logger` instance. Remove full-object dumps; log only IDs/status transitions (e.g., `logger.info({ orderId, status }, "order status updated")`), never full customer PII.
  - **How to verify:** Trigger an order create/update/approve flow and confirm logs contain structured JSON lines with order IDs and status but no full customer name/contact/address blobs.

- [x] **P1-3: No error tracking**
  - **Problem:** No Sentry (or equivalent) integration. Prod errors are only visible by manually reading container logs.
  - **Files to touch:** `backend/package.json`, `backend/server.js`, `backend/middleware/errorHandler.js`.
  - **Exact change:** Add `@sentry/node`, initialize it early in `server.js` guarded by a `SENTRY_DSN` env var (no-op if unset), and capture exceptions in `errorHandler.js` before responding. Add `SENTRY_DSN=` to `backend/.env.example`.
  - **How to verify:** Trigger a deliberate error locally with `SENTRY_DSN` set to a test project — confirm it appears in Sentry. With `SENTRY_DSN` unset, server behaves exactly as before (no crash, no-op).

- [x] **P1-4: Process doesn't exit on fatal errors**
  - **Problem:** `backend/server.js` (lines ~135-141) only logs on `unhandledRejection`/`uncaughtException` and keeps running in a potentially corrupted state.
  - **Files to touch:** `backend/server.js`, `docker-compose.yml` / deploy config (confirm restart policy).
  - **Exact change:**
    ```js
    process.on("uncaughtException", (err) => {
      logger.error({ err }, "Uncaught Exception — exiting");
      process.exit(1);
    });
    ```
    Confirm the container orchestrator (Docker `restart: unless-stopped` in `docker-compose.yml`, or Railway's restart policy) will restart the process after exit.
  - **How to verify:** Force an uncaught exception in a local/staging run — process exits with code 1, orchestrator restarts it, `/health` recovers.

- [ ] **P1-5: No DB connection retry/backoff**
  - **Problem:** `backend/config/db.js`'s `connectDB` makes one attempt; `backend/server.js`'s `connectDatabase()` catches failure and just logs, never retries.
  - **Files to touch:** `backend/config/db.js` or `backend/server.js`.
  - **Exact change:** Wrap the `connectDB` call in a retry loop (e.g., 5 attempts, exponential backoff starting at 1s) before giving up and logging a final failure.
  - **How to verify:** Start the server with Mongo temporarily unreachable, then make it reachable mid-backoff — server connects successfully without a manual restart.

- [ ] **P1-6: Zero automated test coverage**
  - **Problem:** No `*.test.*`/`*.spec.*` files, no test framework in either `package.json`.
  - **Files to touch:** root `package.json` (Vitest for frontend), `backend/package.json` (Vitest or Jest + Supertest + `mongodb-memory-server` for backend), new `*.test.*` files alongside the code they cover.
  - **Exact change:** Add Vitest to the frontend; add Vitest/Jest + `supertest` + `mongodb-memory-server` (already proven to work in this repo) to the backend. Prioritize coverage for: auth flows (register/login/forgot/reset), order validation branches in `adminCreateOrder`/`adminUpdateOrder` (the exact logic already fixed once on the frontend side — lock it in with a backend test), and `roleMiddleware`/`authMiddleware`. Do not aim for 100% coverage — target the highest-risk paths first.
  - **How to verify:** `npm test` (root and `backend/`) runs and passes locally and in CI once P1-7 lands.

- [ ] **P1-7: No CI**
  - **Problem:** No `.github/workflows` directory; no automated checks run on push/PR.
  - **Files to touch:** new `.github/workflows/ci.yml`.
  - **Exact change:** Add a workflow that on every push/PR to `main` runs: `npm run lint` (root `tsc --noEmit`), `npm audit --audit-level=high` (root and `backend/`), `npm test` (once P1-6 lands), and `docker build .` to catch Dockerfile breakage.
  - **How to verify:** Open a PR and confirm the workflow runs and reports status; break something intentionally (e.g., a type error) and confirm CI fails.

- [ ] **P1-8: Frontend/backend admin role-gating UX mismatch**
  - **Problem:** `src/components/AdminRoute.tsx` decodes `role` from the JWT client-side for nav-gating; `src/context/UserContext.tsx` fetches the live role from `/api/user/profile`. A just-promoted/demoted user can see stale nav behavior until re-login. (Backend authorization itself is not affected — `authMiddleware.js` always re-checks the live DB role.)
  - **Files to touch:** `src/components/AdminRoute.tsx`, `src/context/UserContext.tsx`.
  - **Exact change:** Have `AdminRoute.tsx` read `role` from `UserContext` (calling/awaiting `refreshUser()` if needed) instead of decoding the JWT directly.
  - **How to verify:** Promote a logged-in user to admin directly in the DB, trigger a `UserContext` refresh (e.g., navigate), and confirm admin nav becomes available without requiring a full logout/login.

- [ ] **P1-9: Legacy/duplicate Order schema fields**
  - **Problem:** `backend/models/Order.js` carries legacy/duplicate fields (`address` vs structured address fields, `trackingId` vs `tracking_code` vs `uspsTracking`, `total_price` vs `totalUSD`/`totalVND`) from prior migrations that were never cleaned up.
  - **Files to touch:** `backend/models/Order.js`, a new `MIGRATIONS.md` or note in `backend/scripts/`.
  - **Exact change:** Document which fields are currently authoritative vs legacy (do not delete anything yet). Plan a follow-up migration to drop dead fields only once confirmed unused by any remaining client code or reports — this is a documentation task now, a schema-migration task later.
  - **How to verify:** A short markdown table exists listing each duplicate/legacy field, its replacement, and current usage status.

---

## P2 — Can wait, but track

- [ ] **P2-1: Stale/generic README** — `README.md` currently describes an unrelated "AI Studio" template (`GEMINI_API_KEY`, `ai.studio` links). Rewrite to describe this app: setup, env vars, how to run tests, how to deploy, how to rotate secrets.
- [ ] **P2-2: Root `.env.example` clutter** — strip irrelevant AI-Studio vars from the root `.env.example`, keep only `VITE_API_URL`, or consolidate into one file with clearly separated frontend/backend sections.
- [ ] **P2-3: No ESLint/Prettier** — add a baseline ESLint config so `npm run lint` catches more than type errors.
- [ ] **P2-4: Non-descriptive commit history** — adopt short Conventional Commits style (`fix:`, `feat:`, `chore:`) going forward; no need to rewrite history.
- [ ] **P2-5: Dead `middleware.ts` at repo root** — confirmed unused (Next.js template, no Next.js dependency in this project). Delete it, or move it to a `docs/`/`future/` folder with a note if it's intentionally kept as a reference for a possible future migration.
- [ ] **P2-6: Ad hoc migration scripts** — `backend/scripts/migrate-*.js` are one-off scripts with no record of what's been run against which environment. Adopt a minimal migration runner, or at least a `MIGRATIONS.md` log.
- [ ] **P2-7: Bundle size / frontend perf** — run a bundle analyzer pass on the Vite build; consider `React.lazy` route-based code-splitting for admin-only pages.

---

## Environments

- **dev** — local, `mongodb-memory-server` or a local Mongo container, `npm run dev` (frontend) + `nodemon` (`backend/`).
- **staging** — same Docker image as prod (built from the repo's `Dockerfile`), separate MongoDB database/cluster, separate `JWT_SECRET`, separate `ALLOWED_ORIGINS`. Use this to verify P0-1 and P0-4 before they touch prod.
- **prod** — Railway (assumption — confirm), locked-down env vars, `ALLOWED_ORIGINS` pointing only at the real prod frontend origin(s).

If no staging environment currently exists, create one (even a second minimal Railway service) before applying P0-1 or P0-4.

## Secrets & config

Every required prod env var must be set to a real, unique-to-prod value. See the Appendix for the full list after this plan is applied. Specifically:
- Rotate `JWT_SECRET` now (see P0-2) since it may have run on the insecure hardcoded fallback previously.
- Never commit a real `.env` file — `.env*` is gitignored except `.env.example`; keep that pattern.
- Update `backend/.env.example` in the same change that introduces any new env var (Rule 7).

## CI/CD

See P1-7. Minimum pipeline: typecheck → `npm audit --audit-level=high` → tests → `docker build`. Deploy: build on merge to `main`, auto-deploy to staging, manual promotion to prod (approval gate or `workflow_dispatch`) until confidence is built.

## Observability

- Structured logs via `pino` (P1-2), no PII in log payloads.
- Error tracking via Sentry (P1-3) — highest-leverage single addition given there is currently zero prod error visibility beyond manually reading logs.
- `/health` reflecting real DB connectivity (P0-5), wired to the platform's health-check config.

## Rollback

No CI/CD or tagged releases exist today. Near-term: redeploy the previous Docker image/commit manually on the platform. Once P1-7 (CI) lands, tag each deploy so rollback becomes "redeploy this tag."

---

## Execution order

1. **P0 block**, smallest safe diffs, in roughly this order (CORS and the secret fallback are the most exploitable, so do them first if working serially): P0-1 → P0-2 → P0-3 → P0-4 → P0-5 → P0-6 → P0-7.
2. **Stand up staging** (if it doesn't exist) before applying P0-1 or P0-4 to prod.
3. **P1 block**: P1-1 (validation) → P1-2 (logging) → P1-3 (error tracking) → P1-4 (fatal-exit) → P1-5 (DB retry) → P1-6 (tests) → P1-7 (CI) → P1-8 (nav UX) → P1-9 (schema doc). Tests/CI are sequenced after the code-level P1 fixes so they aren't written against code about to change.
4. **P2 block** opportunistically alongside normal feature work — none of it blocks shipping.

## Definition of production-ready

- All P0 checkboxes checked and verified per their "How to verify" steps.
- Full manual regression pass (login, register, forgot/reset password, order CRUD/approval, tracking, quotes, admin nav) completed in staging after the P0 block, with no regressions.
- `npm audit --audit-level=high` clean (or documented accepted-risk exceptions) in both root and `backend/`.
- `/health` accurately reflects DB connectivity and is wired to the platform's health checks.
- At least one error-tracking integration live in prod.
- `JWT_SECRET`, `RESEND_API_KEY`, `WEBHOOK_URL` confirmed as real, unique, non-default values in the prod environment; `JWT_SECRET` rotated.
- A documented rollback procedure exists and has been exercised at least once in staging.

## Risks, assumptions, open questions

- **Assumption:** deploy target is Railway. If wrong, re-map CORS/health/env guidance to the real platform.
- **Assumption:** current traffic/user volume is low enough that "fix P0 in staging, then cut over" is acceptable without a blue/green or canary rollout. If this app already has active paying users, treat P0-1 and P0-4 as higher-risk and rehearse them in staging first (already required by Rule 9).
- **Risk:** `npm audit fix` on `react-router` and `mongoose` may include breaking changes given how wide the vulnerable version ranges are — requires real manual regression testing, not just a clean audit output.
- **Open question:** who owns/uses the Google Apps Script / Google Sheet behind the P0-6 webhook, and is it still actively needed? Confirm before investing further in hardening it.
- **Open question:** is a real staging environment available, or does it need to be created from scratch?
- **Open question:** no GitHub issues/PRs exist on the remote — confirm whether bug/task tracking happens elsewhere that should be cross-referenced against this plan.

---

## Appendix: required env vars after this plan is applied

All of these belong in `backend/.env.example` (update it as each is introduced, per Rule 7):

| Var | Introduced by | Notes |
|---|---|---|
| `MONGODB_URI` | existing | required, no fallback |
| `JWT_SECRET` | existing, hardened by P0-2 | required, no fallback, rotate now |
| `JWT_EXPIRES_IN` | existing | default `7d` |
| `JWT_ISSUER` | existing | default `moc-nhien-authentic` |
| `BCRYPT_SALT_ROUNDS` | existing | currently defined but not actually read by `User.js`'s pre-save hook (hardcoded to 12) — align these while touching auth code |
| `QUOTE_EXCHANGE_RATE_VND_PER_USD` | existing | default `23000` |
| `RESEND_API_KEY` | existing | required for password reset email |
| `RESEND_FROM` | existing | |
| `CLIENT_URL` / `FRONTEND_BASE_URL` | existing | |
| `ALLOWED_ORIGINS` | P0-1 | comma-separated list, no wildcard fallback |
| `WEBHOOK_URL` | P0-6 | Google Apps Script webhook; empty = sync skipped with a warning |
| `SENTRY_DSN` | P1-3 | optional; no-op if unset |
