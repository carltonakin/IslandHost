# IslandHost One
**Your islands. One seamless experience.**

Concierge and Jamaica marketplace software for Island Host Concierge Services: a Next.js customer and staff interface, a NestJS REST API, and actual Microsoft SQL Server persistence. The frontend never substitutes mock records for API failures.

## Application overview
Includes customer and staff workspaces, cookie authentication, role restrictions, customer profiles/preferences/guests, trips with flights and accommodation, editable SQL-backed categories/services/options, requests and status history, an operations board, generated/manual itineraries, notifications, concierge messages, global search, users/roles/settings, audit records and a live Command Center.

Also includes public discovery at `/explore`, guest/member trip planning at `/my-trip`, staff/supplier booking confirmation, quote/invoice/receipt pages, confirmed-only checkout and recorded manual payments/refunds. Existing supplier, transport/dispatch and communication APIs remain available. Online card charging, WhatsApp/SMS, flight tracking, accounting and external CRM integrations are not configured. See [marketplace implementation and verification](docs/marketplace-transformation.md) for current scope and deployment requirements.

## Architecture and technology stack
- `src/app/`, `src/components/`, `src/views/`, `src/lib/`: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, React Query.
- `src/server/`: NestJS 11 API, authentication, business services and TypeORM persistence.
- `database/`: Microsoft SQL Server migrations and documentation.
- `docs/`: API, security, deployment and verification notes.
- `tests/`: unit, SQL integration and browser acceptance suites.
- `scripts/`: shared startup, standalone asset preparation and optional Windows setup.

This repository is one npm project: one root `package.json`, lockfile, `node_modules` and `.env`. Run all commands from `IslandHost/`. There are no npm workspaces or nested app packages. The UI and API run as two coordinated processes because they use different server frameworks.

TypeORM owns SQL Server connections, pooling, migrations and transactions. Domain services use parameterized T-SQL through a small persistence adapter for explicit joins, locking and pagination. No schema synchronization or destructive automatic migrations are enabled. No Azure, PostgreSQL, MySQL, Redis, Docker or Kubernetes is required.

Browser requests use relative `/api` paths; Next.js forwards them to the environment-configured `API_URL`. Modules load on demand. Queries are cached/deduplicated, lists are paginated, and catalog images use local assets or configured HTTPS hosts. Public listing images are displayed directly; private catalog images use Next.js optimization. Catalog managers can upload, preview, replace and choose photos in the service editor. See [service photo uploads](docs/service-photo-uploads.md) for usage and persistent storage setup.

## Prerequisites
Node.js 22+ (24 LTS recommended), npm, Microsoft SQL Server 2017+, and a database-scoped SQL login. Production needs HTTPS and SMTP. SQL Server 2017+ is required by STRING_AGG. The optional local Windows driver requires ODBC Driver 17 and msnodesqlv8; SmarterASP.NET uses the standard TCP driver.

## Install and run
Open a terminal in the repository root (`IslandHost`, beside this README):

```sh
npm ci
```

For a fresh checkout, copy `.env.example` to `.env`, configure SQL Server and the required secrets, then run `npm run db:migrate`. Existing local configuration should be retained. To add development sample accounts, set `SEED_PASSWORD` and run `npm run db:seed`.

```sh
npm run dev
```

This starts both the web app and API. Open `http://localhost:3000/explore` for public discovery or `http://localhost:3000/login` for the existing workspace with the example configuration. Stop both with Ctrl+C. Use `npm.cmd` instead of `npm` if PowerShell blocks the npm script under its execution policy.

To run the compiled app:

```sh
npm run build
npm start
```

`npm start` starts both services and requires a successful build. Runtime behavior still uses your `.env`; local development database settings remain suitable for local verification only. Database migrations and seeding are explicit commands, never part of startup. Development uses ts-node in transpile-only mode to preserve Nest's decorator metadata without running a full type check at startup. Run `npm run typecheck` separately; production builds always check types.

## Microsoft SQL Server configuration
Create an empty database and a SQL login through SQL Server administration or your hosting panel. Set DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME and DB_PASSWORD. Use the exact SmarterASP.NET database host from its panel. Production requires DB_ENCRYPT=true and DB_TRUST_CERTIFICATE=false.

For a local Windows SQL instance only, this optional script creates new IslandHostOne_Dev and IslandHostOne_Test databases, a login scoped to those databases, and an ignored .env with random secrets:
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-local.ps1
```
It requires local SQL administrator rights and refuses to overwrite an existing .env or these databases. It does not change SQL Server protocols or restart services. The shared-memory native driver is development-only and is rejected in production.

## Environment variables
The root .env or process environment supplies configuration. Real .env files, local email, logs and runtime artifacts are ignored.

| Variable | Purpose |
| --- | --- |
| NODE_ENV | development, test, production |
| APP_URL | Public frontend origin; CSRF validation and reset links |
| API_URL | Nest API origin; must be correct before building Next.js |
| API_PORT / API_BIND_HOST | API port (4000 by default) / loopback binding; API_URL must point here |
| WEB_BIND_HOST | Web binding (0.0.0.0 by default) |
| PORT / WEB_PORT | Public web port when running both services; defaults to the port in APP_URL, then 3000. API-only startup also accepts PORT, including an IIS named pipe. |
| DB_HOST / DB_PORT / DB_DATABASE / DB_USERNAME / DB_PASSWORD | SQL Server connection |
| DB_ENCRYPT / DB_TRUST_CERTIFICATE | Production: true / false |
| JWT_SECRET / JWT_REFRESH_SECRET | Distinct random values, at least 48 characters each |
| COOKIE_SECURE | Required true in production |
| TRUST_PROXY | Enable only behind the intended single trusted proxy |
| SWAGGER_ENABLED | Explicit local documentation switch; disabled in production |
| SEED_PASSWORD | Explicit development password, at least 12 characters |
| SEED_ADMIN_EMAIL / SEED_CUSTOMER_EMAIL | Development account addresses |
| MAIL_MODE | file locally; smtp in production |
| SMTP_HOST / SMTP_PORT / SMTP_SECURE / SMTP_USER / SMTP_PASSWORD / SMTP_FROM | Password recovery mail |
| SERVICE_IMAGE_HOSTS | Approved HTTPS image hosts, comma separated |
| SERVICE_UPLOAD_DIR | Persistent service photo directory; defaults to uploads/service-photos under the app root |
| TEST_DB_DATABASE | Separate database ending in _Test |
| ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME | One-time administrator bootstrap |

Generate a secret with `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64'))"`. Generate JWT secrets separately. Never commit or share production secrets in chat.

## Database migrations
```sh
npm run db:migrate
```
Applied migrations are recorded in SchemaMigrations. Repeating the command does not recreate tables. Migrations are transactional and explicit; they never run automatically on web startup. Destructive down migrations are disabled. Back up production first and run migrations as a single release task.

## Seed instructions
```sh
npm run db:seed
```
Requires development/test mode and SEED_PASSWORD. Creates realistic Nassau services, a guest and trip, requests, itinerary, preferences, notifications and messages in SQL Server. Repeating a successful seed does not duplicate it. Production seeding is prohibited.

Development accounts use the configured SEED_PASSWORD:
- SuperAdmin: SEED_ADMIN_EMAIL, default `admin@islandhost.example`
- Management: `management@islandhost.example`
- ConciergeAgent: `concierge@islandhost.example`
- Customer: SEED_CUSTOMER_EMAIL, default `guest@islandhost.example`

There is no hardcoded password. The local setup script stores its generated password only in the ignored .env.

For production: migrate, securely set ADMIN_EMAIL/ADMIN_PASSWORD, run `npm run admin:create`, then remove those temporary environment variables. Create customer accounts through Customers and team accounts through Users.

## Development startup
```sh
npm run dev
```
Open APP_URL (the example uses frontend port 3000 and API port 4000). A local shared-memory SQL connection may need execution outside a restricted sandbox.

This workspace has a verified portable Node runtime under the root .tools directory. If Node is not on PATH, `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local.ps1` locates it automatically.

## Production build
```sh
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run build
```
Outputs are `dist/server` and `.next`, including `.next/standalone/server.js`. The build copies public and static assets into standalone output automatically. Set production API_URL before the web build because rewrites are generated then. See the deployment guide for required files and runtime configuration.

## Testing
Unit tests cover password and workflow invariants. The integration suite runs HTTP acceptance tests against actual Microsoft SQL Server, refuses the main application database, and requires a separate database ending in _Test. It retains uniquely named test records for inspection; it never drops a database.

Integration checks cover login, cookies, CSRF, customer/service/trip creation, permissions and ownership, request numbering, status history, stale updates, itinerary confirmation/rescheduling/cancellation, notifications, search isolation, messages, refresh replay, logout and password recovery.

With the locally seeded frontend and API running, install a browser once with `npx playwright install chromium`, then run `npm run test:browser`. The suite exercises desktop and mobile navigation and creates a uniquely named trip and request in the development database. It uses the development seed credentials from .env and never requires a production account. Reports are stored in .runtime/browser-report.

In this prepared Windows workspace the browser is already installed under the root .tools/browsers directory. The browser configuration detects that directory automatically; `PLAYWRIGHT_BROWSERS_PATH` can override it. Keep runtime logs, browser traces, screenshots and local email private; they can contain account and guest information.

See [verification](docs/verification.md) for actual results, including browser checks and remaining release checks.

## SmarterASP.NET deployment preparation
Use a plan supporting Node.js 22+, persistent Next.js and NestJS processes, Microsoft SQL Server, HTTPS, environment configuration, proxy routing and SMTP. No deployment is implied by a local build. The exact hosting account and production credentials still need configuration.

- [Deployment instructions](docs/deployment.md)
- [API and workflows](docs/api.md)
- [Database design](database/README.md)
- [Security and permissions](docs/security.md)
- [Verification record](docs/verification.md)

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the web app and API for development |
| `npm run build` | Compile the API and build the web app |
| `npm start` | Start both compiled services |
| `npm run dev:api` / `npm run dev:web` | Start one service for debugging |
| `npm run start:api` / `npm run start:web` | Start one compiled service for separate hosting |
| `npm run build:api` / `npm run build:web` | Build one service |
| `npm run db:migrate` / `npm run db:seed` | Explicit database setup |
| `npm run lint` / `npm run typecheck` | Check source quality and types |
| `npm test` / `npm run test:integration` / `npm run test:browser` | Run the test suites |

If a port is occupied, stop the existing app or configure distinct ports. Keep `APP_URL` consistent with the public web address and `API_URL` with the API address. `PORT` changes only the web port when starting both services; it cannot make them fight over the same port. Changing `API_URL` requires rebuilding the compiled web app.
