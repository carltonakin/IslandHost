# SmarterASP.NET deployment

The application targets Node-capable SmarterASP.NET hosting with Microsoft SQL Server. Confirm the specific plan's runtime and process support before release:
- [Provider Node hosting](https://www.smarterasp.net/nodejs_hosting)
- [Provider Node quick start](https://www.smarterasp.net/support/kb/a1970/quick-start-node_js.aspx)
- [Next.js self hosting](https://nextjs.org/docs/app/guides/self-hosting)
- [TypeORM SQL Server options](https://typeorm.io/docs/drivers/microsoft-sqlserver/)

## Hosting assumptions
Node.js 22+, persistent frontend and API Node processes/sites or equivalent supported routing, HTTPS, environment variables, SQL/SMTP connectivity, writable Next.js cache, and one-off migration execution. Do not assume an older shared-host/iisnode configuration supports current Next.js. If the assigned plan cannot run the stack, resolve that plan limitation without replacing the required stack.

## Release
1. Back up SQL Server and verify restore access. Prepare staging first.
2. Create a production database, a migration login and a separate restricted runtime login.
3. Configure production APP_URL/API_URL, DB variables, distinct JWT secrets, COOKIE_SECURE=true, DB_ENCRYPT=true, DB_TRUST_CERTIFICATE=false, MAIL_MODE=smtp and SMTP. Disable Swagger. Exclude native local-driver configuration, seed credentials, .local-mail and test artifacts.
4. On a trusted build machine run npm ci, lint, typecheck, tests using a separate test database, and npm run build. Set API_URL correctly before building.
5. Deploy dist/server, database/migrations, scripts, package.json, package-lock.json, .next/standalone and production dependencies. Preserve these paths relative to the deployment root. With migration credentials, run `node dist/server/database/cli.js migrate` from the deployment root.
6. Bootstrap an administrator once via `node dist/server/database/cli.js admin` with explicit ADMIN_EMAIL/ADMIN_PASSWORD. Remove bootstrap variables afterward. Never run the development seed.
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
