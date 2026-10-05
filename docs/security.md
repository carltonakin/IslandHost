# Authentication and permissions

Passwords use scrypt (N=32768, r=8, p=3), random 32-byte salts and a 64-byte hash, with constant-time comparison. New passwords require 12–128 characters.

Access JWTs last 15 minutes. Refresh tokens and SQL sessions last seven days. Distinct signing secrets, issuer and audience are checked. Rotation locks the session row and replaces a stored SHA-256 digest. Tokens are only in HttpOnly, SameSite=Lax cookies; Secure is required in production. Every API request checks the current SQL session, active user and current roles.

Mutations require an exact APP_URL Origin. CORS allows only that origin. Session revocation is immediate on logout, password changes and role changes. Frontend navigation permissions supplement, rather than replace, backend guards and record ownership checks.

Reset tokens are random, hashed, single-use and expire in 30 minutes. Forgot password returns a generic public response. Local email is written to ignored .local-mail files; production requires SMTP. Tokens, SQL parameters and credentials are excluded from server error logs.

| Role | Permissions |
| --- | --- |
| SuperAdmin | All; accounts, roles and settings |
| Management | Operations, booking confirmation, customer/trip/itinerary/catalog writes, finance, supplier/dispatch management and audit read |
| OperationsManager / ConciergeAgent | Operations, booking confirmation, requests, customer/trip/itinerary writes, quotes and existing role-specific supplier access |
| Dispatcher | Operations read, request/itinerary writes |
| Finance | Operations read; quotes/invoices/payments/refunds and financial reporting; no booking confirmation |
| Customer | Owned records and customer actions |
| Vendor | Confirmation queue and history limited to bookings assigned to an active linked Vendor |
| Driver | Existing driver/dispatch APIs; dedicated portal remains outside this change |

Roles are centrally defined. Users cannot deactivate themselves or remove their own administrative access. Auth material is never stored in localStorage; navigation preferences, a customer-selected itinerary ID and unsent guest planning inputs are persisted there. No guest-local price or status is trusted. Server import derives customer ownership from the session; replay across accounts is rejected.

Queries are parameterized and bounded. API errors are sanitized. Login/reset routes have tighter rate limits. The throttler is in-process: use a single API worker with a trusted upstream rate limiter, or add shared SQL-backed throttling before horizontally scaling. TRUST_PROXY must reflect the real proxy topology.

Local acceptance does not establish production security. Verify HTTPS, production cookies, SMTP, permissions, backups, host routing and operational monitoring in staging.

## Service photos

Uploads require catalog.write (SuperAdmin/Management), cookie authentication and a matching Origin. The multipart body accepts one file, at most 5 MiB; MIME, file signature and decoded image data are checked. SVG and animated images are rejected. A 20-megapixel decode limit and 2000-pixel output bounds constrain processing; re-encoding strips embedded metadata. Uploads are rate-limited to 30/minute per the existing throttler.

Stored filenames are random UUIDs with a fixed .webp extension; client filenames are never used as paths. The public read endpoint accepts only those names and serves image/webp with nosniff and immutable caching. Uploaded photos are public catalog assets, including previews before publication. Do not use this feature for private customer documents. Upload audit records contain actor, generated ID and dimensions/size only. Storage must be persistent and writable by the application identity. Removing or replacing a listing reference does not delete the old file; there is no automated storage cleanup. See [photo storage and backups](service-photo-uploads.md).
