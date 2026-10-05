# SQL Server persistence

TypeORM manages the SQL Server connection pool, migrations and transactions. Explicit parameterized queries provide predictable joins, locks, aggregates and pagination. No schema synchronization, automatic database recreation or destructive rollback is allowed.

Business tables: Users, Roles, UserRoles, Customers, CustomerPreferences, CustomerGuests, Trips, Flights, Accommodations, ServiceCategories, Services, ServiceOptions, ServiceRequests, ServiceRequestHistory, Itineraries, ItineraryItems, Notifications, AuditLogs and SystemSettings.

Phase 2 tables: Quotes, QuoteItems, QuoteHistory, Invoices, InvoiceItems, Payments, Refunds, Vendors, VendorServices, VendorAssignments, VendorAssignmentHistory, Drivers, Vehicles, Transfers, TransferStatusHistory, Conversations and ConversationParticipants.

Marketplace migration 003 extends Services, Itineraries, ItineraryItems and Invoices. It adds BookingHistory, InvoiceBookings and PaymentAllocations, with foreign keys, unique checkout references and booking/expiry query indexes. Existing catalog rows default to unpublished Bahamas listings; historical itinerary rows remain planned until explicitly confirmed for new collection. Original financial records are not rewritten.

Supporting tables: AuthSessions, PasswordResetTokens, Messages and TypeORM's SchemaMigrations. Domain tables include CreatedAt, UpdatedAt, CreatedBy and UpdatedBy. IDs use uniqueidentifier, catalog prices decimal(12,2), financial and confirmed totals decimal(14,2), experience dates date, UTC timestamps datetime2, and text nvarchar.

Unique indexes protect account emails, role/category names, user-role pairs, user/customer links, preferences, trip itineraries, request numbers, request-linked itinerary items and setting keys. Foreign keys protect the relational core. Query indexes cover customer/date trips, catalog order, request status/date, history, notifications, messages and audit chronology.

Request numbering uses SQL Server IDENTITY, never MAX+1. It may contain gaps after rollbacks and expands beyond six digits without truncation.

Request creation and status changes commit request/history/itinerary/notification/audit together. A locked row and required Version prevent lost status updates. Refresh-token rotation and password recovery are transactional. Customer/user creation and multi-step trip/catalog changes also use transactions.

## Production permissions
Use a release login for DDL and a separate runtime login limited to this database's necessary SELECT/INSERT/UPDATE/DELETE operations. Never grant sysadmin to the API. After migrations, allow SELECT/INSERT and deny UPDATE/DELETE on append-only AuditLogs, ServiceRequestHistory and BookingHistory to the runtime principal.

Back up before release and verify restore access. Migrations run once per release, never on web startup. Define session/reset/message/log retention with business operations; the application does not silently purge history. Local setup grants db_owner only inside the two development/test databases, for migrations and tests. This is not the recommended production runtime privilege.

## Transfer an existing installation

Use all three TypeORM migrations and the root commands `npm run db:export`, `npm run db:transfer -- --snapshot <path>` and `npm run db:transfer:verify -- --snapshot <path>`. Keep DB_* pointing at the source; MIGRATION_DB_* selects the destination. Existing user IDs, compatible password hashes and role assignments are imported idempotently, without invoking the demo seed or creating a second administrator.

See [SQL migration report and cutover runbook](../docs/sql-migration.md) for the historical pre-marketplace transfer (39 tables), backup locations, validation evidence, conflict handling and current blockers. See [SmarterASP.NET environment checklist](../docs/smarterasp-environment.md) for exact build/runtime inputs. The current schema has 42 business/support tables plus SchemaMigrations. Both source and destination must be migrated to the same schema before exporting/transferring; the transfer utility rejects mismatched schemas. See [marketplace migration verification](../docs/marketplace-transformation.md). Private snapshots are ignored under .runtime/database-transfer and must not be deployed with the app.