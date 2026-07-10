# ERP Production-Readiness Final Report

Date: 2026-07-10  
Backend baseline: `f20a549`  
Frontend baseline: `b4d517d`

## 1. Executive summary

The two repositories were pulled before inspection and were already current. The frontend workflow was traced before changing backend business rules. The audit confirmed that the normal UI treats Order -> Delivery Note as dispatch, while a legacy backend Shipped endpoint and non-idempotent conversion path could independently deduct the same stock.

The repair preserves the existing MERN/CommonJS architecture and visual design. It makes the critical inventory, document-conversion, purchase-receipt, manual-adjustment, and payment operations transactional; enforces lifecycle and validation rules; removes writes from sales GET requests; improves authentication, authorization, CORS, uploads, errors, and dependency security; adds isolated integration tests; restores a clean frontend lint/build baseline; and replaces template documentation with setup/security guides.

The result is materially safer and suitable for a recruiter-facing portfolio demonstration after the deployment prerequisites in section 9 are completed. It is not represented as a fully proven production ERP.

## 2. Confirmed bugs fixed

- Order -> Delivery Note is now the only sales stock-dispatch event.
- `PUT /api/sales/:id/status` can no longer use Shipped to deduct an already-converted Order.
- Repeated Quote/Order/Delivery conversion returns the existing child rather than creating another document.
- Concurrent/repeated Order conversion cannot create duplicate source movements or deduct stock twice.
- Conditional stock updates reject insufficient inventory and prevent negative stock.
- Purchase receiving is idempotent under repeated requests and protected under concurrent writes.
- Manual stock adjustments reject invalid type, non-finite/non-positive quantity, empty reason, insufficient stock, and partial writes.
- Payments now accept only active Invoices, finite positive amounts, and Cash/Check; overpayment, cancelled/paid documents, and non-Invoices are rejected.
- Concurrent payments cannot both consume the same remaining balance.
- Payment totals and remaining balances use consistent two-decimal rounding and derived statuses.
- `GET /api/sales` is read-only; overdue mutation moved to a dedicated daily service/job.
- Purchase-order buying prices and totals are calculated from database products rather than client-submitted values.
- HR-authorized user administration can no longer create/promote/modify Admin accounts.
- Disabled users cannot log in or continue using an old token.
- Malformed ObjectIds, unknown routes, Mongoose validation, and duplicate keys no longer fall through to inconsistent generic responses.
- Frontend payment defaults no longer confuse zero/null balances or use the untaxed amount as an unsafe fallback.
- Frontend confirmation/payment actions prevent accidental duplicate submissions.
- Invalid/stale locally stored sessions are revalidated against the backend and removed.
- Unknown frontend routes now have a safe fallback.

## 3. Security improvements

- CORS now uses comma-separated `CORS_ORIGINS`; development localhost origins are explicit and production fails closed without configuration.
- Helmet remains enabled, Express's identifying header is disabled, and request body limits are explicit.
- Login has a focused rate limiter with the common API error shape.
- Zod validation and strict request allowlists protect auth, users, products, categories, customers, suppliers, purchase orders, sales, payments, stock adjustments, and courier routes.
- Login input can no longer supply query-operator objects.
- Passwords have a minimum length, remain bcrypt-hashed, use schema-level `select: false`, and are excluded from responses.
- JWT expiry is configurable while retaining the current 30-day default.
- Backend role checks remain authoritative; Admin override behavior is explicit.
- Uploads now require authentication and target-specific roles, reject unknown targets, cap files at 5 MB, validate MIME/extension, cap decoded pixels, rotate/re-encode with Sharp, and use random server filenames.
- Old-upload deletion is constrained to the upload root and runs after a successful database save.
- Errors use `{ success: false, message, errors }`; stack traces are not returned.
- Runtime uploads and `.env.production` were removed from Git tracking; `.env.example` files contain placeholders only.
- npm audit fixes updated only compatible patch/minor resolutions; final full and production-only audits report zero vulnerabilities in both repositories.

## 4. Data-integrity improvements

- Mongoose sessions and `withTransaction` protect multi-write workflows.
- Unsupported standalone MongoDB deployments receive a clear 503 error before a transaction can partially commit.
- Unique indexes enforce one child per parent/type and one source movement per document/product.
- Duplicate product lines are aggregated during stock dispatch/receipt so one movement is created per product/source.
- Product stock and key monetary/quantity schema fields now enforce non-negative/positive bounds.
- Sale conversion updates stock, movement, child document, parent status, and customer totals in one transaction.
- Purchase receiving updates stock, movements, received date, and status in one transaction.
- Manual adjustment updates product and movement in one transaction.
- Payment ledger entry, amount paid, remaining balance, and payment/document statuses update in one transaction.
- Overdue processing uses an explicit service instead of mutating data while reading.

## 5. Tests added

The backend now uses Jest, Supertest, and an isolated `MongoMemoryReplSet`. No test accesses the configured local or production database.

Fifteen integration tests cover:

1. Login success and password exclusion
2. Login failure and error contract
3. Access without a token
4. Role authorization
5. HR-to-Admin privilege escalation denial
6. Disabled-user token rejection
7. Database prices overriding sale client prices
8. Quote -> Order without stock mutation
9. Order -> Delivery Note exact-once stock/movement behavior
10. Legacy Shipped double-deduction prevention
11. Delivery Note -> Invoice lifecycle coherence
12. Insufficient-stock rollback
13. Payment document/method/overpayment validation
14. Concurrent payment protection and final payment state
15. Database purchase prices, idempotent receiving, malformed IDs, and 404 shape

Repeatable startup smoke scripts additionally launch the real backend entry point against a temporary replica set and launch the Vite frontend before checking HTTP responses.

Coverage result: 34.98% statements, 19.69% branches, 31.25% functions, and 36.4% lines overall. Critical middleware reached 97.29% statement coverage, but broader CRUD/report/OCR coverage remains intentionally listed as a next step.

## 6. Frontend improvements

- Payment inputs now have cent precision, positive minimum, current-balance maximum, correct total-with-tax fallback, disabled in-flight actions, and inline API errors.
- Conversion confirmation prevents double-click requests.
- Stored auth state is parsed safely and refreshed from `/api/auth/profile`.
- Disabled/deleted/expired users are logged out locally after profile validation.
- A wildcard route prevents blank/unmatched screens.
- Actual unused imports/state and unstable document-number initialization were cleaned up.
- ESLint compiler-oriented rules that conflicted with the project's established fetch-effect pattern were scoped off; meaningful core lint rules remain active.
- Production build and lint now pass without changing the UI design.

## 7. Documentation added

- `AUDIT.md` with severity, files, explanation, reproduction, recommendation, and confidence for every initial finding
- Professional backend README with architecture, prerequisites, transaction requirements, variables, commands, modules, roles, security notes, and limitations
- Professional frontend README with modules, setup, backend dependency, role behavior, screenshots checklist, and limitations
- Backend and frontend `.env.example` files
- Improved frontend `.gitignore` for all environment variants except the example
- Documented startup smoke commands
- Removed tracked runtime uploads and environment-specific frontend configuration

No claim was added that this ERP serves real customers or is production-proven.

## 8. Commands run and results

| Command/check | Result |
| --- | --- |
| `git pull --ff-only` (both repositories) | Passed; already up to date |
| `npm ci` backend | Passed after repairing optional peer entries in the lockfile |
| `npm ci` frontend | Passed after repairing optional WebAssembly peer entries in the lockfile |
| `npm test` backend | Passed: 1 suite, 15 tests |
| `npm run test:coverage` backend | Passed; coverage reported in section 5 |
| `npm run test:startup` backend | Passed; real `server.js`, temporary replica set, HTTP 200 health |
| `npm run lint` frontend | Passed: zero errors/warnings |
| `npm run build` frontend | Passed; 1,861 modules, ~671.29 kB main JS, bundle-size warning only |
| `npm run test:startup` frontend | Passed; Vite ready and HTTP 200 root response |
| Key API workflow tests | Passed through the isolated integration suite |
| `npm audit` backend | Passed: 0 vulnerabilities |
| `npm audit --omit=dev` backend | Passed: 0 vulnerabilities |
| `npm audit` frontend | Passed: 0 vulnerabilities |
| `npm audit --omit=dev` frontend | Passed: 0 vulnerabilities |
| `git diff --check` during commits | Passed |
| Node syntax/app-load checks | Passed |

The first clean-install attempt exposed incomplete optional-peer lock entries, and the first inline startup one-liners were broken by PowerShell quoting. Both verification issues were repaired with deterministic lock updates and committed smoke scripts; the final commands pass.

## 9. Remaining risks and deployment blockers

The following should not be hidden in a portfolio discussion:

1. **MongoDB topology is a deployment blocker.** Use a replica set or sharded cluster. A standalone MongoDB server will intentionally reject critical transactional operations.
2. **Index migration must be checked.** Existing data may already contain duplicate conversion children. Clean duplicates before building the new unique indexes in a deployed database.
3. **Environment configuration is a deployment blocker.** Set strong `JWT_SECRET`, exact production `CORS_ORIGINS`, HTTPS/reverse-proxy settings, and provider secrets outside Git.
4. **Uploads need durable storage.** Local disk is unsuitable for many cloud deployments. Existing database image URLs that referenced removed tracked uploads need migration or placeholder handling.
5. Product responses still expose both buying and selling fields to authenticated roles because current stock/purchase UI forms consume them. Design and test a field-level role policy before changing that behavior.
6. Tokens remain in localStorage. No XSS source was confirmed, but CSP and output hygiene are important; secure cookies require a coordinated auth redesign.
7. Login rate limiting is process-local. Use a shared store for multi-instance deployment.
8. OCR item resolution still has multi-write paths outside a transaction, and all OCR output requires human review.
9. Monthly report generation still couples job/service behavior to a controller-style function and should propagate failures more cleanly.
10. Coverage is focused rather than comprehensive. Reports, OCR, uploads, CRUD edge cases, frontend components, and browser end-to-end workflows need more tests.
11. The frontend main bundle has a size warning; route-level lazy loading is recommended.
12. Some older frontend screens retain browser alerts and some HR/Finance role UI coverage differs from backend capabilities.
13. No password reset, MFA, refresh-token rotation, or central JWT revocation list exists.

## 10. Recommended next improvements

1. Run a pre-deployment migration that detects duplicate child documents/movements and validates every stock balance.
2. Deploy against a staging replica set and run the same integration suite plus a seeded browser E2E suite.
3. Move uploads to Azure Blob Storage, S3, or an equivalent durable store with lifecycle policies.
4. Add Playwright/Cypress tests for all roles and the visible Quote -> Invoice and Purchase -> Receipt workflows.
5. Expand backend tests for OCR, uploads, overdue jobs, reports, CRUD validation, and check lifecycle.
6. Extract monthly reporting and OCR resolution into transaction-aware services.
7. Decide and implement field-level product price visibility together with matching frontend forms.
8. Add route-level React lazy loading and measure the resulting bundle.
9. Add password reset/MFA or document why they are outside the portfolio scope.
10. Add deployment health/readiness checks and centralized structured logging/monitoring.

## 11. Files changed

### Backend

- Added: `.env.example`, `AUDIT.md`, `FINAL_REPORT.md`, `README.md`, `app.js`, `jest.config.js`
- Added: `src/jobs/scheduledJobs.js`, `src/services/overdueService.js`
- Added: validation/error/transaction/money/file helpers and Zod schemas
- Added: `test/api.test.js`, `test/startup-smoke.js`
- Updated: `server.js`, database config, auth/product/sale/supplier-order controllers, auth/validation middleware, core Mongoose models, important routes, upload routes, error handler, package manifests/locks
- Removed from Git tracking: 17 runtime files under `uploads/`

### Frontend

- Added: `.env.example`, `scripts/startup-smoke.js`
- Updated: `.gitignore`, `README.md`, ESLint config, package manifests/locks, app routing, auth context, confirmation modal, dashboard/reports/customer/purchase/sale screens
- Removed from Git tracking: `.env.production`

## 12. Commit list

### Backend (12 commits)

1. `f3c7207` docs: add initial technical audit
2. `ea8cdec` fix: make stock updates idempotent and atomic
3. `6afe6eb` fix: validate invoice payments
4. `e010efa` refactor: move overdue processing out of GET requests
5. `0e4ced3` security: restrict cors and harden API inputs
6. `e162618` test: add critical backend integration tests
7. `33a2c7d` chore: stop tracking runtime uploads
8. `549221e` docs: add backend setup and security guide
9. `c2bca9f` chore: repair deterministic dependency lock
10. `12e1e26` security: apply dependency audit patches
11. `aea7983` test: add backend startup smoke check
12. This report commit: docs: add final production-readiness report

### Frontend (5 commits)

1. `ec7e201` fix: improve frontend validation and API handling
2. `46fb875` docs: add frontend setup guide and environment example
3. `3294bf3` chore: repair deterministic dependency lock
4. `b131257` security: apply dependency audit patches
5. `fffb6ad` test: add frontend startup smoke check

## Portfolio assessment

- **Safe to show recruiters:** Yes. The project now demonstrates honest technical auditing, transactional business logic, RBAC, validation, integration testing, security hardening, and documented limitations.
- **Can be deployed as a portfolio demo:** Yes, after the first four deployment blockers in section 9 are completed and verified in staging.
- **Remaining blocker before deployment:** A transaction-capable MongoDB deployment, clean unique-index migration, secure environment/CORS configuration, and durable/migrated upload storage.

Five strongest CV/interview features:

1. Transactional, idempotent Quote -> Order -> Delivery Note -> Invoice lifecycle
2. Exact-once inventory movements with insufficient-stock and concurrency protection
3. Atomic invoice payment validation and concurrent-overpayment prevention
4. Backend RBAC, active-user JWT checks, strict validation, bounded uploads, and consistent errors
5. Isolated replica-set integration tests plus reproducible clean-install, startup, build, lint, and audit checks
