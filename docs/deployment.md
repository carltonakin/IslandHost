# SmarterASP.NET deployment

The application targets Node-capable SmarterASP.NET hosting with Microsoft SQL Server. Confirm the specific plan's runtime and process support before release:
- [Provider Node hosting](https://www.smarterasp.net/nodejs_hosting)
- [Provider Node quick start](https://www.smarterasp.net/support/kb/a1970/quick-start-node_js.aspx)
- [Next.js self hosting](https://nextjs.org/docs/app/guides/self-hosting)
- [TypeORM SQL Server options](https://typeorm.io/docs/drivers/microsoft-sqlserver/)

## Hosting assumptions
Node.js 22+, persistent frontend and API Node processes/sites or equivalent supported routing, HTTPS, environment variables, SQL/SMTP connectivity, writable Next.js cache, and one-off migration execution. Do not assume an older shared-host/iisnode configuration supports current Next.js. If the assigned plan cannot run the stack, resolve that plan limitation without replacing the required stack.

## SmarterASP.NET web.config and login failures

SmarterASP.NET's [Node.js quick start](https://www.smarterasp.net/support/kb/a1970/quick-start-node_js.aspx) uses IIS HttpPlatformHandler and assigns the public Node port through `PORT=%HTTP_PLATFORM_PORT%`. The root `web.config` starts `node scripts/run.cjs start --iis-port %HTTP_PLATFORM_PORT%`; IIS expands the assigned port in that argument. The launcher validates it, supplies it to the web child as PORT, and starts the API on its separate API_PORT. Upload scripts/run.cjs first, then web.config beside package.json, retaining any additional settings your hosting account needs. It preserves the supplied site's LOCALAPPDATA/NEXT_SWC_PATH overrides; adjust those absolute paths for another account or site.

The public web server receives IIS's assigned PORT; the API uses API_PORT on loopback. There must be only one launcher instance for a fixed API port. If logs report EADDRINUSE, resolve the occupied port or select an available API_PORT and rebuild the web app with the matching API_URL.

The site tested on 2026-10-03 served `/login` with HTTP 200 while `/api/health`, `/api/auth/me`, and an empty `/api/auth/login` request returned plain HTTP 500. That means login cannot yet be diagnosed as a credentials problem: the normal API response is not reaching the browser. Possible causes include an API startup failure, the wrong upstream URL baked into the web build, or a hosting proxy error. The deployed configuration and log are needed to distinguish them. Its original web.config already invoked `npm run start`; that alone does not prove the API successfully started.

For the current site, these non-secret hosted settings should agree:

```dotenv
NODE_ENV=production
APP_URL=https://carlitoh-001-site8.dtempurl.com
API_URL=http://127.0.0.1:4000
API_PORT=4000
COOKIE_SECURE=true
DB_ENCRYPT=true
DB_TRUST_CERTIFICATE=false
MAIL_MODE=smtp
SWAGGER_ENABLED=false
```

Use the real hosted SQL Server connection and SMTP settings, with distinct JWT secrets of at least 48 characters. Remove `DB_DRIVER=native` on the host so TypeORM uses its normal TCP driver. The workstation's `.env` uses localhost, Windows shared-memory SQL and local file mail; it is not a production configuration. Keep production credentials on the host or in your deployment secret store.

Do not set API_URL to this same public web site's URL: `/api` would proxy back to itself. If the API is hosted separately, use that API's reachable origin instead. API_URL is captured during `npm run build:web`; changing only the hosted `.env` does not update a previously built rewrite.

Build the API with `npm run build:api` after startup diagnostic changes. If API_URL changed, set it correctly in the build environment and run `npm run build:web` as well. Upload `dist/server`, `scripts`, the complete `.next/standalone` directory, `database/migrations`, the root npm manifests, runtime `node_modules`, and `web.config` in their existing relative layout. Deploying only the standalone web folder does not include the Nest API. Recycle the hosted application after updating the files.

The supplied web.config logs stdout/stderr to an `islandhost-node.log` file or a provider-suffixed variant in the site root. The previous configuration used `log.txt`. Read the log after restarting and look for:

- `IslandHost ports: web=<assigned-port> source=IIS api=4000`: the updated IIS launcher received a numeric port; compare it with the subsequent Next listener log. This line reports configuration, not readiness.
- `IslandHost startup error`: fix the named port/launcher setting. An unexpanded IIS token must not be placed in .env.
- `IslandHost API configuration error`: fix the named setting; values are not logged.
- `api_start_failed`: inspect the safe error code/SQL number and database connectivity.
- `Failed to proxy` / `ECONNREFUSED`: the built API target is not accepting connections.
- `EADDRINUSE`: an API or web port is already occupied.
- SQL login, TLS, or missing-table errors: check the hosted SQL login, certificate configuration, database name and explicit migrations.

After deployment, `/api/health` must return HTTP 200 with `{"data":{"status":"ok"}}`. An empty login POST from APP_URL should return a JSON validation error (HTTP 400), and unauthenticated `/api/auth/me` should return JSON HTTP 401. Only then test real account credentials. Keep server logs private; disable temporary stdout capture or arrange rotation after troubleshooting. The local changes have not been uploaded to the hosted account.
See the [audited environment-variable checklist](smarterasp-environment.md) and [existing-data migration runbook/report](sql-migration.md) for the requested SQL target and verified local rehearsal results.

## Release
1. Back up SQL Server and verify restore access. Prepare staging first.
2. Create a production database, a migration login and a separate restricted runtime login.
3. Configure production APP_URL/API_URL, DB variables, distinct JWT secrets, COOKIE_SECURE=true, DB_ENCRYPT=true, DB_TRUST_CERTIFICATE=false, MAIL_MODE=smtp and SMTP. Disable Swagger. Exclude native local-driver configuration, seed credentials, .local-mail and test artifacts.
4. On a trusted build machine run npm ci, lint, typecheck, tests using a separate test database, and npm run build. Set API_URL correctly before building.
5. Deploy dist/server, database/migrations, scripts, package.json, package-lock.json, .next/standalone, web.config (on SmarterASP.NET) and production dependencies. Preserve these paths relative to the deployment root. With migration credentials, run `node dist/server/database/cli.js migrate` from the deployment root.
6. For an existing installation, use the transfer runbook to preserve users and roles; skip bootstrap and demo seeding. For a genuinely new empty installation only, bootstrap an administrator via `node dist/server/database/cli.js admin` with explicit ADMIN_EMAIL/ADMIN_PASSWORD. Remove bootstrap variables afterward. Never run the development seed.
7. For one host, start `npm start` under the host supervisor. It starts both services, assigns PORT to the web server and API_PORT to the API. For an API-only service, use `npm run start:api`; it honors PORT, including a named pipe, or API_PORT/API_BIND_HOST.
8. Use the host's supported Next.js launch configuration or standalone output. The build copies public and .next/static into .next/standalone automatically. `npm run start:web` starts .next/standalone/server.js, retaining its directory structure.
9. Route browser traffic through Next.js and its /api proxy. Forward Origin and Set-Cookie correctly. Do not cache API responses or expose an alternate insecure backend URL. Configure only the intended trusted proxy.
10. Validate readiness, login/logout/refresh, live SMTP recovery, customer ownership, confirmation/itinerary/notification updates, mobile navigation and Secure cookies.
11. Verify persistent process restarts, log rotation, backups, monitoring and forward recovery procedures.

Migrations never run automatically on application startup and destructive down migrations are disabled. No Azure, Redis, Docker or Kubernetes is required. This local build does not provision a hosting account, production database, public DNS/TLS or SMTP service.

## Railpack deployment

The repository root contains the single npm manifest and lockfile. Use the repository root as the service root directory.

For one service, use `npm run build` and `npm start`. The public web server binds to the platform's `PORT`; the API binds to `API_PORT` (default 4000) on loopback. Set `API_URL=http://127.0.0.1:4000` before building, adjusting it if API_PORT differs, and `APP_URL` to the public HTTPS address. The API must have a port different from the public web server. Both processes stop if either exits.

For two separately hosted services, use:

| Service | Build command | Start command | Bind address |
| --- | --- | --- | --- |
| API | `npm run build:api` | `npm run start:api` | `API_BIND_HOST=0.0.0.0` |
| Web | `npm run build:web` | `npm run start:web` | `WEB_BIND_HOST=0.0.0.0` |

Each separate service uses its own platform-provided `PORT`. Configure `API_URL` to the API address reachable from the web service before building it. The API rewrite captures that address at build time, so changing it requires a rebuild.

Retain the full `.next/standalone` directory, including its traced dependencies and copied assets. See [Next.js standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output) and [Railpack Node.js scripts](https://railpack.com/languages/node/).

Configure the production SQL Server, JWT, secure cookie and SMTP settings described above. Use the normal SQL Server TCP driver for deployment; the Windows native driver is restricted to local development. Run migrations explicitly before release.
