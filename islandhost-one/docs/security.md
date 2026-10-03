# Authentication and permissions

Passwords use scrypt (N=32768, r=8, p=3), random 32-byte salts and a 64-byte hash, with constant-time comparison. New passwords require 12–128 characters.

Access JWTs last 15 minutes. Refresh tokens and SQL sessions last seven days. Distinct signing secrets, issuer and audience are checked. Rotation locks the session row and replaces a stored SHA-256 digest. Tokens are only in HttpOnly, SameSite=Lax cookies; Secure is required in production. Every API request checks the current SQL session, active user and current roles.

Mutations require an exact APP_URL Origin. CORS allows only that origin. Session revocation is immediate on logout, password changes and role changes. Frontend navigation permissions supplement, rather than replace, backend guards and record ownership checks.

Reset tokens are random, hashed, single-use and expire in 30 minutes. Forgot password returns a generic public response. Local email is written to ignored .local-mail files; production requires SMTP. Tokens, SQL parameters and credentials are excluded from server error logs.

| Role | Permissions |
| --- | --- |
| SuperAdmin | All; accounts, roles and settings |
| Management | Operations, requests, customer/trip/itinerary/catalog writes, audit read |
| OperationsManager / ConciergeAgent | Operations, requests, customer/trip/itinerary writes |
| Dispatcher | Operations read, request/itinerary writes |
| Finance | Operations read only |
| Customer | Owned records and customer actions |
| Vendor / Driver | No operational access; portals deferred |

Roles are centrally defined. Users cannot deactivate themselves or remove their own administrative access. Auth material is never stored in localStorage; only navigation preference is persisted there.

Queries are parameterized and bounded. API errors are sanitized. Login/reset routes have tighter rate limits. The throttler is in-process: use a single API worker with a trusted upstream rate limiter, or add shared SQL-backed throttling before horizontally scaling. TRUST_PROXY must reflect the real proxy topology.

Local acceptance does not establish production security. Verify HTTPS, production cookies, SMTP, permissions, backups, host routing and operational monitoring in staging.
