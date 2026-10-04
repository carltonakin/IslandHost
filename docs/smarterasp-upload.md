# Deploy this verified build to SmarterASP.NET

This package contains the compiled Nest API, Next standalone web app, SQL migration definitions, root launcher and IIS web.config. It contains no private .env, database backup, password, test records or workstation tools. Root API dependencies are installed separately on the host.

The database db_9aa62b_islandhost on sql8011.site4now.net has already received the source schema and 194 original records. Do not run demo seeding or create another administrator. Read docs/sql-migration.md for the full verification report.

1. Back up the existing website files and retain the host's private configuration. Extract this package into the site's application root, with package.json and web.config at that root. Preserve .next/standalone and dist/server paths; do not deploy only the web folder.
2. Use Node.js 22 or newer. From the application root, install the pinned runtime dependencies with:

   npm ci --omit=dev --omit=optional

   The prebuilt web folder contains its traced dependencies. The API uses the normal SQL TCP driver, so the optional local Windows SQL driver is unnecessary. This release is already built; no npm workspace commands or host-side Next build are needed.
3. Set the required hosted environment variables from docs/smarterasp-environment.md. If using a private root .env, copy docs/smarterasp.env.example there and fill its blank DB/JWT/SMTP values. Do not use or upload the workstation .env. Host environment values take precedence. IIS supplies PORT through web.config; keep API_PORT=4000 and API_URL=http://127.0.0.1:4000 to match this web build. A different API_URL requires rebuilding the web app on the trusted build machine.
4. The supplied web.config retains the account-specific LOCALAPPDATA/NEXT_SWC_PATH paths from the original configuration. Confirm those paths exist and are writable for the site. Recycle the site. HttpPlatformHandler starts node scripts/run.cjs start, equivalent to npm start, which launches both API and web.
5. Confirm /login returns 200 and /api/health returns JSON 200. Unauthenticated /api/auth/me should return JSON 401; an empty same-origin POST to /api/auth/login should return JSON 400. Then sign in with the existing administrator and member credentials. Validate member/admin access boundaries and SMTP password recovery.
6. If the API path still returns a plain 500, inspect the private islandhost-node.log/provider-suffixed log after recycling. Configuration errors name the missing setting; API connection errors include safe codes. Keep the log private and configure rotation or disable temporary stdout logging after diagnosis.

The public IIS application has not been updated by this package's preparation. Local builds, browser tests and the hosted SQL migration do not by themselves establish that the site has been deployed successfully. This is a Windows build prepared for the requested Windows hosting account.
