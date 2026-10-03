# SQL Server persistence

TypeORM manages the SQL Server connection pool, migrations and transactions. Explicit parameterized queries provide predictable joins, locks, aggregates and pagination. No schema synchronization, automatic database recreation or destructive rollback is allowed.

Business tables: Users, Roles, UserRoles, Customers, CustomerPreferences, CustomerGuests, Trips, Flights, Accommodations, ServiceCategories, Services, ServiceOptions, ServiceRequests, ServiceRequestHistory, Itineraries, ItineraryItems, Notifications, AuditLogs and SystemSettings.

Supporting tables: AuthSessions, PasswordResetTokens, Messages and TypeORM's SchemaMigrations. Domain tables include CreatedAt, UpdatedAt, CreatedBy and UpdatedBy. IDs use uniqueidentifier, prices decimal(12,2), experience dates date, UTC timestamps datetime2, and text nvarchar.

Unique indexes protect account emails, role/category names, user-role pairs, user/customer links, preferences, trip itineraries, request numbers, request-linked itinerary items and setting keys. Foreign keys protect the relational core. Query indexes cover customer/date trips, catalog order, request status/date, history, notifications, messages and audit chronology.

Request numbering uses SQL Server IDENTITY, never MAX+1. It may contain gaps after rollbacks and expands beyond six digits without truncation.

Request creation and status changes commit request/history/itinerary/notification/audit together. A locked row and required Version prevent lost status updates. Refresh-token rotation and password recovery are transactional. Customer/user creation and multi-step trip/catalog changes also use transactions.

## Production permissions
Use a release login for DDL and a separate runtime login limited to this database's necessary SELECT/INSERT/UPDATE/DELETE operations. Never grant sysadmin to the API. After migrations, allow SELECT/INSERT and deny UPDATE/DELETE on append-only AuditLogs and ServiceRequestHistory to the runtime principal.

Back up before release and verify restore access. Migrations run once per release, never on web startup. Define session/reset/message/log retention with business operations; the application does not silently purge history. Local setup grants db_owner only inside the two development/test databases, for migrations and tests. This is not the recommended production runtime privilege.
