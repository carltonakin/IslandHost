# Phase 2 implementation decisions

The existing Next.js/NestJS/TypeORM/SQL Server architecture remains in place. Domain services use the shared parameterized persistence adapter, authorization guards, DTO validation, response envelopes, forms and navigation.

Migration 002 adds financial, vendor, transport and conversation tables. Messages is extended in place, and legacy messages are linked to customer conversations. The original message endpoints remain compatible. No records are deleted by migrations.

Money uses integer minor units in backend calculations and DECIMAL(14,2) in SQL Server. USD is the initial supported currency. Discounts apply before tax; fees are added after tax. Invoices preserve line prices and service/category names. Refunds are credits against paid amounts and never create a new receivable. Quote deposits specify the confirmation threshold; a zero deposit requires full payment.

PaymentProvider is an extension boundary. The initial configured provider records Finance-authorized offline payments and refunds already settled outside the application. No customer-supplied claim of payment can mark an invoice paid. Online collection requires a separately configured gateway adapter and verified webhook processing.

Driver and vehicle assignment uses transaction-scoped SQL application locks plus schedule overlap checks. Cost snapshots stay separate from selling prices. Existing role permissions are extended without granting driver/vendor access to customer records or finance.

Optional NestJS WebSockets send invalidation signals only. Records and messages are always fetched from scoped REST endpoints. REST polling remains available when WebSocket upgrades are unavailable. No Redis or message broker is required.

References: [NestJS adapters](https://docs.nestjs.com/websockets/adapter), [NestJS gateways](https://docs.nestjs.com/websockets/gateways), [SQL Server application locks](https://learn.microsoft.com/en-us/sql/relational-databases/system-stored-procedures/sp-getapplock-transact-sql).
