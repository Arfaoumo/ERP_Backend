# ERP Production-Readiness Audit and Implementation Plan

Date: 2026-07-10  
Backend baseline: `f20a549`  
Frontend baseline: `b4d517d`

## Scope and method

This audit covers both repositories. Backend paths are relative to `ERP_Backend`; frontend paths are prefixed with `../frontend/`. Both repositories were clean and `git pull --ff-only` reported that they were up to date before inspection.

Findings marked **confirmed** were traced from a frontend action to its API endpoint where one exists, or reproduced directly from an exposed backend route when the UI has no corresponding action. **Suspected** findings need runtime or deployment evidence before they should be treated as defects.

## Workflow trace

### Sales

1. `../frontend/src/pages/sales/SaleForm.jsx` creates a Quote with `POST /api/sales`.
2. `../frontend/src/pages/sales/PipelineList.jsx` converts a pending Quote to an Order and a pending Order to a Delivery Note with `POST /api/sales/:id/convert`.
3. `../frontend/src/pages/sales/SaleList.jsx` also exposes conversion buttons. It converts an Order to a Delivery Note and an in-transit Delivery Note to an Invoice through the same endpoint.
4. The backend currently deducts stock during Order -> Delivery Note conversion.
5. No current frontend component calls `PUT /api/sales/:id/status`. That API nevertheless remains exposed and its `Shipped` branch deducts stock from any sale document without validating its type or lifecycle.
6. `../frontend/src/pages/sales/SaleList.jsx` records invoice payments with `PUT /api/sales/:id/payment`.

Conclusion: Order -> Delivery Note is the current UI's physical-dispatch event and should remain the single stock-deduction source of truth. The legacy/manual `Shipped` endpoint must not perform a second deduction.

### Purchases and manual stock

1. `../frontend/src/pages/purchases/PurchaseOrderForm.jsx` creates a supplier order with `POST /api/purchases/orders`.
2. `../frontend/src/pages/purchases/PurchaseOrderList.jsx` marks it Received with `PUT /api/purchases/orders/:id/status`.
3. The backend increments product stock and creates movements before saving Received status.
4. `../frontend/src/pages/inventory/StockMovementForm.jsx` calls `POST /api/products/:id/stock` for manual IN/OUT adjustments.

Both receiving and adjustment currently use separate, non-transactional writes.

## Findings

### F-01 — Non-idempotent sale conversion can duplicate documents and stock deductions

- Severity: **critical**
- Affected files: `src/controllers/saleController.js`, `src/models/Sale.js`, `src/models/StockMovement.js`, `../frontend/src/pages/sales/PipelineList.jsx`, `../frontend/src/pages/sales/SaleList.jsx`
- Status: **confirmed**
- Explanation: the conversion endpoint does not require the parent to be in its expected status, does not check for an existing child, and performs stock writes before creating the child and updating the parent. Sequential retries can create duplicate children; concurrent requests can race. Order conversion can therefore deduct stock more than once and create duplicate movements.
- Reproduction: create an Order with sufficient stock, then submit `POST /api/sales/:id/convert` twice (or double-submit concurrently). The first request marks the Order Processed, but the second request does not reject that status and enters the same stock loop.
- Recommended fix: enforce lifecycle preconditions, add a unique child constraint, use a transaction, make movements uniquely reference their source document, and return the existing child for an already-completed conversion.

### F-02 — Legacy Shipped endpoint can deduct the same Order again and allow negative stock

- Severity: **critical**
- Affected files: `src/controllers/saleController.js`, `src/routes/saleRoutes.js`, `../frontend/src/pages/sales/PipelineList.jsx`, `../frontend/src/pages/sales/SaleList.jsx`
- Status: **confirmed API risk; not invoked by the current frontend**
- Explanation: the UI deducts at Order -> Delivery Note. The exposed status endpoint separately deducts on `Shipped`, performs no document-type/transition validation, and does not check available stock. A processed Order can pass through both paths.
- Reproduction: convert an Order to a Delivery Note through the frontend, then call `PUT /api/sales/:orderId/status` with `{ "status": "Shipped" }` using the same commercial user's token. Stock is decremented again and can become negative.
- Recommended fix: define Order -> Delivery Note as the single dispatch event; reject legacy Shipped stock mutation and validate all status transitions.

### F-03 — Multi-write inventory workflows are non-atomic

- Severity: **critical**
- Affected files: `src/controllers/saleController.js`, `src/controllers/supplierOrderController.js`, `src/controllers/productController.js`
- Status: **confirmed**
- Explanation: sale conversion, purchase receiving, manual stock adjustment, customer totals, movements, and status changes are saved independently. A failure after a product save can leave stock changed without a movement or coherent document status.
- Reproduction: interrupt a request or force movement creation to fail after a product save. Earlier writes remain committed.
- Recommended fix: use Mongoose sessions/transactions for each business operation; document that MongoDB must be a replica set or sharded cluster and return a safe service error when transactions are unavailable.

### F-04 — Payment endpoint accepts invalid documents, values, and overpayments

- Severity: **critical**
- Affected files: `src/controllers/saleController.js`, `src/models/Sale.js`, `../frontend/src/pages/sales/SaleList.jsx`
- Status: **confirmed**
- Explanation: any Sale type can receive a payment. Negative values, numeric strings with unsafe forms, unsupported lifecycle states, overpayments, and concurrent payments are not explicitly rejected. `if (amount)` also treats values inconsistently. Parallel requests can both read the same balance and overpay.
- Reproduction: call `PUT /api/sales/:quoteId/payment` with a positive amount, or pay an Invoice with an amount greater than its remaining balance. The payment is appended and balance can become negative.
- Recommended fix: accept only active Invoices, validate a finite positive two-decimal amount and Cash/Check method, reject paid/cancelled/overpaid documents, derive rounded totals, and perform the read/write in a transaction.

### F-05 — GET /api/sales mutates invoices

- Severity: **high**
- Affected files: `src/controllers/saleController.js`, `server.js`
- Status: **confirmed**
- Explanation: listing sales repairs zero balances and writes overdue statuses. A read can trigger multiple writes, changes `updatedAt`, and changes the date subsequently used for overdue calculation.
- Reproduction: fetch `/api/sales` when a qualifying Invoice exists; the endpoint saves it while listing records.
- Recommended fix: move overdue processing into a dedicated service run by cron; keep GET read-only. Handle any legacy balance migration separately.

### F-06 — Purchase receiving is not concurrency-safe or atomic

- Severity: **high**
- Affected files: `src/controllers/supplierOrderController.js`, `src/models/SupplierOrder.js`, `src/models/StockMovement.js`, `../frontend/src/pages/purchases/PurchaseOrderList.jsx`
- Status: **confirmed**
- Explanation: sequential repeats are partly guarded by `order.status`, but parallel Received requests can both observe Pending. Product, movement, received date, and status writes are independent.
- Reproduction: send two concurrent Received updates for the same pending order. Both can enter the receipt loop and increment stock.
- Recommended fix: transaction, expected-status check, conditional stock updates, and unique source-linked movements.

### F-07 — Manual stock adjustment accepts invalid quantities/types and is non-atomic

- Severity: **high**
- Affected files: `src/controllers/productController.js`, `src/models/Product.js`, `src/models/StockMovement.js`
- Status: **confirmed**
- Explanation: `Number(quantity)` is not checked for finite positive values and any type other than IN follows the subtraction branch. `NaN`, negative quantities, and invalid types can corrupt stock. Product and movement writes are separate.
- Reproduction: submit a negative quantity or an unsupported type to `POST /api/products/:id/stock`.
- Recommended fix: validate IN/OUT and positive finite quantity, use a conditional atomic stock update inside a transaction, and enforce non-negative schema validation.

### F-08 — CORS is unrestricted

- Severity: **high**
- Affected files: `server.js`
- Status: **confirmed**
- Explanation: `cors()` accepts every origin. Bearer tokens are not cookies, but unrestricted browser access still broadens the attack surface and violates the requested production configuration.
- Reproduction: send a preflight with an arbitrary Origin; it is accepted.
- Recommended fix: parse comma-separated `CORS_ORIGINS`, include documented localhost defaults outside production, and reject unknown production origins.

### F-09 — Image upload route is unauthenticated and has no body/file size limit

- Severity: **high**
- Affected files: `src/routes/uploadRoutes.js`, `server.js`
- Status: **confirmed**
- Explanation: anyone can upload to memory and trigger Sharp processing. The multer configuration has no size limit. Invalid route types are silently written under `others`, and upload errors do not use the API error shape.
- Reproduction: unauthenticated `POST /api/upload/products` with a large image payload.
- Recommended fix: require authentication and role checks per upload target, enforce count/size/MIME/signature/decoded-pixel limits, reject unknown types, generate server-side filenames, and use centralized errors.

### F-10 — HR users can assign or promote users to Admin

- Severity: **high**
- Affected files: `src/routes/authRoutes.js`, `src/controllers/authController.js`, `../frontend/src/pages/users/UserForm.jsx`, `../frontend/src/pages/users/UserEditForm.jsx`
- Status: **confirmed**
- Explanation: both Admin and Employee_RH may create/update users, while controllers accept the submitted role including Admin. Backend authorization therefore permits privilege escalation; frontend route protection is not a security boundary.
- Reproduction: authenticate as Employee_RH and register a user with role Admin, or update an existing user to Admin.
- Recommended fix: enforce assignable roles on the backend; only Admin may assign Admin or modify an Admin account.

### F-11 — No disabled-user enforcement

- Severity: **high**
- Affected files: `src/models/User.js`, `src/controllers/authController.js`, `src/middleware/authMiddleware.js`
- Status: **confirmed missing control**
- Explanation: JWT expiry exists (30 days), password hashing is present, and deleted users are rejected. There is no disabled state, so administrators cannot revoke access without deleting a record. Existing tokens remain usable after role/password changes until expiry, although each request does reload the current database role.
- Reproduction: there is no field or endpoint behavior that can disable a user.
- Recommended fix: add `isActive`, reject disabled users during login and token authentication, and avoid returning passwords.

### F-12 — Product API exposes commercial prices across roles

- Severity: **medium**
- Affected files: `src/routes/productRoutes.js`, `src/controllers/productController.js`, `../frontend/src/App.jsx`
- Status: **confirmed**
- Explanation: every authenticated role can list complete Product documents, including buying and selling prices. The repository's role description says stock employees should not access selling prices.
- Reproduction: authenticate as Employee_Stocks and call `GET /api/products`.
- Recommended fix: project fields by role without breaking the commercial and purchasing forms; keep Admin access intentional.

### F-13 — Broadly inconsistent input validation and mass assignment

- Severity: **high**
- Affected files: most controllers and schemas, especially `src/controllers/productController.js`, `src/controllers/supplierOrderController.js`, `src/controllers/saleController.js`, and auth/customer/supplier/category controllers
- Status: **confirmed**
- Explanation: important identifiers, strings, arrays, quantities, prices, totals, and enum transitions are mostly left to partial schema validation. Product creation passes all of `req.body`; purchase totals and prices are client-controlled; sale document numbers/types are client-controlled. Malformed ObjectIds commonly surface as 500 responses.
- Reproduction: submit malformed IDs, empty line arrays, invalid numeric values, unexpected product fields, or a forged supplier-order total.
- Recommended fix: add reusable route validation, explicit allowlists, server-side totals/prices, ObjectId validation, and consistent 400/422 responses.

### F-14 — Error and 404 responses are inconsistent and leak stack fields outside production

- Severity: **medium**
- Affected files: `src/utils/errorHandler.js`, `server.js`, controllers with direct `{ message }` responses
- Status: **confirmed**
- Explanation: there is no final 404 handler. Error bodies vary, Mongoose Cast/Validation errors and duplicate keys are incomplete, and non-production responses include stack data. The requested predictable shape is absent.
- Reproduction: request an unknown route, submit a malformed ObjectId, and compare direct controller errors with middleware errors.
- Recommended fix: centralize `success`, `message`, and `errors`; map known Mongoose errors to 400/404/409; add API 404 middleware; expose stacks only via server logs in non-production, not the response contract.

### F-15 — Authentication brute-force protection and body limits are absent

- Severity: **medium**
- Affected files: `server.js`, `src/routes/authRoutes.js`
- Status: **confirmed**
- Explanation: login has no rate limiter and Express JSON/urlencoded parsers use defaults rather than explicit project limits.
- Reproduction: repeatedly submit login attempts without throttling.
- Recommended fix: integrate a focused login limiter and explicit conservative body limits; document proxy configuration where applicable.

### F-16 — Tracked runtime uploads violate repository hygiene

- Severity: **medium**
- Affected files: tracked `uploads/**`, `.gitignore`
- Status: **confirmed**
- Explanation: the ignore file now lists uploads, but multiple runtime upload files remain tracked. The local `.env` is correctly ignored; `node_modules` is ignored. The frontend tracks `.env.production`, which currently contains only a public Vite API URL, not a secret.
- Reproduction: `git ls-files uploads` lists runtime images.
- Recommended fix: stop tracking runtime uploads, preserve any genuinely required demo assets under a deliberate public/sample-assets path, and document persistent blob storage for deployment.

### F-17 — Frontend payment default and validation can submit the wrong balance

- Severity: **medium**
- Affected files: `../frontend/src/pages/sales/SaleList.jsx`
- Status: **confirmed**
- Explanation: `(sale.remainingBalance || sale.totalAmount)` falls back to untaxed `totalAmount` when balance is zero and there are no client-side bounds on the payment input. Backend validation remains authoritative, but the UI can present an invalid default.
- Reproduction: open payment behavior for inconsistent/legacy records or manipulate the input beyond the remaining balance.
- Recommended fix: use nullish handling and total-with-tax fallback, set positive/min/max/step constraints, prevent duplicate submissions, and display API errors without stale state.

### F-18 — Frontend baseline lint fails

- Severity: **medium**
- Affected files: 15 frontend source files reported by ESLint, notably `AuthContext.jsx`, `Reports.jsx`, list pages, `SaleForm.jsx`, and `PurchaseOrderForm.jsx`
- Status: **confirmed**
- Explanation: `npm run lint` reports 26 errors and 12 warnings, including unused values, hook dependency issues, effect/state rules, and impure `Date.now()` initialization. The production build succeeds but emits a >500 kB chunk warning.
- Reproduction: run `npm run lint` in the frontend repository.
- Recommended fix: correct meaningful code issues and align lint configuration with intentional data-fetch effects without weakening unrelated rules. Treat code splitting as a later performance improvement.

### F-19 — Cron error handling and application bootstrap are fragile

- Severity: **medium**
- Affected files: `server.js`, `src/controllers/reportController.js`, `src/config/db.js`
- Status: **confirmed**
- Explanation: server startup connects and listens as module side effects, complicating isolated API tests. The monthly cron calls a controller with a partial fake response and no `next`; a thrown error can turn into another error in the catch path.
- Reproduction: force monthly report generation to fail during the scheduled callback.
- Recommended fix: separate app creation from startup, extract services from HTTP controllers, start cron only after a successful database connection, and catch job errors explicitly.

### F-20 — Database-backed integration tests are absent

- Severity: **high**
- Affected files: `package.json`, entire backend
- Status: **confirmed**
- Explanation: no test scripts or test dependencies exist for authentication, authorization, stock, conversions, payments, or error contracts.
- Reproduction: `npm test` is undefined.
- Recommended fix: add Jest, Supertest, and an isolated MongoDB replica-set test database; cover the priority workflows listed in the task.

### F-21 — OCR resolution can leave partially created products/supplier links

- Severity: **medium**
- Affected files: `src/controllers/ocrController.js`
- Status: **confirmed**
- Explanation: resolving multiple OCR lines can create some products and logs before a later line fails, and supplier linking is a later write.
- Reproduction: resolve a payload where an early unmatched item is valid and a later item is invalid.
- Recommended fix: validate the full payload before writes and use a transaction for product creation and supplier linking. Keep provider extraction outside long database transactions.

### F-22 — Deployment transaction capability is not documented

- Severity: **high**
- Affected files: missing backend README and `.env.example`
- Status: **confirmed documentation gap; deployment topology unknown**
- Explanation: the requested atomic fixes require MongoDB transactions, which need a replica set or sharded cluster. The current environment may use Atlas/Azure-compatible replica topology, but that has not been proven and the checked-in repository provides no requirement.
- Reproduction: repository has no backend README or environment example describing MongoDB topology.
- Recommended fix: require a transaction-capable MongoDB deployment, make startup/runtime errors actionable, and document local single-node replica-set setup.

## Suspected or lower-priority observations

### S-01 — Static upload exposure may be unsuitable for production

- Severity: **low**
- Affected files: `server.js`
- Status: **suspected / deployment-dependent**
- Explanation: all files under uploads are publicly served. Current generated names are server-controlled and images are re-encoded, so direct script upload is limited; privacy and retention requirements are unknown.
- Reproduction: request a known `/uploads/...` URL without authentication.
- Recommended fix: document that uploads are public assets or move sensitive files to authorized/object storage. Do not change access semantics without a requirement.

### S-02 — localStorage token storage increases XSS impact

- Severity: **medium**
- Affected files: `../frontend/src/context/AuthContext.jsx`
- Status: **confirmed design characteristic; exploitability not proven**
- Explanation: tokens in localStorage are readable by injected JavaScript. No concrete XSS source was confirmed in this audit; one `dangerouslySetInnerHTML` use is fed through translations and should remain static-only.
- Recommended fix: for a portfolio demo, keep a strict CSP and avoid dynamic HTML. Consider secure httpOnly cookies only as a separately designed auth change, not an incidental rewrite.

## Implementation plan

1. Add an application/service structure that preserves CommonJS and existing routes while allowing startup and integration testing.
2. Add shared API error and validation helpers; normalize 404, CastError, validation, and duplicate-key responses.
3. Implement transaction-required helpers with a clear error when MongoDB does not support transactions.
4. Make sale conversion lifecycle-aware, transactional, and idempotent; add unique child and movement source keys; make Order -> Delivery Note the sole stock deduction event.
5. Make supplier receiving and manual stock adjustment transactional, validated, non-negative, and idempotent.
6. Harden Invoice payments with exact rounding, allowed methods/documents/statuses, transaction isolation, and overpayment rejection.
7. Extract overdue processing into a service and schedule it daily; keep GET routes read-only.
8. Restrict CORS from `CORS_ORIGINS`, add explicit body limits, login rate limiting, upload auth/limits/type validation, and role-aware product projections.
9. Enforce active users and backend role-assignment boundaries.
10. Validate high-value auth, user, product, category, customer, supplier, purchase, sale, payment, stock, and upload inputs with reusable middleware/controllers.
11. Add Jest/Supertest integration tests backed by an isolated MongoDB replica set.
12. Fix meaningful frontend API/payment/loading issues and restore a clean lint/build baseline without changing visual design.
13. Add professional README files, `.env.example` files, and repository hygiene updates.
14. Run installs, tests, lint, production build, startup smoke tests, workflow tests, and dependency audits; record exact results in `FINAL_REPORT.md`.

## Baseline quality checks

- Backend dependencies: already present locally; no test script exists at baseline.
- Frontend `npm run lint`: **failed** with 26 errors and 12 warnings.
- Frontend `npm run build`: **passed**; Vite reported a large chunk warning (about 670 kB uncompressed).
- Backend/frontend pull: **passed**, both already up to date.
- Runtime workflow tests: pending implementation of an isolated test database; production/local `.env` data will not be used.
