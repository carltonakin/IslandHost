# Verification

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
