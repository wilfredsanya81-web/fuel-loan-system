# Fuel Loan Management System (Uganda)

Production-ready fintech monorepo: **Android Agent app** (Flutter), **Admin Web** (React), **Backend API** (Node.js + Express), **PostgreSQL**, **MTN MoMo & Airtel Money** integration.

- **Roles:** ADMIN, AGENT only. Riders do not log in.
- **Loan rules:** 24h duration, 10% service charge, 5% penalty every 24h overdue (compound, max 50% of principal), rider suspension after 72h overdue, one active/overdue loan per rider, partial payments allowed.

---

## Quick start (local with Docker)

### 1. Database and API

```bash
# Start PostgreSQL only (for local dev)
docker-compose up -d postgres

# Backend
cd backend
cp .env.example .env
# Edit .env: set DATABASE_URL, JWT_SECRET, and optionally MTN/Airtel keys
npm install
npm run migrate
npm run dev
```

API: `http://localhost:4000`. Health: `GET /health`.

### 2. Create first admin user

After migrations, create an admin (one-off):

```bash
cd backend
npx tsx src/db/seed-admin.ts
# Follow prompt: phone, password, name. Or use env SEED_ADMIN_PHONE, SEED_ADMIN_PASSWORD, SEED_ADMIN_NAME.
```

Or insert directly in DB:

```sql
-- Use your app's password hashing (bcrypt). Example with password 'admin123':
INSERT INTO users (full_name, phone_number, role, password_hash, is_active)
VALUES ('Admin', '256700000000', 'ADMIN', '$2a$12$...', TRUE);
```

For a quick hash, run in Node: `require('bcryptjs').hashSync('yourpassword', 12)`.

### 3. Web admin dashboard

```bash
cd web
npm install
npm run dev
```

Open `http://localhost:3000`. Login with admin phone and password. (Vite proxy forwards `/api` to `http://localhost:4000`.)

### 4. Android Agent app (Flutter)

```bash
cd mobile
flutter pub get
# Android: use emulator or device. Set API base URL if not default:
# flutter run --dart-define=API_BASE_URL=http://YOUR_IP:4000
flutter run
```

Default API URL in app: `http://10.0.2.2:4000` (Android emulator localhost). For a real device, use your machine IP and run with `--dart-define=API_BASE_URL=http://192.168.x.x:4000`.

---

## Full stack with Docker

```bash
# From repo root
docker-compose up -d
# Starts: postgres (5432), backend (4000).
# Run migrations once (see above) or add to backend startup in Dockerfile.
```

Then run `web` and `mobile` locally as above.

---

## Project structure

```
fuel-loan-system/
├── backend/          # Node.js + Express (TypeScript)
│   ├── src/
│   │   ├── db/       # pool, migrations, seed
│   │   ├── middleware/ # auth, JWT
│   │   ├── routes/   # auth, riders, loans, dashboard, momo, callbacks
│   │   ├── services/ # auth, rider, loan, payment, momo (MTN, Airtel)
│   │   ├── cron/     # hourly penalty job
│   │   └── index.ts
│   └── package.json
├── web/              # React (TypeScript) – Admin dashboard
│   └── src/
├── mobile/           # Flutter – Agent app
│   └── lib/
├── docker-compose.yml
└── README.md
```

---

## API overview

- **Auth:** `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/register` (ADMIN only).
- **Riders:** `GET /api/riders/search?q=`, `GET /api/riders`, `GET /api/riders/:id`, `POST /api/riders`, `PATCH /api/riders/:id` (admin).
- **Loans:** `POST /api/loans`, `GET /api/loans/active`, `GET /api/loans/overdue`, `GET /api/loans/:id`, `POST /api/loans/:id/payments`, `PATCH /api/loans/:id/admin-adjust` (ADMIN).
- **Dashboard:** `GET /api/dashboard/kpis`, `GET /api/dashboard/reports/loans` (ADMIN).
- **MoMo STK:** `POST /api/momo/stk-push` (body: `loan_id`, `provider`: MTN | AIRTEL).
- **Callbacks (no auth):** `POST /api/callbacks/mtn`, `POST /api/callbacks/airtel` – store raw payloads, match to loans, prevent duplicate processing; admin can manually override via loan adjustments.

---

## Business rules (summary)

- **Loan duration:** 24 hours.
- **Service charge:** 10% one-time → Initial due = principal × 1.10.
- **Penalty:** 5% every 24h overdue, compound; stop when total_penalty ≥ 50% of principal.
- **Rider suspension:** After 72 hours overdue.
- **One active/overdue loan per rider.**
- **Partial payments allowed.** Penalties applied by hourly cron (Africa/Kampala).

---

## Environment variables

**Backend (`.env`):**

- `DATABASE_URL` – PostgreSQL connection string.
- `JWT_SECRET` – Secret for JWT signing.
- `PORT` – API port (default 4000).
- MTN: `MTN_MOMO_SUBSCRIPTION_KEY`, `MTN_MOMO_API_KEY`, `MTN_MOMO_API_USER`, `MTN_MOMO_ENVIRONMENT`, `MTN_MOMO_CALLBACK_BASE_URL`.
- Airtel: `AIRTEL_CLIENT_ID`, `AIRTEL_CLIENT_SECRET`, `AIRTEL_ENVIRONMENT`, `AIRTEL_CALLBACK_BASE_URL`.

**Web:** Uses Vite proxy to `/api` → backend; no extra env required for local.

**Mobile:** `API_BASE_URL` (dart-define) for backend URL.

---

## Tests

```bash
cd backend
npm test
```

Runs unit tests for loan logic (initial due, penalty cap, next penalty, compound penalty).

---

## Security notes

- Passwords hashed with bcrypt (12 rounds).
- JWT for Admin & Agent; no rider login.
- Input validation on all APIs; env for secrets.
- Duplicate payment prevention via callback audit and processed flag.
- Admin manual override supported via loan admin-adjust and manual payment recording.

---

## Mobile Money

- **MTN MoMo / Airtel:** STK push initiated via `POST /api/momo/stk-push`. Callbacks hit `/api/callbacks/mtn` and `/api/callbacks/airtel`; payloads stored in `payment_callbacks`; matching to loans by reference (e.g. `loan_<id>_...`) and amount; duplicate processing prevented by checking processed flag. Configure callback URLs in provider dashboards to point to your backend.

No USSD. No mock data unless you add it for local testing.
