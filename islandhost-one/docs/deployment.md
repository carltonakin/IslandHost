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
5. Deploy backend/dist, database/migrations, workspace manifests and production dependencies. Preserve the backend/database sibling structure. With migration credentials, run `node backend/dist/database/cli.js migrate` from the deployment root.
6. Bootstrap an administrator once via `node backend/dist/database/cli.js admin` with explicit ADMIN_EMAIL/ADMIN_PASSWORD. Remove bootstrap variables afterward. Never run the development seed.
7. Start `node backend/dist/main.js` under the host supervisor. It honors PORT, including a named pipe; otherwise configure API_PORT/API_BIND_HOST.
8. Use the host's supported Next.js launch configuration or standalone output. For this workspace copy frontend/public into frontend/.next/standalone/frontend/public, and frontend/.next/static into frontend/.next/standalone/frontend/.next/static. Start frontend/.next/standalone/frontend/server.js, retaining its directory structure.
9. Route browser traffic through Next.js and its /api proxy. Forward Origin and Set-Cookie correctly. Do not cache API responses or expose an alternate insecure backend URL. Configure only the intended trusted proxy.
10. Validate readiness, login/logout/refresh, live SMTP recovery, customer ownership, confirmation/itinerary/notification updates, mobile navigation and Secure cookies.
11. Verify persistent process restarts, log rotation, backups, monitoring and forward recovery procedures.

Migrations never run automatically on application startup and destructive down migrations are disabled. No Azure, Redis, Docker or Kubernetes is required. This local build does not provision a hosting account, production database, public DNS/TLS or SMTP service.

## Railpack deployment

Use two services to retain the existing frontend/API separation. Set each service's root directory to `islandhost-one`, which contains the npm workspace manifest and lockfile.

| Service | Build command | Start command | Bind address |
| --- | --- | --- | --- |
| API | `npm run build -w backend` | `npm run start` | `API_BIND_HOST=0.0.0.0` |
| Frontend | `npm run build -w frontend` | `npm run start:frontend` | `HOSTNAME=0.0.0.0` |

Railpack installs dependencies from the lockfile. Override its build command per service as above, or use the default root `npm run build` to build both workspaces. Root `start` delegates to the existing backend `node dist/main.js`; it does not launch the frontend. Each service uses its own platform-provided `PORT`.

The frontend build includes a postbuild step that copies `public` and `.next/static` into `.next/standalone/frontend`. Its start command runs the generated `.next/standalone/frontend/server.js`. Retain the full standalone directory, including its traced dependencies. See [Next.js standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output) and [Railpack Node.js scripts](https://railpack.com/languages/node/).

Configure `API_URL` to the backend address reachable from the frontend service **before building the frontend**. The existing API rewrite captures that address at build time, so changing it requires a rebuild. Use the public HTTPS frontend URL for `APP_URL`, and configure the API's production database, JWT, cookie and SMTP settings as described above. Use the default SQL Server driver over TCP for deployment; the optional Windows native driver is restricted to local development. Run migrations explicitly before release.
