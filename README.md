# Dispatchly — ITIL-Aligned IT Service Desk

Full-stack incident & knowledge base management system built with React 19, Node.js/Express 5, and PostgreSQL.

## Features
- **Ticket Intake & Classification** — Incident vs. Service Request, P1–P4 priority, department/location tracking
- **Live SLA Engine** — On Track / At Risk / Breached status with countdown, per priority tier (P1=1h, P2=4h, P3=8h, P4=72h)
- **Triage & Escalation Workflow** — Status pipeline (New → In Progress → Escalated → Resolved → Closed), category-based Tier 2 team routing
- **Knowledge Base** — Convert resolved tickets to searchable KB articles with tags, symptoms, and resolution steps
- **Dashboard** — SLA health, open ticket breakdown by priority/status/category, average resolution time

## Tech Stack
- **Frontend**: React 19, React Router v7, Tailwind CSS v4 (`@tailwindcss/vite`), date-fns, Vite 8
- **Backend**: Node.js, Express 5, node-postgres (`pg`)
- **Database**: PostgreSQL 18 (required) — migrations run via a lightweight custom `pg`-based runner (no ORM)
- **Tooling**: Biome (lint + format) across frontend and backend

## Getting Started

### Prerequisites
- Node.js 26+ and npm 10+
- PostgreSQL 18 (required) — this is the only supported/maintained version; older releases are not supported

### 1. Database setup

If you don't already have PostgreSQL installed, install and start **PostgreSQL 18**:

```bash
# macOS (Homebrew)
brew install postgresql@18
brew services start postgresql@18

# Ubuntu/Debian
sudo apt install postgresql-18
sudo systemctl enable --now postgresql
```

Confirm the server is running and on the expected version:

```bash
psql --version          # should report 18.x
pg_isready              # should report "accepting connections"
```

Create the application role and database. The defaults in `.env.example` use the `postgres`
role — create a dedicated role/password instead and update `.env` to match if you prefer:

```bash
# Create the database (uses your current OS user by default)
createdb dispatchly

# Optional: create a dedicated role with a password
psql -d dispatchly -c "CREATE ROLE dispatchly WITH LOGIN PASSWORD 'yourpassword';"
psql -d dispatchly -c "GRANT ALL PRIVILEGES ON DATABASE dispatchly TO dispatchly;"
psql -d dispatchly -c "ALTER SCHEMA public OWNER TO dispatchly;"
```

The schema itself is created later by the migrations (`npm run migrate` in the Backend step).

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your DB credentials
npm run migrate       # applies all pending migrations
npm run seed          # loads demo data
npm run dev           # starts on http://localhost:3001
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev           # starts on http://localhost:5173
```

The frontend proxies `/api/*` to the backend automatically.

## Database Migrations
Migrations target **PostgreSQL 18** and are plain `.js` modules exporting `up(client)` /
`down(client)`, executed by a custom `pg`-based runner (`backend/src/db/migrate.js`) — no
Knex/ORM. Applied migrations are tracked in a `schema_migrations` table. Files live in
`backend/migrations/` and run in alphabetical (i.e. numeric-prefix) order:
1. `001_create_tickets.js` — tickets table
2. `002_create_escalations.js` — escalations table
3. `003_create_ticket_comments.js` — ticket_comments table
4. `004_create_kb_articles.js` — kb_articles + kb_tags tables
5. `005_add_kb_link_to_tickets.js` — add kb_article_id FK to tickets

```bash
cd backend
npm run migrate          # apply all pending migrations
npm run migrate:down     # roll back the last applied migration
npm run migrate:status   # list applied / pending migrations
```

## API Endpoints

### Tickets
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tickets` | List tickets (filterable) |
| POST | `/api/tickets` | Create ticket |
| GET | `/api/tickets/:id` | Get ticket with comments + escalations |
| PATCH | `/api/tickets/:id` | Update ticket fields |
| POST | `/api/tickets/:id/escalate` | Escalate to Tier 2 |
| POST | `/api/tickets/:id/comments` | Add comment |
| POST | `/api/tickets/:id/convert-to-kb` | Convert resolved ticket to KB article |

### Knowledge Base
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/kb` | List KB articles (searchable) |
| POST | `/api/kb` | Create article |
| GET | `/api/kb/:id` | Get article |
| PATCH | `/api/kb/:id` | Update article |
| DELETE | `/api/kb/:id` | Delete article |

### Dashboard
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dashboard` | Aggregated stats |

## Linting & Formatting
Both `backend` and `frontend` use [Biome](https://biomejs.dev/) (config in `biome.json`):

```bash
npm run lint     # report lint issues
npm run format   # auto-format ./src in place
npm run check    # combined lint + format check
```
