# Island One marketplace implementation

## Repository audit and reuse map

| Area | Existing implementation | Extension |
| --- | --- | --- |
| Discovery | Services, ServiceCategories, ServiceOptions; private catalog UI | Public /explore, explicit publication, destination/location, gallery, amenities, supplier and booking policies |
| Trips | Customer-owned Trips with dates and travelers | Reuse as the itinerary owner/date envelope; preserve all existing records |
| Itineraries | One Itineraries row per Trip; scheduled ItineraryItems | Add booking states, server-confirmed total, expiry, version, payment state and history to those same items |
| Guest planning | None | Browser draft with a random reference; validated transactional import after existing cookie authentication |
| Suppliers | Vendors, VendorServices, VendorAssignments and linked Vendor accounts | Reuse Vendors for listings and restrict supplier confirmation to its own assigned items |
| Finance | Quotes, Invoices, Payments, Refunds; manual provider only | InvoiceBookings and PaymentAllocations link existing financial documents to exact confirmed items; centralized eligibility at checkout and payment recording |
| Operations | Requests, transport/dispatch, notifications, conversations, audit | Keep existing APIs; prevent legacy request changes from bypassing marketplace booking validation |
| UI | Customer/staff portal and shared forms | Add My Trip, booking queue, suppliers and finance pages while retaining existing workspace routes |

The new public destination is Jamaica, as requested. Existing Bahamas records retain their destination and are not automatically published. Currency remains USD because existing finance constraints require it. Confirmed prices are final inclusive totals for the entire booking, not a browser-calculated price or per-person unit price.

Migration 003 is additive: it extends Services, Itineraries and ItineraryItems; adds BookingHistory, InvoiceBookings and PaymentAllocations; adds an optional itinerary FK and idempotency fields to Invoices. It adds only missing marketplace categories, not invented supplier listings. No production migration or seed runs at application startup.

## Payment boundary

There is no configured online merchant account. Customer checkout prepares an invoice only from eligible confirmations; it does not claim to charge a card. Authorized Finance staff record externally verified settled payments through the existing manual provider. Receipt and booking payment state change only with that recording. A future gateway must call this same eligibility/settlement boundary after verified provider confirmation. Customer-facing redirects or claims cannot settle an invoice.

Legacy invoices remain available. Collection now requires linked confirmed bookings with matching final totals; request-linked invoices can attach their confirmed itinerary item during recording. Unlinked manual invoices must be linked by Finance first. Confirmation is no longer inferred from receiving money.

Guest drafts contain planning inputs only. Import validates every listing/option/date and derives the signed-in customer on the server. A unique guest reference prevents duplicate import, and an already-owned reference cannot move a trip to another customer.
## API and user interface

All API routes below use the existing `/api` prefix and response envelope. Write operations retain Origin checks, cookie sessions, DTO validation and SQL transactions.

| Area | Routes / behavior |
| --- | --- |
| Public listings | `GET /marketplace/categories`, `/marketplace/listings`, `/marketplace/listings/:id`; allowlisted display fields, published/active filters, category/search/destination/location and pagination |
| Personal plans | `GET/POST /trip-plans`, `POST /trip-plans/import`, `GET/PATCH /trip-plans/:id`; customer identity comes from the session |
| Items | `POST /trip-plans/:id/items`, `PATCH /bookings/:id`; no browser-supplied price/status accepted; cancellation retains history |
| Decisions | `PATCH /bookings/:id/status` requires current Version; staff with bookings.manage or owning active Vendor can confirm/reject; customer can submit/change/cancel |
| Queue/history | `GET /bookings`, `GET /bookings/:id/history`; ownership and role restrictions apply |
| Checkout | `GET /trip-plans/:id/checkout` calculates payable items; `POST` accepts ItemIds and IdempotencyKey only and creates an existing-format invoice |
| Legacy invoice linkage | `GET /invoices/:id/booking-options`, `POST /invoices/:id/bookings`; Finance links matching confirmed totals before recording payment |
| Settlement | Existing `/payments` and `/refunds` routes; server reloads linked bookings and checks status, expiry, version, ownership/Trip and exact amount inside the settlement transaction |

New UI modules are `src/views/marketplace.tsx`, `trip-builder.tsx`, `bookings.tsx` and `finance.tsx`, plus the shared marketplace shell and browser draft utility. The existing catalog editor handles publication, destination, gallery, supplier and booking terms. The existing logo and blue/teal/gold theme remain in use. Existing dashboard, requests, trips, private catalog and itinerary routes are retained. Login links to public discovery and returns a guest draft to My Trip.

Quotes/invoices/payments/refunds have role-scoped portal navigation and printable documents. Supplier records reuse Vendors and existing Vendor login accounts; the new queue appears for those accounts. A quote approval is a commercial approval only: marketplace availability remains pending until an explicit booking confirmation.

## Booking lifecycle

- Add to trip -> PLANNED. Submit -> PENDING_CONFIRMATION.
- Authorized staff/owning supplier confirms final inclusive USD total, reference, conditions and optional future UTC expiry -> CONFIRMED. Reject requires a reason -> REJECTED.
- Unpaid CONFIRMED items become effectively EXPIRED at the stored deadline. Eligibility checks expiry on each read/payment; no scheduled worker is required. Already-settled bookings retain confirmation after the payment deadline.
- Material date/time/quantity/party/option/pickup/drop-off changes clear confirmation and invalidate any unpaid checkout invoice. A confirmed item becomes CHANGE_REQUESTED; resubmission becomes RECONFIRMING. A changed pending request also requires reconfirmation. Notes alone preserve confirmation and the invoice version link.
- A new confirmation is required before a changed item becomes payable. Cancellation retains the record with CANCELLED and Active=false; authorized completion requires CONFIRMED.
- Paid items cannot be collected again, including after refunds. Changing a settled booking does not automatically refund money. Reconfirmation at a different net price requires Finance handling; automated repricing of paid bookings is outside this release.

BookingHistory records transitions, actor, notes and snapshots. Existing ServiceRequests stay connected for operations/dispatch. Once managed by the booking workflow, direct legacy status changes cannot bypass confirmation. Existing manual activity and trip-date mutations share the itinerary lock.

## Payment integrity

Checkout derives the sum from database ConfirmedPrice values in integer cents. A booking is eligible only when active, CONFIRMED, unexpired, positively priced, referenced, unpaid and not reserved on a different invoice. The invoice carries exact InvoiceBookings IDs, versions and amounts. PaymentAllocations links settlement to those same items; refunds update allocation balances.

Checkout, edits, invoice cancellation and settlement serialize on the same SQL itinerary application lock. SQL unique constraints and idempotency keys protect retries. A changed selection cannot reuse a checkout key. Stale versions fail with 409. Checkout reserves selected items; cancellation/change releases all unpaid reservations on the invalidated invoice. Immediately before recording settlement, server validation repeats against current database rows. No browser success URL creates a receipt.

New linked payments must settle the exact selected invoice balance; choose fewer confirmed items for a smaller checkout. Historical deposits and partially paid invoices are preserved, but cannot bypass the new confirmation/whole-selection rule for further collection. Review those cases with Finance before cutover. Legacy invoice totals must match the inclusive confirmed booking totals.

## Verification

Local verification on October 4-5, 2026:

- Backend and frontend type checks and repository lint passed.
- 24 unit tests passed, including all non-payable statuses, expiry boundary, settled booking behavior, invoice reservation and material-change rules.
- 22 real SQL integration tests passed across all three suites. New coverage includes published listing discovery, guest import/replay/ownership, planned editing/cancellation, price injection, planned/pending/rejected/expired rejection, member and unrelated supplier denial, owning supplier decisions, reconfirmation/invoice invalidation, exact confirmed totals, concurrent checkout/payment retries, exact payment/refund allocations, quote approval without booking confirmation and a settlement-versus-edit race.
- 9 launcher tests passed, including IIS assigned-port handoff, invalid-port rejection and coordinated processes.
- The root build produced the Nest API and Next standalone app. Both are started using the root launcher; `/explore`, `/login` and SQL-backed `/api/health` respond locally.
- 2 new browser workflows passed at desktop and iPhone-size viewports: public search/detail -> guest plan -> reload -> sign-in/import -> request -> staff confirmation -> confirmed invoice -> manual verified payment -> exact receipt. Horizontal overflow and browser runtime errors are checked. A new-trip dialog regression is covered.
- 7 existing portal browser regressions passed: customer overview/catalog/preferences/itinerary, staff operations, navigation/access boundaries, and the existing trip/request confirmation flow.

The browser tests use the real compiled app and local SQL Server, not mocked responses. Their temporary listings are unpublished/deactivated afterwards. Test trip, payment and audit records are retained in the local development database only. SQL integration tests use the distinct `_Test` database. Receipt tests exercise the manual provider with explicitly named test settlements; no money is transferred.

The optimized web build runs with NODE_ENV=production. The local API uses compiled JavaScript with the existing development SQL driver/configuration. This does not establish hosted HTTPS, production TCP/TLS, SMTP, merchant processing or IIS readiness. The Browser plugin could not initialize because of a Windows sandbox error; repository Playwright performed the browser checks.

## Migration result

Migration `Marketplace1791158400000` applied successfully to the separate integration database and the backed-up **local development** database. The private pre-migration snapshot is `.runtime/marketplace-before.json` with a SHA-256 sidecar; do not upload it with the app. The verification report is `.runtime/marketplace-migration-result.json`.

All 199 rows across the original 39 tables retained every pre-existing column value. The migration added three tables and 14 missing categories: 42 tables and 213 rows immediately after migration. No pending migration remained. Table ordering and the updated transfer utility's complete 42-table allowlist were checked. These counts precede browser test fixtures. Existing Bahamas data is neither erased nor presented as Jamaica inventory.

## Deployment

This feature is **not deployed to SmarterASP.NET** by this work. The prior hosted port/DLL startup issue remains an independent, unresolved hosting check. Preserve the existing outage notes in `smarterasp-upload.md` and confirm the correct physical application root and IIS-assigned port before claiming recovery.

1. Back up the hosted database and site; retain the private hosted `.env`. Test this release against a staging copy first, especially old unpaid/partially-paid invoices. Do not run demo seeding.
2. Stop/recycle the app pool for the release. Upload the matched root `dist/server`, `.next/standalone` (including static/public assets), `database/migrations`, `scripts`, package/lock files, and the current `web.config`. Older branding-only or port-only archives are not this release. Exclude `.runtime`, `.tools`, snapshots, workstation `.env`, test output and logs.
3. Keep the existing production TCP SQL, verified TLS, HTTPS/secure cookies and SMTP configuration. This web build targets `http://127.0.0.1:4000`; API_URL changes require a rebuild. Install pinned API runtime dependencies with `npm ci --omit=dev --include=optional` if needed.
4. With the private hosted environment configured and the site stopped, run `node dist/server/database/cli.js migrate` from the application root. This compiled command works without host devDependencies. Run it once as the release task using the appropriate migration login; do not add it to every application startup.
5. Start the site through the matching web.config/root launcher and verify `/api/health`, `/explore`, sign-in, a customer-owned draft, staff/supplier confirmation, change/reconfirmation and an unpaid confirmed invoice. Confirm rejected/expired items cannot be collected. Verify SMTP separately. Use controlled staging settlements for receipt testing, never invented production payments.
6. Have staff add real Jamaica listings under Services: select destination/category/supplier, enter verified price/availability/terms and owned or licensed images, then mark **Published in marketplace** and Active. The new categories alone do not create inventory. Set PaymentInstructions in existing Settings for your real bank/concierge collection process.

The additive migration has no destructive down operation. Do not reverse it by dropping columns or tables. Preserve backups and use the host's established recovery process if deployment fails.

## Remaining work

- Populate and approve real Jamaica content, supplier accounts, cancellation policies and images. The public collection intentionally starts empty instead of inventing production businesses.
- Select/onboard a merchant provider for the existing Bahamas business/bank and implement its hosted checkout plus authenticated webhook reconciliation through this same eligibility/allocation boundary. No provider credentials or online charging endpoint are configured here.
- Complete staging/SmarterASP validation and resolve the previously reported startup failure. No production database or hosting account was changed in this task.
- Currency remains USD. Mixed currencies, automated supplier inventory, automated paid-booking price adjustments, partial collection of a single booking, and automatic invoice/receipt email delivery are future work. Current documents can be printed/saved as PDF; existing in-app notifications are used.

## Service photo follow-up (2026-10-05)

Service editors now support device uploads, main-photo selection, gallery previews, replacement and removal. This follow-up reuses Services.Image and Services.Images; it adds no migration beyond the marketplace release. See [photo upload instructions, persistent storage and release checks](service-photo-uploads.md). Install runtime dependencies with optional platform packages included, and preserve/back up photo storage across deployments.
