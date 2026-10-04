# SQL migration runbook and verification report

Report date: 2026-10-03. **The hosted SQL database migration is complete and verified. The public IIS application deployment remains pending.** The provided protected migration password authenticated successfully using encrypted TCP with certificate verification. The source data was backed up and transferred to the requested target.

Target: `sql8011.site4now.net`, database `db_9aa62b_islandhost`, login `db_9aa62b_islandhost_admin`. Public site: https://carlitoh-001-site8.dtempurl.com/.

## Architecture and findings

The app already uses Microsoft SQL Server through TypeORM/mssql with pooled connections, parameterized SQL and explicit transactions. The original source is the local `IslandHostOne_Dev` database, accessed through the Windows native development driver. Production uses the existing normal TCP driver with verified TLS. No ORM, database engine, language, authentication scheme or API contract was replaced.

The consolidated repository has one npm manifest/lockfile: Next/React UI in `src/app`, `src/components`, `src/lib`, `src/views`; Nest API in `src/server`; SQL definitions in `database/migrations`. Root `npm run build` executes both `build:api` and `build:web`. `npm start` supervises the two runtime processes. The document's former `-w backend` and `-w frontend` commands no longer apply because there are no npm workspaces.

The audit found that existing finance, vendor, dispatch and conversations controllers/providers were absent from AppModule. They are now registered, together with the existing authenticated WebSocket gateway and Nest ws adapter. The two Nest WebSocket packages were aligned with the installed Nest core 11.2.6. The API remains protected by its existing global authentication/permission guards. Realtime remains disabled by default; REST polling is available.

The standalone packaging step also removes .env files copied by Next's dependency tracing. Deployment must receive runtime settings from the host, not the build machine's local credentials.

## Schema

The two existing TypeORM migrations, backed by `001_initial.sql` and `002_phase2.sql`, remain the schema source of truth. No replacement schema or destructive reset was introduced. They create 39 application tables plus TypeORM's SchemaMigrations table. Both migrations were already applied on the source and executed successfully on new rehearsal databases.

Source inventory: 39 primary keys, 65 foreign keys, 106 indexes including primary-key indexes, 34 additional unique indexes, 62 check constraints and 164 column defaults. Metadata comparisons check column types, lengths, decimal precision/scale, nullability, collations, computed/default expressions, keys, foreign-key actions, indexes and check constraints. Disabled/untrusted constraints and disabled indexes are rejected. DBCC CHECKCONSTRAINTS reported no violations after import.

## Original source and first rehearsal counts

Source snapshot captured at 2026-10-03T16:44:57.937Z. The following counts are the source and first rehearsal destination immediately after import. Later tests intentionally added isolated records to the rehearsal only.

| Table | Source | First rehearsal |
| --- | ---: | ---: |
| Accommodations | 6 | 6 |
| AuditLogs | 20 | 20 |
| AuthSessions | 41 | 41 |
| ConversationParticipants | 4 | 4 |
| Conversations | 1 | 1 |
| CustomerGuests | 1 | 1 |
| CustomerPreferences | 1 | 1 |
| Customers | 1 | 1 |
| Drivers | 0 | 0 |
| Flights | 12 | 12 |
| InvoiceItems | 0 | 0 |
| Invoices | 0 | 0 |
| Itineraries | 6 | 6 |
| ItineraryItems | 6 | 6 |
| Messages | 1 | 1 |
| Notifications | 19 | 19 |
| PasswordResetTokens | 0 | 0 |
| Payments | 0 | 0 |
| QuoteHistory | 0 | 0 |
| QuoteItems | 0 | 0 |
| Quotes | 0 | 0 |
| Refunds | 0 | 0 |
| Roles | 9 | 9 |
| ServiceCategories | 12 | 12 |
| ServiceOptions | 6 | 6 |
| ServiceRequestHistory | 18 | 18 |
| ServiceRequests | 7 | 7 |
| Services | 6 | 6 |
| SystemSettings | 3 | 3 |
| Transfers | 0 | 0 |
| TransferStatusHistory | 0 | 0 |
| Trips | 6 | 6 |
| UserRoles | 4 | 4 |
| Users | 4 | 4 |
| Vehicles | 0 | 0 |
| VendorAssignmentHistory | 0 | 0 |
| VendorAssignments | 0 | 0 |
| Vendors | 0 | 0 |
| VendorServices | 0 | 0 |
| **Application total** | **194** | **194** |
| SchemaMigrations (separate infrastructure) | 2 | 2 |

The source export is `.runtime/database-transfer/2026-10-03T16-44-44-640Z-aa8c2354/source.json`, with a SHA-256 sidecar. The first successful reconciliation is under `.runtime/database-transfer/2026-10-03T16-48-21-498Z-df6cc81f`. These ignored files contain private records and password/token hashes; keep them on a trusted machine and out of release uploads. They are logical application snapshots, not SQL Server full backups or point-in-time recovery media. Retain provider/native backups for operational disaster recovery.

First rehearsal database: `IslandHostOne_Transfer_20261003_114612_Test`. All 194 records matched exactly, including IDs, timestamps, status, ownership, hashes and computed fields. No records were transformed or rejected. Repeat import: 0 inserted, 194 unchanged. A deliberate existing-row conflict aborted the transaction and rolled back a preceding test insert; all original records still reconciled.

The original finance tables were empty. A second rehearsal therefore copied the first rehearsal after API workflow tests had populated finance, vendor, transport and communications records. Database `IslandHostOne_FinanceTransfer_20261003_121000_Test` received **724 records across all 39 tables**, with exact SQL text comparisons for decimals, timestamps and computed values. A repeat inserted zero records. All 17 phase-2 domain tables were nonempty. Private evidence: `.runtime/database-transfer/financial-reconciliation.json` and checksummed before/source/after snapshots.

## Identities, roles and permissions

The existing roles are SuperAdmin, Management, OperationsManager, ConciergeAgent, Dispatcher, Finance, Vendor, Driver and Customer. The request's Admin maps to SuperAdmin and Member maps to Customer. Permission mappings remain in `src/server/common/types.ts`; assignments remain in UserRoles.

All four existing users and four role assignments were preserved without password resets or demo reseeding. The original source contains one SuperAdmin and one Customer identity. Their compatible salted scrypt hashes, IDs, emails and profile fields were copied unchanged. Both authenticated successfully in the rehearsal using their existing protected local credentials; the SuperAdmin could read `/api/users`, while the Customer received 403. Logout succeeded. A subsequent comparison still matched all 194 original records. The private, credential-free evidence summary is `.runtime/database-transfer/identity-verification.json`.

## Services and application validation

- 11 unit checks passed, covering existing security helpers, production configuration and transfer safeguards.
- 14 integration workflows passed against real SQL Server: authentication/cookies/origin protection; customer ownership; customer/catalog/trip persistence; service requests, status/version handling, itinerary updates, notifications/audits; messages and password recovery; quotes/invoices; idempotent payment/refund recording; financial reports; vendor services/assignments/history; driver/vehicle/transfer/dispatch history; conversation messages/read positions and outsider denial.
- Financial verification included a 225.27 invoice/payment and 25.27 refund, checking exact business totals and duplicate-request idempotence.
- npm install completed; Nest ws packages were updated to 11.2.6 and their ws dependency resolved to 8.21.2. npm reported unapproved optional install scripts; the existing local native SQL binary worked in all SQL checks.
- Lint and API/UI type checks passed. Root production build passed, including both API compilation and Next standalone output. A prior build attempt hit a Windows file lock from the old running preview; stopping that known workspace process resolved it.
- Compiled root npm start passed against the migrated local test database: /login 200, /api/health 200, unauthenticated /api/auth/me 401 and empty same-origin login POST 400. All 7 desktop/mobile browser tests passed on the rebuilt app.

The production startup path uses `web.config` -> `node scripts/run.cjs start`, with IIS PORT assigned to Next and API_PORT assigned to Nest. The prepared configuration retains the account-specific LOCALAPPDATA/NEXT_SWC_PATH values supplied by the user. The local compiled startup uses development SQL/cookie/mail settings; it is not evidence of a successful hosted production startup.

## Hosted verification and blockers

At 2026-10-03T17:11:09Z, a direct HTTP check returned `/login` 200, `/api/health` 500, `/api/auth/me` 500 and an empty, same-origin `/api/auth/login` POST 500. The API responses were plain `Internal Server Error`, without the normal JSON envelope. No account password was submitted to the host. This establishes that the hosted API path is failing before a normal authentication response; it does not prove the exact cause.

The target database has been authenticated and migrated: 39 application tables and both migration-history entries are present, and all 194 original records were inserted and reconciled. Hosted runtime SQL/JWT/SMTP settings, deployment access and the server startup log are still needed to finish public application verification. No repository changes have been uploaded to SmarterASP.NET. Live SMTP delivery, IIS WebSockets and login through the public IIS site remain unverified. The following section records the direct hosted-database verification separately.

See [the exact environment checklist](smarterasp-environment.md) for Required/Optional, Build/Runtime, purposes, safe examples and configuration locations. See [deployment instructions](deployment.md) for IIS logging and API diagnostics.

## Execute the real transfer

1. Keep DB_* pointing at the approved source. Add MIGRATION_DB_PASSWORD to the trusted process environment or ignored local .env. The default migration destination is the requested SmarterASP SQL database; optional overrides are documented in the environment checklist. Never put passwords in command arguments.
2. Pause application writes to both source and destination for the final export/import/verification window. The current snapshot is a rehearsal point in time. Export fresh data at cutover; the importer does not merge changed business records automatically.
3. From the repository root, run `npm run db:export`. Preserve the printed snapshot path and its SHA-256 sidecar. The source must have both known migrations applied.
4. Run `npm run db:transfer -- --snapshot <source-snapshot-path>`. This connects with encrypted TCP and certificate verification, backs up destination application rows/metadata before migrations, applies the existing migrations, imports parents before children in a transaction, preserves explicit identity values/counters and performs full reconciliation plus constraint checks. It does not disable constraints, overwrite conflicts or silently discard records.
5. Run `npm run db:transfer:verify -- --snapshot <source-snapshot-path>` before reopening writes. A successful verification reports exact matches for every source row. Extra preexisting destination records are retained and reported in counts. Schema or row conflicts stop with a safe table/row diagnostic; inspect private snapshots to resolve them deliberately. An existing destination with no recognized migration history is backed up and rejected without guessed baselining.
6. An unchanged snapshot can be transferred again: already-identical primary keys are skipped. If a production row has since changed, rerunning aborts instead of overwriting it. The schema migration transaction and import transaction are separate; a failed import can leave successfully applied, non-destructive schema migrations in place. Retain the before snapshot and migration history for recovery review.
7. Configure the host using the environment checklist; set API_URL before `npm run build`. Deploy only the release files listed in deployment.md, preserving their paths. Do not deploy .runtime, .local-mail, .tools, test snapshots or the local .env. With production dependencies only, compiled equivalents are `node dist/server/database/transfer-cli.js export`, `transfer --snapshot <path>` and `verify --snapshot <path>`.
8. Recycle the hosted app and verify `/api/health` returns JSON 200, unauthenticated `/api/auth/me` returns JSON 401, and an empty same-origin login POST returns JSON 400. Then verify both existing identities, member/admin isolation and representative persisted CRUD. Do not claim cutover complete until these checks pass against the hosted target.

Do not run `db:seed` or `admin:create` for this migration: the importer preserves the existing identities. Demo seeding remains prohibited in production. No existing database was dropped or reset. Both isolated local rehearsal databases and private snapshots remain available for review.

## Changed implementation

- `src/server/database/transfer.ts`, `transfer-cli.ts`: private snapshots, schema/data validation, parent-first transactional imports, conflict protection and reconciliation.
- `src/server/database/data-source.ts`: accepts a separate environment for destination connectivity without replacing source configuration.
- `package.json`, `package-lock.json`: export/transfer/verify commands and compatible Nest ws dependencies.
- `src/server/app.module.ts`, `bootstrap.ts`: register the existing persistence services and ws adapter.
- `src/server/config.ts`, `main.ts`, `web.config`: production driver validation and safe startup diagnostics/IIS launch configuration.
- `scripts/prepare-standalone.cjs`: exclude copied environment files from standalone deployment artifacts.
- `tests/integration/phase2.spec.ts`, `tests/unit/config.spec.ts`, `tests/unit/transfer.spec.ts`: regression coverage.
- `.env.example`, `.gitignore`, database/deployment/migration/environment documentation: safe operator setup and evidence.
## Completed hosted database transfer

A fresh source backup captured the same 194 records before contacting the destination. The destination initially contained no application tables. Its empty-state snapshot is under `.runtime/database-transfer/2026-10-03T21-19-51-220Z-a1219a7c`; the fresh source snapshot is in that directory too.

Both existing schema migrations completed. The first import exposed a driver-specific IDENTITY_INSERT scope issue and rolled back without keeping partial data. The importer now enables IDENTITY_INSERT and inserts the explicit sequence in the same parameterized SQL request, which preserves IDs through the TCP driver's SQL execution scope. Rollback error handling also preserves the original failure if SQL Server has already aborted the transaction. A regression check covers that error path.

The successful hosted run is `.runtime/database-transfer/2026-10-03T21-28-08-753Z-ba99fb26`. It contains destination-before and destination-after snapshots, SHA-256 sidecars and reconciliation.json. **39 tables, 194 inserted, 0 preexisting rows skipped; all 194 source records matched exactly after import.** The source/first-rehearsal count table above also gives the hosted destination counts immediately after import. Schema metadata and DBCC constraint validation passed. No source record was rejected or transformed. Both source migration history entries are present in the destination. All four users, nine roles and four role assignments were preserved.

Hosted identity/CRUD checks passed at 2026-10-03T21:33:27Z using the compiled API on the trusted local machine connected to the hosted SQL database with verified TLS. Both original identities exist exactly once and logged in successfully; authentication cookies were Secure and HttpOnly. SuperAdmin received 200 from /api/users; Customer received 403. Both could read their permitted dashboard/trips and log out. Create/read/update/delete were verified within a rolled-back SystemSettings transaction, leaving no test business record. All 194 original records still matched after these checks. Two new, revoked authentication sessions remain as verification history, bringing application rows to 196 and AuthSessions to 43. Evidence: .runtime/database-transfer/hosted-database-verification.json. This does not claim a successful login through IIS.

Release package: `.runtime/releases/islandhost-smarterasp-20261003-163533.zip`. See [upload steps](smarterasp-upload.md) and [production environment template](smarterasp.env.example). The standalone output was scanned across 2,251 compiled/runtime files (about 48 MiB): no copied environment files or literal configured secrets were found. A separate review of tracked/reviewable files likewise found no configured secret values; no commit was created.

After the database migration, the public check at 2026-10-03T21:32:39Z still returned plain HTTP 500 for all three API probes; the login-page GET timed out on that attempt. The earlier login-page GET returned 200. The hosted application remains unverified and needs the release/configuration update; the database migration alone did not resolve the public API failure.
