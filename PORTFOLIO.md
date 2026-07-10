# Portfolio Positioning

Use this wording when presenting the ERP project on GitHub, a CV, LinkedIn, or a personal portfolio. Keep the phrasing honest: this is an internship and portfolio project, not a proven production ERP unless a real deployment is later confirmed.

## GitHub repository descriptions

Backend:

```text
Backend API for a MERN ERP project developed during a second-year IUT Annecy Informatique internship, Parcours A, with Designet Web Agency.
```

Frontend:

```text
Frontend interface for a MERN ERP project developed during a second-year IUT Annecy Informatique internship, Parcours A, with Designet Web Agency.
```

## GitHub profile README

```md
### MERN ERP Platform

Internship project developed during my second year at IUT Annecy Informatique, Parcours A, with Designet Web Agency.

The application covers sales, purchases, inventory, invoices, payments, reports, authentication, and role-based access. I also performed a production-readiness audit and implemented improvements for stock consistency, payment validation, backend security, documentation, and integration testing.

- Backend: https://github.com/Arfaoumo/ERP_Backend
- Frontend: https://github.com/Arfaoumo/ERP_Frontend
```

## CV experience entry

```md
Internship Developer - Designet Web Agency
Second-year IUT Annecy Informatique, Parcours A

- Worked on a MERN ERP platform covering sales, purchases, inventory, invoices, payments, reporting, authentication, and role-based access.
- Improved backend data integrity for stock, purchase receiving, document conversion, and payment workflows.
- Added validation, security hardening, documentation, and focused integration tests.
- Reviewed frontend API workflows and improved payment/forms behavior while preserving the existing UI.
```

## LinkedIn project entry

Title:

```text
MERN ERP Platform - Internship Project
```

Description:

```text
ERP-style full-stack application developed during my second-year IUT Annecy Informatique internship, Parcours A, with Designet Web Agency. The project includes sales, purchases, inventory, invoices, payments, reports, authentication, and role-based access. I also performed a production-readiness audit and implemented fixes for stock consistency, payment validation, security configuration, documentation, and focused integration tests.
```

## Portfolio case-study structure

- Context: second-year IUT Annecy Informatique internship, Parcours A, with Designet Web Agency
- Goal: build and harden an ERP-style business management platform
- Stack: MongoDB, Express, React, Node.js
- Main features: sales lifecycle, purchasing, stock, invoices, payments, reports, OCR, uploads, and role-based access
- Engineering focus: transactional stock/payment workflows, idempotency, validation, CORS/security, error handling, and tests
- What I learned: translating business workflows into full-stack features, protecting data integrity, and preparing a student project for a professional portfolio review

## Strong interview points

- I traced the frontend workflow before changing backend stock logic.
- I made stock deduction exact-once and idempotent across document conversion.
- I hardened invoice payments against invalid amounts, overpayment, and concurrent requests.
- I added backend tests with an isolated MongoDB replica set.
- I documented deployment requirements honestly, including MongoDB transactions and remaining limitations.
