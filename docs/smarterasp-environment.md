# SmarterASP.NET environment checklist

Audited against the repository on 2026-10-03. The deployment root is this repository's root, with one package.json and one lockfile. Next.js serves the UI and proxies `/api/*` to Nest. `npm start` launches both processes; IIS assigns the public web port and the API listens on a separate loopback port.

Enter the required runtime values in SmarterASP.NET's protected application environment, inherited by the process in web.config. If this plan exposes no environment editor, use a private root `.env` excluded from source control and public downloads. The checked-in web.config contains only non-secret process settings. Do not upload the workstation `.env`: it selects a local development database and file mail.

Set API_URL in the trusted build environment as well as the hosted runtime. It is server-only, but Next embeds its value in the build's proxy configuration. Browser requests use relative `/api` URLs. Rebuild after changing API_URL or SERVICE_IMAGE_HOSTS. Do not point API_URL back at the public Next site.

## Production application variables

Examples in angle brackets are placeholders, not literal values. "Runtime" includes the API started by the root launcher. Requirements below refer to this application's production validation and the supplied single-site IIS configuration.

| Variable | Required/Optional | Build/Runtime | Purpose | Safe example | Where to configure |
| --- | --- | --- | --- | --- | --- |
| NODE_ENV | REQUIRED | RUNTIME | Enable production validation | `production` | Hosted environment; already set by web.config |
| APP_URL | REQUIRED | RUNTIME | Public origin for CSRF, CORS, password recovery and launcher | `https://carlitoh-001-site8.dtempurl.com` | Hosted environment |
| API_URL | REQUIRED | BUILD_AND_RUNTIME | Next proxy destination; API validates presence | `http://127.0.0.1:4000` | Build environment AND hosted environment |
| PORT | REQUIRED for IIS | RUNTIME | Public web port assigned by HttpPlatformHandler | `%HTTP_PLATFORM_PORT%` | Supplied web.config; do not hardcode a public port |
| API_PORT | OPTIONAL; default 4000 | RUNTIME | Separate API listener, matching API_URL | `4000` | Hosted environment; recommended explicit |
| API_BIND_HOST | OPTIONAL; default loopback | RUNTIME | API listener address | `127.0.0.1` | Supplied web.config |
| WEB_BIND_HOST | OPTIONAL; launcher defaults to all interfaces | RUNTIME | Web listener behind IIS | `127.0.0.1` | Supplied web.config |
| WEB_PORT | OPTIONAL | RUNTIME | Fallback when PORT is absent | `3000` | Local or non-IIS environment; omit on SmarterASP |
| DB_HOST | REQUIRED | RUNTIME | Target SQL Server | `sql8011.site4now.net` | Hosted secret/configuration environment |
| DB_PORT | OPTIONAL; default 1433 | RUNTIME | SQL TCP port | `1433` | Hosted environment |
| DB_DATABASE | REQUIRED | RUNTIME | Target database | `db_9aa62b_islandhost` | Hosted environment |
| DB_USERNAME | REQUIRED | RUNTIME | SQL login | `db_9aa62b_islandhost_admin` | Hosted environment; preferably use a restricted runtime login after migration |
| DB_PASSWORD | REQUIRED; secret | RUNTIME | SQL authentication | `<database-password>` | Hosted secret environment only |
| DB_DRIVER | OPTIONAL; normal TCP driver by default | RUNTIME | Driver selection | `tcp` | Omit or use tcp; native is rejected in production |
| DB_ENCRYPT | REQUIRED in production | RUNTIME | Encrypt SQL connection | `true` | Hosted environment |
| DB_TRUST_CERTIFICATE | OPTIONAL; defaults false, true prohibited in production | RUNTIME | Require valid SQL certificate | `false` | Hosted environment; recommended explicit |
| JWT_SECRET | REQUIRED; secret, at least 48 characters | RUNTIME | Sign access tokens | `<random-access-signing-secret>` | Hosted secret environment only |
| JWT_REFRESH_SECRET | REQUIRED; secret, at least 48 characters, different from JWT_SECRET | RUNTIME | Sign refresh tokens | `<different-random-refresh-secret>` | Hosted secret environment only |
| COOKIE_SECURE | REQUIRED in production | RUNTIME | HTTPS-only authentication cookies | `true` | Hosted environment |
| MAIL_MODE | REQUIRED in production | RUNTIME | Password recovery transport | `smtp` | Hosted environment |
| SMTP_HOST | REQUIRED in production | RUNTIME | SMTP server | `smtp.example.com` | Hosted environment |
| SMTP_FROM | REQUIRED in production | RUNTIME | Verified sender | `IslandHost <no-reply@example.com>` | Hosted environment |
| SMTP_PORT | OPTIONAL; default 587 | RUNTIME | SMTP submission port | `587` | Hosted environment |
| SMTP_SECURE | OPTIONAL; false for STARTTLS on 587 | RUNTIME | Implicit TLS, usually for port 465 | `false` | Hosted environment; match mail provider |
| SMTP_USER | OPTIONAL; required if provider requires authentication | RUNTIME | SMTP login | `<smtp-user>` | Hosted secret environment |
| SMTP_PASSWORD | REQUIRED when SMTP_USER is set; secret | RUNTIME | SMTP authentication | `<smtp-password>` | Hosted secret environment only |
| TRUST_PROXY | OPTIONAL; default false | RUNTIME | Trust exactly one proxy hop when true | `false` | Hosted environment; change only after verifying the actual proxy chain |
| SWAGGER_ENABLED | OPTIONAL; production always disables it | RUNTIME | Development API documentation | `false` | Hosted environment |
| SERVICE_IMAGE_HOSTS | OPTIONAL | BUILD_AND_RUNTIME | Comma-separated allowed HTTPS image hosts | `images.example.com` | Build AND hosted environment; omit for local assets |
| PAYMENT_PROVIDER | OPTIONAL; default manual | RUNTIME | Record externally settled payments/refunds | `manual` | Hosted environment; manual is the only implemented adapter |
| REALTIME_ENABLED | OPTIONAL; default false | RUNTIME | Authenticated WebSocket refresh events | `false` | Hosted environment; leave disabled until IIS/WebSocket proxy path is verified |
| LOCALAPPDATA | OPTIONAL; retained from supplied site configuration | BUILD_AND_RUNTIME | Writable Windows application data directory | `<site-root>\AppData\Local` | web.config, and build environment if building on host |
| NEXT_SWC_PATH | OPTIONAL; retained from supplied site configuration | BUILD_AND_RUNTIME | Existing account's Next SWC override | `<site-root>\AppData\Local` | web.config; confirm it matches the installed runtime if building on host |

DB_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET and SMTP_PASSWORD must never be NEXT_PUBLIC variables. No database variable belongs in client components or public assets. DATABASE_URL, DB_SERVER, DB_NAME, DB_USER and NEXT_PUBLIC_API_URL are not consumed by this repository. Use DB_HOST, DB_DATABASE and DB_USERNAME exactly as above.

## One-time transfer environment

Keep the source DB_* configuration on the trusted migration machine. These MIGRATION_* variables select the destination without replacing source settings. They are runtime inputs to the transfer command, not build inputs and not necessary in the hosted app after migration.

| Variable | Required/Optional | Build/Runtime | Purpose | Safe example | Where to configure |
| --- | --- | --- | --- | --- | --- |
| MIGRATION_DB_PASSWORD | REQUIRED; secret | RUNTIME | Destination SQL password | `<target-database-password>` | Trusted migration process environment or ignored local .env |
| MIGRATION_DB_HOST | OPTIONAL; defaults to requested server | RUNTIME | Destination server | `sql8011.site4now.net` | Trusted migration environment |
| MIGRATION_DB_DATABASE | OPTIONAL; defaults to requested database | RUNTIME | Destination database | `db_9aa62b_islandhost` | Trusted migration environment |
| MIGRATION_DB_USERNAME | OPTIONAL; defaults to requested SQL login | RUNTIME | Destination migration login | `db_9aa62b_islandhost_admin` | Trusted migration environment |
| MIGRATION_DB_PORT | OPTIONAL; default 1433 | RUNTIME | Destination TCP port | `1433` | Trusted migration environment |

Normal transfer mode enforces TCP, encryption and certificate verification. `--rehearsal` is restricted to localhost and a distinct database ending in `_Test`.

## Existing identities and development-only inputs

The source already has the administrator (SuperAdmin) and member (Customer) identities. Transfer preserves their IDs, profile fields, salted scrypt hashes and role assignments. No seed password is required for the transfer and no account is duplicated or reset.

| Variable | Required/Optional | Build/Runtime | Purpose | Safe example | Where to configure |
| --- | --- | --- | --- | --- | --- |
| ADMIN_EMAIL | OPTIONAL; required only for admin:create | RUNTIME | Explicit bootstrap for a genuinely new installation | `administrator@example.com` | Temporary protected bootstrap environment only; not used for this transfer |
| ADMIN_PASSWORD | OPTIONAL; required only for admin:create; secret | RUNTIME | Bootstrap account password | `<strong-bootstrap-password>` | Temporary secret environment only |
| ADMIN_NAME | OPTIONAL | RUNTIME | Bootstrap display name | `Administrator` | Temporary bootstrap environment |
| SEED_PASSWORD | OPTIONAL; required only for development demo seed; secret | RUNTIME | Local demo/test accounts | `<development-only-password>` | Local ignored .env, never production |
| SEED_ADMIN_EMAIL | OPTIONAL | RUNTIME | Local demo administrator email | `admin@example.test` | Local development/test environment only |
| SEED_CUSTOMER_EMAIL | OPTIONAL | RUNTIME | Local demo customer email | `member@example.test` | Local development/test environment only |
| TEST_DB_DATABASE | OPTIONAL; required for SQL integration tests | RUNTIME | Isolated SQL database ending in _Test | `IslandHostOne_Test` | Local test environment only |

SEED_ADMIN_PASSWORD, SEED_MEMBER_EMAIL and SEED_MEMBER_PASSWORD from the request's candidate list are not read by the application. The existing hashes are compatible, so no fallback password implementation was added. Production demo seeding remains prohibited.