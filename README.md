# Cricket Association Management & Live Scoring Platform

Official digital administration, governance, and live cricket scoring platform for Cricket Association / District Federation (Affiliated to TNCA).

The platform provides a comprehensive Node.js/Express + MongoDB backend with real-time Socket.IO synchronization, paired with a modern Expo/React Native cross-platform web and mobile frontend.

---

## Architecture Overview

- **Backend**: Node.js (v20+), Express.js, MongoDB (Mongoose), Socket.IO for real-time live match updates, Zod request body validation, JWT security, and Brevo/Resend/SMTP email services.
- **Frontend**: Expo SDK 58, React 19, React Native Web, Expo Router, responsive mobile-first stylesheets, and SweetAlert2 notifications.
- **Data Stores**: MongoDB database (`cricket_db`), indexed collections for tournaments, matches, innings, deliveries, players, teams, scorers, and audit logs.
- **Production Web Build**: Expo Web export (`npx expo export -p web`) served via Docker / Nginx reverse proxy.

---

## Directory Structure

```text
Cricket-Association/
├── backend/
│   ├── config/             # Database connection, indexer, mailer
│   ├── controllers/        # Request controllers (admin, auth, portal, scorer, tournament)
│   ├── docs/               # API documentation (REST endpoints, Socket.IO events)
│   ├── middleware/         # Auth, RBAC, Zod validation, rate limiting, CORS
│   ├── models/             # Modular Mongoose schemas (User, Match, Innings, etc.)
│   ├── routes/             # Express API routes
│   ├── services/           # Scoring engine, role-based auth, socket dispatch
│   │   ├── auth/           # Sub-services: admin, scorer, player, team, umpire
│   │   └── scoring/        # Sub-services: delivery, innings, wickets, extras, undo
│   ├── tests/              # Automated test suites (unit, logic, security, speed, validation)
│   └── server.js           # Server bootstrap, compression, security headers
├── mobile_frontend/
│   ├── src/
│   │   ├── admin/          # Role-based admin management console
│   │   ├── app/            # Expo Router file-based screens
│   │   ├── components/     # Reusable UI widgets, scorecards, headers
│   │   └── services/       # API client and Socket.IO real-time client
│   └── public/             # Optimized assets, responsive CSS, manifest
├── scripts/
│   ├── backup_mongo.sh     # Automated MongoDB dump & archive utility
│   ├── restore_mongo.sh    # Automated MongoDB restore utility
│   ├── start.bat           # Windows dev runner
│   └── dev-only/           # Development and database seeding utilities
└── .github/workflows/
    └── ci.yml              # GitHub Actions CI pipeline
```

---

## Environment Variables

### Backend Configuration (`backend/.env`)

| Variable Name | Required | Example Value | Description |
|---|---|---|---|
| `PORT` | Optional | `5000` | Port for the backend Express server (default `5000`). |
| `NODE_ENV` | Yes | `production` | Environment mode (`development`, `test`, or `production`). |
| `MONGODB_URI` | Yes | `mongodb://127.0.0.1:27017/cricket_db` | MongoDB connection URI with database name. |
| `JWT_SECRET` | Yes | `super_secret_jwt_key_here` | Secret string for signing and verifying JWT tokens. |
| `ADMIN_INITIAL_EMAIL` | Production | `superadmin@cfvd.org` | Initial Super Admin email seeded on first startup. |
| `ADMIN_INITIAL_PASSWORD`| Production | `SecurePassphrase123!` | Initial Super Admin password seeded on first startup. |
| `ALLOWED_ORIGINS` | Optional | `https://cricket.yourdomain.com` | Comma-separated list of additional allowed CORS origins. |
| `BREVO_API_KEY` | Optional | `xkeysib-...` | Brevo HTTPS API key for reliable transactional email delivery. |
| `RESEND_API_KEY` | Optional | `re_...` | Resend HTTPS API key for transactional email fallback. |
| `SMTP_HOST` | Optional | `smtp.gmail.com` | SMTP host address for email delivery. |
| `SMTP_PORT` | Optional | `465` | SMTP port (465 for SSL/TLS, 587 for STARTTLS). |
| `SMTP_USER` | Optional | `cricketfederation21@gmail.com` | SMTP username or Gmail address. |
| `SMTP_PASS` | Optional | `app_password_here` | SMTP password or Google App Password. |
| `SMTP_FROM` | Optional | `"Cricket Federation" <admin@cfvd.org>` | Outgoing sender display name and email address. |

### Frontend Configuration (`mobile_frontend/.env`)

| Variable Name | Required | Example Value | Description |
|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | Yes | `http://localhost:5000` | Base URL of the backend REST API. |
| `EXPO_PUBLIC_SOCKET_URL` | Optional | `http://localhost:5000` | Base URL of the Socket.IO live scoring server. |

---

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- MongoDB 7.0 or higher
- npm or bun

### 1. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your MongoDB URI, JWT_SECRET, and admin credentials
npm run dev
```

The backend server will start on `http://localhost:5000`.

### 2. Frontend Setup

```bash
cd mobile_frontend
npm install
npm run web
```

The Expo dev server will start on `http://localhost:8081`.

---

## Running with Docker

You can run both the backend and frontend using Docker Compose:

```bash
# Build and start all services (Backend, Frontend, MongoDB)
docker-compose up --build -d

# Check running containers
docker-compose ps

# View backend logs
docker-compose logs -f backend

# Stop services
docker-compose down
```

---

## Testing & Quality Assurance

### Run Backend Automated Tests (70+ tests)
```bash
cd backend
npm test
```
The test suite validates:
1. Core cricket scoring engine & lifecycle (46 tests)
2. Cricket logic audits (NRR, DLS, strike rotation, all out calculations)
3. Critical and high-severity security boundaries (CORS, token gates, RBAC)
4. Speed & scalability (compression, caching headers, db indexes)
5. Request body schema validation & error formatting (Zod)

### Run Backend Linting
```bash
cd backend
npm run lint
```

### Run Frontend Typecheck
```bash
cd mobile_frontend
npx tsc --noEmit
```

### Build Production Frontend Web Bundle
```bash
cd mobile_frontend
npx expo export -p web
```

---

## Database Backup and Restore

Production database utilities are available in the `/scripts` directory.

### Create a Backup
```bash
# Creates a timestamped gzipped backup in backups/
./scripts/backup_mongo.sh

# Or specify a custom target directory:
BACKUP_DIR=/var/backups/cricket_db ./scripts/backup_mongo.sh
```

### Restore a Backup
```bash
# Restores the database from a backup directory
./scripts/restore_mongo.sh backups/mongo_20261123_120000/cricket_db
```

*Note: The backup and restore scripts utilize `mongodump` and `mongorestore` when available, and automatically fallback to Node.js JSON extraction if native CLI database tools are not installed on the host.*

---

## License

This software is developed for the Cricket Federation of Virudhunagar District (CFVD) affiliated to Tamil Nadu Cricket Association (TNCA). All rights reserved.
