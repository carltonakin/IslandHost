# Verification

## Single-project consolidation — 2026-10-03

The app now runs from the repository root with one package manifest, lockfile and dependency install. UI code is under `src/app`, `src/components`, `src/lib` and `src/views`; API code is under `src/server`. Existing local configuration and database records were retained. Dependency versions were preserved during lockfile consolidation.

Verified locally with Windows, Node.js 24.21.0, npm 11.19.0, the existing Microsoft SQL Server and Chromium:

| Check | Result |
| --- | --- |
| `npm ci --no-audit --no-fund` | Clean install passed: 687 packages |
| `npm run lint` | Passed after removing two unused imports |
| `npm run typecheck` | Passed for the UI, API and tests |
| `npm test` | 3 unit tests passed |
| `npm run test:integration` | 10 SQL acceptance tests passed |
| `npm run build` | API and Next.js standalone builds passed; static/public assets copied |
| Development launcher | Login and proxied SQL health returned HTTP 200; both services stopped after the check |
| `npm start` | Starts both compiled services; login returned HTTP 200 and proxied health returned `ok` |
| Startup failure handling | Conflicting ports rejected; invalid test API configuration stopped both processes with exit code 1 |
| `npm run test:browser` | All 7 desktop/mobile tests passed in 1.8 minutes against `npm start` |
| Fresh local SQL driver | Connected successfully; no application migrations pending |
| File and ignore checks | All tracked application files accounted for; credentials, build output and runtime artifacts remain ignored |

Development API startup uses ts-node's transpile-only mode with decorator metadata. Full type checking remains a separate command and runs during production builds. The first install and development compilation were slow on this filesystem; Next.js also reported slow filesystem access. No system security or SQL Server configuration was changed.

Browser checks covered customer/staff navigation, account boundaries, mobile layouts and a complete trip/request/confirmation workflow. The in-app browser connection timed out, so verification used the repository's existing Playwright suite and installed local Chromium. Browser configuration now detects `.tools/browsers` automatically.

Integration checks used the separate test database. Browser checks retained their uniquely named test trip and request in the development database. Private logs, reports and previous-layout artifacts remain under ignored `.runtime/`. No deployment was performed.

## Earlier verification — 2026-09-29

Verified locally on **2026-09-29** using Windows, Node.js 24.21.0, Microsoft SQL Server 2025, and Chromium.

## Results

| Check | Result |
| --- | --- |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm test` | 3 unit tests passed |
| `npm run test:integration` | 10 acceptance tests passed against real SQL Server |
| `npm run build` | NestJS and Next.js production builds passed |
| `npm run test:browser` | 7 desktop/mobile browser tests passed; final run 52.3 seconds |
| `npm audit --omit=dev` | 0 reported production dependency vulnerabilities |
| Local API and frontend | Health endpoint returned ok; standalone frontend served successfully |
| Swagger/OpenAPI | 24 request schemas available, including nested service options and cookie authentication |

The frontend was rebuilt after the final selector/accessibility correction; its compilation and TypeScript checks passed. The backend was rebuilt after the final bounded staff search change.

## Verified behavior

The SQL suite covers authentication, HttpOnly cookies, origin checks, role restrictions and ownership, customer/service/trip creation, validated filters and date ranges, request creation/numbering, status transitions/history, notifications, audit records, search isolation, messages, session rotation/replay/logout, and password reset/change revocation.

Two simultaneous confirmation attempts produce one successful update and one conflict. Exactly one itinerary entry is created. Rescheduling, cancellation, repeat confirmation and authorized manual entries are checked.

The browser suite uses the actual frontend, NestJS API and SQL records. It covers the customer overview/catalog/preferences/itinerary, staff command center/operations/request details, navigation persistence and mobile drawers, and restricted routes. Its complete workflow creates a trip with flight details, submits a service request, signs in as staff, reviews/confirms it and verifies the generated itinerary entry.

Desktop viewport: 1440 x 1000. Mobile: iPhone 13 viewport/touch emulation in Chromium, not a physical iOS device. Customer/catalog/profile and staff pages include horizontal overflow assertions. Customer desktop/mobile screenshots were visually reviewed.

The in-app browser tool could not initialize in this environment, so browser verification used a separate local Playwright Chromium session.

## Data and artifacts

Integration tests use only IslandHostOne_Test, refuse the application's main database, and retain uniquely named test records. Browser tests use the seeded IslandHostOne_Dev application and retain uniquely named trips and requests. No database was dropped or recreated.

The local SQL shared-memory driver is development-only. Production uses TypeORM's normal SQL Server TCP driver. The existing SQL Server protocols and service configuration were preserved.

Private local artifacts are ignored: .runtime/browser-report, .runtime/browser-results, screenshots/logs, .local-mail and .env. Browser setup waits for frontend/API readiness; development or test mode is required. Allow the login rate-limit window to clear before immediately repeating a full browser run.

## Remaining deployment verification

No live SmarterASP.NET deployment was performed. The specific hosting plan, Node/process support, production SQL credentials, proxy routing, DNS/HTTPS, Secure cookies, live SMTP delivery, backups and process supervision require deployment configuration and staging checks described in [deployment.md](deployment.md).

Local acceptance is not a load test or an independent penetration test. Multiple API workers require shared throttling or a trusted upstream limiter. Payment gateways, WhatsApp/SMS, AI, live flight tracking, vendor/driver portals and the other specified Phase 2 integrations remain intentionally deferred.
