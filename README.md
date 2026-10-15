# Mộc Nhiên Authentic

Order management for a US → Vietnam purchasing and shipping service. Customers place and
track orders. Staff and admins price orders, record payments, and update shipping status.

## Features

- **Orders**: customer order requests, admin approval and pricing (USD × exchange rate → VND),
  status timeline, USPS tracking numbers.
- **Payments**:
  - Each unpaid order shows a VietQR code with the outstanding amount and the order code pre-filled.
  - With [SePay](https://sepay.vn) connected, incoming bank transfers are matched to orders
    automatically, including partial payments.
  - Transfers that can't be matched are listed in **Admin → Payments** for manual assignment.
- **Spreadsheets**:
  - **Admin → Manage Orders → Export Excel** downloads the filtered orders as `.xlsx`.
  - An optional live Google Sheet mirror is available ([setup](integrations/google-sheets/README.md)).
- **Accounts**: registration, login (httpOnly JWT cookie), password reset by email (Resend), and
  admin/user roles.

Stack: React 19 + Vite + Tailwind (frontend) · Express 5 + Mongoose (backend, `backend/`) · MongoDB.

## Run locally

Prerequisites: Node.js 20+ and a MongoDB instance (local, Docker, or Atlas).

```bash
npm install
cd backend && npm install && cp .env.example .env && cd ..
# edit backend/.env: MONGODB_URI and JWT_SECRET at minimum
```

Start the two processes in separate terminals:

```bash
cd backend && npm run dev     # API on http://localhost:4000
npm run dev                   # site on http://localhost:3000 (proxies /api to :4000)
```

Create an admin account:

```bash
cd backend && npm run create-admin -- --email you@example.com
```

## Tests

```bash
npm run lint && npm test           # frontend typecheck + tests
cd backend && npm test             # backend tests (in-memory MongoDB, no setup needed)
```

## Deploy

Use Docker Compose on your own server (Caddy for HTTPS, MongoDB with auth, backups).
See **[DEPLOY.md](DEPLOY.md)**.
