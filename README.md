# Designet ERP Backend

Express and MongoDB API for a student MERN ERP portfolio project. It supports role-based sales, purchasing, inventory, customer/supplier management, reports, uploads, PDF generation, and optional invoice OCR.

This repository is suitable for development and portfolio demonstrations. It is not presented as a proven production service or as software used by real customers.

## Architecture

The API follows the existing CommonJS MVC structure:

```text
app.js                     Express application and middleware
server.js                  Environment validation, database connection, jobs, listener
src/
  config/                  MongoDB connection
  controllers/             HTTP handlers
  jobs/                    Cron schedules
  middleware/              Authentication, authorization, validation
  models/                  Mongoose schemas and indexes
  routes/                  Express route definitions
  services/                Reusable business services
  utils/                   Errors, transactions, money, and file helpers
  validation/              Zod request schemas
test/                      Jest/Supertest integration tests
```

Business-critical stock, conversion, receipt, adjustment, and payment writes use MongoDB transactions. Order -> Delivery Note is the single stock-dispatch event. Purchase Order -> Received is the stock-receipt event.

## Features

- JWT authentication with active-user checks and backend role authorization
- Quotes, orders, delivery notes, invoices, and Cash/Check payments
- Idempotent document conversion and source-linked stock movements
- Supplier orders and atomic goods receipt
- Product, category, customer, supplier, courier, and user administration
- Financial summaries, CSV exports, dashboard metrics, and overdue processing
- Server-generated sales PDFs
- Authenticated image uploads with file limits and re-encoding
- Optional OpenAI-powered supplier-invoice OCR
- Consistent API validation and error responses

## Technologies

Node.js, Express, MongoDB/Mongoose, JWT, bcryptjs, Zod, Helmet, CORS, Multer, Sharp, PDFKit, node-cron, Jest, Supertest, and mongodb-memory-server.

## Prerequisites

- Node.js 20 or newer (the current dependency set should also work on supported newer LTS releases)
- npm
- MongoDB configured as a replica set or sharded cluster
- Optional OpenAI API access for OCR

MongoDB transactions do not work on a standalone `mongod`. For local development, start a single-node replica set and initialize it before using stock, conversion, receipt, or payment endpoints. Managed MongoDB services should be checked for transaction support.

## Installation

```bash
git clone https://github.com/Arfaoumo/ERP_Backend.git
cd ERP_Backend
npm ci
cp .env.example .env
```

Fill in local values in `.env`. Never commit that file.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | Yes | Transaction-capable MongoDB connection URI |
| `JWT_SECRET` | Yes | Long random JWT signing secret |
| `CORS_ORIGINS` | Production | Comma-separated allowed frontend origins |
| `NODE_ENV` | Recommended | `development`, `test`, or `production` |
| `PORT` | No | HTTP port; defaults to `5000` |
| `JWT_EXPIRES_IN` | No | jsonwebtoken expiry; defaults to `30d` |
| `JSON_BODY_LIMIT` | No | JSON request limit; defaults to `1mb` |
| `FORM_BODY_LIMIT` | No | URL-encoded request limit; defaults to `1mb` |
| `TRUST_PROXY` | No | Set to `1` behind one trusted reverse proxy |
| `OPENAI_API_KEY` | OCR only | Server-side OCR provider credential |
| `OPENAI_OCR_MODEL` | No | OCR model; defaults to `gpt-4o` |

In development, `http://localhost:5173` and `http://127.0.0.1:5173` are automatically allowed. Production browser origins must be listed explicitly.

## Running locally

```bash
npm run dev
```

Production-style start:

```bash
npm start
```

Health check: `GET http://localhost:5000/api/health`.

## Tests

```bash
npm test
npm run test:watch
npm run test:coverage
npm run test:startup
```

Tests start an isolated in-memory MongoDB replica set and never use `.env` database data. The suite covers authentication, authorization, lifecycle conversions, database prices, stock integrity, idempotency, payments, receiving, and error contracts.

## API module overview

| Prefix | Module |
| --- | --- |
| `/api/auth` | Login, profile, and user administration |
| `/api/products` | Catalog, adjustments, and stock movement history |
| `/api/categories` | Product tax categories |
| `/api/customers` | Customer management |
| `/api/suppliers` | Supplier management |
| `/api/purchases/orders` | Purchase orders and receipt |
| `/api/sales` | Sales documents, conversion, payment, and PDF |
| `/api/delivery-companies` | Courier configuration |
| `/api/upload` | User/product image uploads |
| `/api/ocr` | Invoice extraction and item resolution |
| `/api/reports` | Reports and CSV exports |
| `/api/dashboard`, `/api/alerts`, `/api/logs` | Operational views |

Errors use this shape:

```json
{
  "success": false,
  "message": "Request validation failed.",
  "errors": [{ "field": "amount", "message": "Too small" }]
}
```

## Roles

- `Admin`: global override and system administration
- `Employee_Commercial`: customers and sales lifecycle
- `Employee_Stocks`: catalog and stock operations
- `Employee_Achats`: suppliers, purchase orders, OCR, and purchase-time product creation
- `Employee_Finance`: finance/report access where routes explicitly allow it
- `Employee_RH`: user administration, but cannot create/promote/modify Admin accounts

Frontend route visibility is only a convenience. Every protected operation is authorized again by the API.

## Security notes

- Passwords are bcrypt-hashed and excluded by default from queries/responses.
- Deleted or disabled users cannot continue using existing tokens.
- Login attempts are rate-limited in memory. Multi-instance production deployments should use a shared limiter store.
- Uploads require authentication, are size-limited, decoded by Sharp, renamed server-side, and never committed.
- Production CORS is allowlist-based. Configure Helmet/CSP and reverse-proxy settings for the actual deployment.
- Local filesystem uploads are not durable on many cloud hosts. Use persistent object storage for deployment.

## Known limitations

- MongoDB replica-set/sharded topology is mandatory for business transactions.
- No refresh tokens, password reset, MFA, or centralized token revocation list are implemented.
- The in-memory login limiter is process-local.
- OCR requires an external provider and extracted values still need human review.
- Runtime images use local disk; existing database URLs may need migration after moving to object storage.
- Product list responses still reflect the current frontend's shared product form and may expose both buying and selling prices to authenticated roles. A field-level role policy should be designed together with the UI before changing it.
- Existing deployments must check for duplicate conversion children before Mongoose can build the new unique indexes.

See [AUDIT.md](./AUDIT.md) for the original findings and `FINAL_REPORT.md` for completed work and remaining deployment risks.
