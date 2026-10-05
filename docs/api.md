# API and workflows

Paths are relative to /api. JSON success: `{"data":...}`. Photo GET responses stream image bytes. Error: `{"error":{"status":400,"message":"..."}}`. Lists include items, total, page, limit and totalPages. Default page size is 20; maximum is 100. DTOs reject unknown properties. Business DTOs use PascalCase; authentication uses camelCase.

Authentication is cookie-only. Every mutation requires an Origin matching APP_URL. Local Swagger is at /api/docs when enabled outside production.

| Resource | Operations |
| --- | --- |
| /marketplace | GET categories, listings (search/categoryId/destination/location/page), listings/:id; public published content only |
| /trip-plans | GET owned plans; POST create/import; GET/PATCH :id; POST :id/items; GET/POST :id/checkout |
| /bookings | GET staff/supplier queue; PATCH :id details or :id/status; GET :id/history |
| /invoices/:id/bookings | POST explicit matching confirmed items; GET /invoices/:id/booking-options for Finance |
| /health | GET public readiness |
| /auth | POST login, refresh, logout, forgot-password, reset-password, change-password; GET me |
| /users | GET/POST; PATCH :id; GET staff; GET/PATCH me |
| /roles | GET permission definitions |
| /customers | GET/POST; GET/PATCH :id or me; PATCH :id/preferences; POST :id/guests |
| /trips | GET/POST; GET/PATCH :id |
| /service-categories | GET/POST; PATCH :id |
| /services | GET/POST; GET/PATCH :id, including options |
| /service-photos | POST multipart file, catalog.write only; GET :filename public WebP image |
| /service-requests | GET/POST; GET meta; GET :id; PATCH :id/status |
| /itineraries | GET scoped items; POST authorized manual activity |
| /notifications | GET; GET unread; PATCH :id/read; POST read-all |
| /messages | GET/POST scoped conversations |
| /dashboard | GET customer overview or staff Command Center |
| /search | GET search=; up to five results per entity |
| /settings | GET/POST allowlisted business settings |
| /audit-log | GET paginated audit records |

## Request workflow
A service request takes TripId, ServiceId, optional OptionId, PreferredDate (YYYY-MM-DD), PreferredTime (HH:mm), Guests, SpecialRequirements and Notes. The initial status is Requested; SQL Server allocates the unique IHC-REQ number.

Send Status, Version, optional Notes and AssignedStaffId to the status endpoint. Use the current Version; stale updates return 409. The metadata route returns statuses and the user's permitted transition map.

Confirmation atomically records history, creates/updates one itinerary item, notifies the customer and records an audit. Rescheduling requires a new date/time within the trip and temporarily hides the itinerary item until reconfirmation. The original itinerary item is reused. Cancellation, unavailability and refund deactivate it; completed experiences remain in history.

Customers may approve a quoted request or cancel an early request. Staff transitions require requests.write. Assignment accepts active operations team members only. History notes are guest-visible.

## Filtering and time
Requests accept search, status, categoryId, serviceId, customerId, tripId, date and sort (newest, oldest, date). Trips accept search/customerId. Catalog accepts search/categoryId; all=true includes inactive content only for catalog managers. Itineraries accept tripId/customerId/date.

Legacy experience dates/times are Nassau local wall-clock values; marketplace dates/times are wall-clock values at the listing destination (Jamaica by default). Confirmation expirations and audit/session timestamps are UTC. No live flight-tracking integration is claimed. Request detail returns the latest 200 history entries. Guest summaries are bounded to 100 records. Lookup selectors support API search and bounded choices.

Service options are deactivated and replaced when edited, preserving references on existing requests. Images use uploaded service photos, local assets or approved HTTPS hosts. POST `/service-photos` with one multipart `file` returns `{data:{Url,Width,Height,Size}}`; save Url as Services.Image or in the JSON Services.Images gallery. Uploads require catalog.write and a matching Origin. Limits: JPG/PNG/WebP, 5 MiB, 20 megapixels, no animation; one main photo plus 12 gallery photos. Files are validated, oriented, resized and re-encoded as metadata-free WebP, served directly from persistent storage. See [photo storage and deployment](service-photo-uploads.md). Online card charging is not included. Existing finance endpoints record externally verified manual settlements; the marketplace validation applies to every new payment. See [the booking lifecycle and payment boundary](marketplace-transformation.md).
