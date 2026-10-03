-- Phase 2: forward-only and transactional. Existing records remain intact.
CREATE TABLE dbo.Quotes (
 Id uniqueidentifier NOT NULL CONSTRAINT PK_Quotes PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
 QuoteSequence bigint IDENTITY(1,1) NOT NULL, QuoteNumber AS ('IHC-QT-' + CASE WHEN QuoteSequence<1000000 THEN RIGHT('000000'+CONVERT(varchar(20),QuoteSequence),6) ELSE CONVERT(varchar(20),QuoteSequence) END) PERSISTED, RequestId uniqueidentifier NOT NULL REFERENCES ServiceRequests(Id), CustomerId uniqueidentifier NOT NULL REFERENCES Customers(Id), TripId uniqueidentifier NOT NULL REFERENCES Trips(Id), Status nvarchar(25) NOT NULL DEFAULT 'Draft' CHECK(Status IN ('Draft','Sent','Viewed','Approved','Rejected','Expired','Converted','Cancelled')), ValidUntil date NOT NULL, Terms nvarchar(4000) NULL, Notes nvarchar(2000) NULL, Version int NOT NULL DEFAULT 1, Currency char(3) NOT NULL DEFAULT 'USD' CHECK(Currency='USD'), Subtotal decimal(14,2) NOT NULL CHECK(Subtotal>=0), TaxRate decimal(5,2) NOT NULL DEFAULT 0 CHECK(TaxRate BETWEEN 0 AND 100), Tax decimal(14,2) NOT NULL CHECK(Tax>=0), Fees decimal(14,2) NOT NULL DEFAULT 0 CHECK(Fees>=0), Discount decimal(14,2) NOT NULL DEFAULT 0 CHECK(Discount>=0), CHECK(Discount<=Subtotal), Total decimal(14,2) NOT NULL CHECK(Total>=0), Deposit decimal(14,2) NOT NULL DEFAULT 0 CHECK(Deposit>=0), CHECK(Deposit<=Total),
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
GO
CREATE TABLE dbo.QuoteItems (
 Id uniqueidentifier NOT NULL CONSTRAINT PK_QuoteItems PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
 QuoteId uniqueidentifier NOT NULL REFERENCES Quotes(Id), ServiceId uniqueidentifier NULL REFERENCES Services(Id), CategoryId uniqueidentifier NULL REFERENCES ServiceCategories(Id), ServiceName nvarchar(160) NULL, CategoryName nvarchar(120) NULL, Description nvarchar(300) NOT NULL, Quantity int NOT NULL CHECK(Quantity BETWEEN 1 AND 1000), UnitPrice decimal(14,2) NOT NULL CHECK(UnitPrice>=0), LineTotal decimal(14,2) NOT NULL CHECK(LineTotal>=0), DisplayOrder int NOT NULL DEFAULT 0,
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
GO
CREATE TABLE dbo.QuoteHistory (
 Id uniqueidentifier NOT NULL CONSTRAINT PK_QuoteHistory PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
 QuoteId uniqueidentifier NOT NULL REFERENCES Quotes(Id), PreviousStatus nvarchar(25) NULL, NewStatus nvarchar(25) NOT NULL, ActorId uniqueidentifier NOT NULL REFERENCES Users(Id), Notes nvarchar(2000) NULL,
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
GO
CREATE TABLE dbo.Invoices (
 Id uniqueidentifier NOT NULL CONSTRAINT PK_Invoices PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
 InvoiceSequence bigint IDENTITY(1,1) NOT NULL, InvoiceNumber AS ('IHC-INV-' + CASE WHEN InvoiceSequence<1000000 THEN RIGHT('000000'+CONVERT(varchar(20),InvoiceSequence),6) ELSE CONVERT(varchar(20),InvoiceSequence) END) PERSISTED, QuoteId uniqueidentifier NULL REFERENCES Quotes(Id), RequestId uniqueidentifier NULL REFERENCES ServiceRequests(Id), CustomerId uniqueidentifier NOT NULL REFERENCES Customers(Id), TripId uniqueidentifier NOT NULL REFERENCES Trips(Id), Status nvarchar(25) NOT NULL DEFAULT 'Draft' CHECK(Status IN ('Draft','Issued','Partially Paid','Paid','Overdue','Cancelled','Refunded')), IssuedDate date NULL, DueDate date NOT NULL, Terms nvarchar(4000) NULL, Notes nvarchar(2000) NULL, Version int NOT NULL DEFAULT 1, AmountPaid decimal(14,2) NOT NULL DEFAULT 0 CHECK(AmountPaid>=0), RefundedAmount decimal(14,2) NOT NULL DEFAULT 0 CHECK(RefundedAmount>=0), Currency char(3) NOT NULL DEFAULT 'USD' CHECK(Currency='USD'), Subtotal decimal(14,2) NOT NULL CHECK(Subtotal>=0), TaxRate decimal(5,2) NOT NULL DEFAULT 0 CHECK(TaxRate BETWEEN 0 AND 100), Tax decimal(14,2) NOT NULL CHECK(Tax>=0), Fees decimal(14,2) NOT NULL DEFAULT 0 CHECK(Fees>=0), Discount decimal(14,2) NOT NULL DEFAULT 0 CHECK(Discount>=0), CHECK(Discount<=Subtotal), Total decimal(14,2) NOT NULL CHECK(Total>=0), Deposit decimal(14,2) NOT NULL DEFAULT 0 CHECK(Deposit>=0), CHECK(Deposit<=Total), BalanceDue AS (Total-AmountPaid-RefundedAmount) PERSISTED, CONSTRAINT CK_Invoice_Paid CHECK(AmountPaid+RefundedAmount<=Total),
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
GO
CREATE TABLE dbo.InvoiceItems (
 Id uniqueidentifier NOT NULL CONSTRAINT PK_InvoiceItems PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
 InvoiceId uniqueidentifier NOT NULL REFERENCES Invoices(Id), ServiceId uniqueidentifier NULL REFERENCES Services(Id), CategoryId uniqueidentifier NULL REFERENCES ServiceCategories(Id), ServiceName nvarchar(160) NULL, CategoryName nvarchar(120) NULL, Description nvarchar(300) NOT NULL, Quantity int NOT NULL CHECK(Quantity BETWEEN 1 AND 1000), UnitPrice decimal(14,2) NOT NULL CHECK(UnitPrice>=0), LineTotal decimal(14,2) NOT NULL CHECK(LineTotal>=0), DisplayOrder int NOT NULL DEFAULT 0,
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
GO
CREATE TABLE dbo.Payments (
 Id uniqueidentifier NOT NULL CONSTRAINT PK_Payments PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
 PaymentSequence bigint IDENTITY(1,1) NOT NULL, PaymentNumber AS ('IHC-PAY-' + CASE WHEN PaymentSequence<1000000 THEN RIGHT('000000'+CONVERT(varchar(20),PaymentSequence),6) ELSE CONVERT(varchar(20),PaymentSequence) END) PERSISTED, InvoiceId uniqueidentifier NOT NULL REFERENCES Invoices(Id), Amount decimal(14,2) NOT NULL CHECK(Amount>0), RefundedAmount decimal(14,2) NOT NULL DEFAULT 0 CHECK(RefundedAmount>=0), CHECK(RefundedAmount<=Amount), Currency char(3) NOT NULL CHECK(Currency='USD'), Status nvarchar(25) NOT NULL CHECK(Status IN ('Pending','Authorized','Paid','Failed','Cancelled','Partially Refunded','Refunded')), Method nvarchar(40) NOT NULL, Provider nvarchar(60) NOT NULL, ProviderReference nvarchar(160) NOT NULL, IdempotencyKey nvarchar(100) NOT NULL, RequestHash char(64) NOT NULL, ReceivedDate date NOT NULL, Notes nvarchar(1000) NULL,
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
GO
CREATE TABLE dbo.Refunds (
 Id uniqueidentifier NOT NULL CONSTRAINT PK_Refunds PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
 RefundSequence bigint IDENTITY(1,1) NOT NULL, RefundNumber AS ('IHC-REF-' + CASE WHEN RefundSequence<1000000 THEN RIGHT('000000'+CONVERT(varchar(20),RefundSequence),6) ELSE CONVERT(varchar(20),RefundSequence) END) PERSISTED, PaymentId uniqueidentifier NOT NULL REFERENCES Payments(Id), Amount decimal(14,2) NOT NULL CHECK(Amount>0), Reason nvarchar(1000) NOT NULL, Status nvarchar(25) NOT NULL CHECK(Status IN ('Pending','Paid','Failed','Cancelled')), ProviderReference nvarchar(160) NOT NULL, IdempotencyKey nvarchar(100) NOT NULL, RequestHash char(64) NOT NULL, RefundedDate date NOT NULL,
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
GO
CREATE TABLE dbo.Vendors (
 Id uniqueidentifier NOT NULL CONSTRAINT PK_Vendors PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
 Name nvarchar(160) NOT NULL, Type nvarchar(40) NOT NULL, Email nvarchar(254) NULL, Phone nvarchar(40) NULL, UserId uniqueidentifier NULL REFERENCES Users(Id), Active bit NOT NULL DEFAULT 1, Notes nvarchar(2000) NULL,
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
GO
CREATE TABLE dbo.VendorServices (
 Id uniqueidentifier NOT NULL CONSTRAINT PK_VendorServices PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
 VendorId uniqueidentifier NOT NULL REFERENCES Vendors(Id), ServiceId uniqueidentifier NOT NULL REFERENCES Services(Id), Cost decimal(14,2) NOT NULL CHECK(Cost>=0), Currency char(3) NOT NULL DEFAULT 'USD' CHECK(Currency='USD'), Active bit NOT NULL DEFAULT 1,
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
GO
CREATE TABLE dbo.VendorAssignments (
 Id uniqueidentifier NOT NULL CONSTRAINT PK_VendorAssignments PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
 VendorId uniqueidentifier NOT NULL REFERENCES Vendors(Id), RequestId uniqueidentifier NOT NULL REFERENCES ServiceRequests(Id), TripId uniqueidentifier NOT NULL REFERENCES Trips(Id), Cost decimal(14,2) NOT NULL CHECK(Cost>=0), Currency char(3) NOT NULL DEFAULT 'USD' CHECK(Currency='USD'), Status nvarchar(25) NOT NULL DEFAULT 'Pending' CHECK(Status IN ('Pending','Assigned','Accepted','Declined','In Progress','Completed','Cancelled')), OperationalNotes nvarchar(2000) NULL, Version int NOT NULL DEFAULT 1,
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
GO
CREATE TABLE dbo.VendorAssignmentHistory (
 Id uniqueidentifier NOT NULL CONSTRAINT PK_VendorAssignmentHistory PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
 AssignmentId uniqueidentifier NOT NULL REFERENCES VendorAssignments(Id), PreviousStatus nvarchar(25) NULL, NewStatus nvarchar(25) NOT NULL, ActorId uniqueidentifier NOT NULL REFERENCES Users(Id), Notes nvarchar(1000) NULL,
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
GO
CREATE TABLE dbo.Drivers (
 Id uniqueidentifier NOT NULL CONSTRAINT PK_Drivers PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
 UserId uniqueidentifier NOT NULL REFERENCES Users(Id), DisplayName nvarchar(120) NOT NULL, Phone nvarchar(40) NULL, LicenseNumber nvarchar(80) NOT NULL, Active bit NOT NULL DEFAULT 1, Notes nvarchar(2000) NULL,
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
GO
CREATE TABLE dbo.Vehicles (
 Id uniqueidentifier NOT NULL CONSTRAINT PK_Vehicles PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
 Name nvarchar(120) NOT NULL, Registration nvarchar(40) NOT NULL, Capacity int NOT NULL CHECK(Capacity BETWEEN 1 AND 200), Active bit NOT NULL DEFAULT 1, Notes nvarchar(2000) NULL,
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
GO
CREATE TABLE dbo.Transfers (
 Id uniqueidentifier NOT NULL CONSTRAINT PK_Transfers PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
 TransferSequence bigint IDENTITY(1,1) NOT NULL, TransferNumber AS ('IHC-TRN-' + CASE WHEN TransferSequence<1000000 THEN RIGHT('000000'+CONVERT(varchar(20),TransferSequence),6) ELSE CONVERT(varchar(20),TransferSequence) END) PERSISTED, RequestId uniqueidentifier NOT NULL REFERENCES ServiceRequests(Id), TripId uniqueidentifier NOT NULL REFERENCES Trips(Id), CustomerId uniqueidentifier NOT NULL REFERENCES Customers(Id), Type nvarchar(30) NOT NULL CHECK(Type IN ('Airport Pickup','Airport Drop-off','Point-to-Point','Private Chauffeur')), Pickup nvarchar(300) NOT NULL, Destination nvarchar(300) NOT NULL, Passengers int NOT NULL CHECK(Passengers BETWEEN 1 AND 200), ScheduledDate date NOT NULL, ScheduledTime nvarchar(5) NOT NULL, DurationMinutes int NOT NULL CHECK(DurationMinutes BETWEEN 15 AND 1440), FlightNumber nvarchar(30) NULL, OperationalNotes nvarchar(2000) NULL, DriverId uniqueidentifier NULL REFERENCES Drivers(Id), VehicleId uniqueidentifier NULL REFERENCES Vehicles(Id), DirectCost decimal(14,2) NOT NULL DEFAULT 0 CHECK(DirectCost>=0), Currency char(3) NOT NULL DEFAULT 'USD' CHECK(Currency='USD'), Status nvarchar(25) NOT NULL DEFAULT 'Unassigned' CHECK(Status IN ('Unassigned','Assigned','En Route','Arrived','Passenger Onboard','Completed','Cancelled','No Show')), Version int NOT NULL DEFAULT 1, CONSTRAINT CK_Transfer_Assigned CHECK(Status NOT IN ('Assigned','En Route','Arrived','Passenger Onboard','Completed','No Show') OR (DriverId IS NOT NULL AND VehicleId IS NOT NULL)),
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
GO
CREATE TABLE dbo.TransferStatusHistory (
 Id uniqueidentifier NOT NULL CONSTRAINT PK_TransferStatusHistory PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
 TransferId uniqueidentifier NOT NULL REFERENCES Transfers(Id), PreviousStatus nvarchar(25) NULL, NewStatus nvarchar(25) NOT NULL, DriverId uniqueidentifier NULL REFERENCES Drivers(Id), VehicleId uniqueidentifier NULL REFERENCES Vehicles(Id), ActorId uniqueidentifier NOT NULL REFERENCES Users(Id), Notes nvarchar(1000) NULL,
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
GO
CREATE TABLE dbo.Conversations (
 Id uniqueidentifier NOT NULL CONSTRAINT PK_Conversations PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
 Subject nvarchar(160) NOT NULL, Kind nvarchar(20) NOT NULL CHECK(Kind IN ('Customer','Operations')), CustomerId uniqueidentifier NULL REFERENCES Customers(Id), IsLegacy bit NOT NULL DEFAULT 0, CONSTRAINT CK_Conversation_Customer CHECK((Kind='Customer' AND CustomerId IS NOT NULL) OR (Kind='Operations' AND CustomerId IS NULL)),
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
GO
CREATE TABLE dbo.ConversationParticipants (
 Id uniqueidentifier NOT NULL CONSTRAINT PK_ConversationParticipants PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
 ConversationId uniqueidentifier NOT NULL REFERENCES Conversations(Id), UserId uniqueidentifier NOT NULL REFERENCES Users(Id), LastReadSequence bigint NOT NULL DEFAULT 0 CHECK(LastReadSequence>=0),
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
GO
ALTER TABLE dbo.Messages ALTER COLUMN CustomerId uniqueidentifier NULL;
ALTER TABLE dbo.Messages ADD ConversationId uniqueidentifier NULL REFERENCES Conversations(Id), MessageSequence bigint IDENTITY(1,1) NOT NULL;
ALTER TABLE dbo.Services ADD TransportApplicable bit NOT NULL CONSTRAINT DF_Services_Transport DEFAULT 0;
GO
-- Preserve the original messages and associate their history with a customer conversation.
INSERT INTO Conversations(Subject,Kind,CustomerId,IsLegacy) SELECT N'Your concierge','Customer',c.Id,1 FROM Customers c WHERE EXISTS(SELECT 1 FROM Messages m WHERE m.CustomerId=c.Id);
UPDATE m SET ConversationId=c.Id FROM Messages m JOIN Conversations c ON c.CustomerId=m.CustomerId AND c.IsLegacy=1;
INSERT INTO ConversationParticipants(ConversationId,UserId) SELECT c.Id,u.Id FROM Conversations c JOIN Customers cu ON cu.Id=c.CustomerId JOIN Users u ON u.Id=cu.UserId
UNION SELECT c.Id,m.SenderId FROM Conversations c JOIN Messages m ON m.ConversationId=c.Id
UNION SELECT c.Id,u.Id FROM Conversations c CROSS JOIN Users u WHERE u.Active=1 AND EXISTS(SELECT 1 FROM UserRoles ur JOIN Roles r ON r.Id=ur.RoleId WHERE ur.UserId=u.Id AND r.Name IN ('SuperAdmin','Management','OperationsManager','ConciergeAgent'));
GO
CREATE UNIQUE INDEX UX_Quotes_Number ON Quotes(QuoteNumber);
CREATE UNIQUE INDEX UX_Invoices_Number ON Invoices(InvoiceNumber);
CREATE UNIQUE INDEX UX_Payments_Number ON Payments(PaymentNumber);
CREATE UNIQUE INDEX UX_Refunds_Number ON Refunds(RefundNumber);
CREATE UNIQUE INDEX UX_Transfers_Number ON Transfers(TransferNumber);
CREATE UNIQUE INDEX UX_Quote_OpenRequest ON Quotes(RequestId) WHERE Status IN ('Draft','Sent','Viewed','Approved');
CREATE UNIQUE INDEX UX_Invoice_Quote ON Invoices(QuoteId) WHERE QuoteId IS NOT NULL;
CREATE UNIQUE INDEX UX_Invoice_Request ON Invoices(RequestId) WHERE RequestId IS NOT NULL AND Status<>'Cancelled';
CREATE UNIQUE INDEX UX_Payment_Key ON Payments(IdempotencyKey);
CREATE UNIQUE INDEX UX_Payment_Reference ON Payments(Provider,ProviderReference);
CREATE UNIQUE INDEX UX_Refund_Key ON Refunds(IdempotencyKey);
CREATE UNIQUE INDEX UX_Refund_Reference ON Refunds(PaymentId,ProviderReference);
CREATE UNIQUE INDEX UX_Vendor_User ON Vendors(UserId) WHERE UserId IS NOT NULL;
CREATE UNIQUE INDEX UX_VendorService ON VendorServices(VendorId,ServiceId);
CREATE UNIQUE INDEX UX_Assignment_Open ON VendorAssignments(RequestId,VendorId) WHERE Status<>'Cancelled' AND Status<>'Declined';
CREATE UNIQUE INDEX UX_Driver_User ON Drivers(UserId);
CREATE UNIQUE INDEX UX_Vehicle_Registration ON Vehicles(Registration);
CREATE UNIQUE INDEX UX_Transfer_Request ON Transfers(RequestId) WHERE Status<>'Cancelled';
CREATE UNIQUE INDEX UX_Conversation_Legacy ON Conversations(CustomerId) WHERE IsLegacy=1;
CREATE UNIQUE INDEX UX_Conversation_Participant ON ConversationParticipants(ConversationId,UserId);
CREATE UNIQUE INDEX UX_Message_Sequence ON Messages(MessageSequence);
CREATE INDEX IX_Quote_Customer ON Quotes(CustomerId,CreatedAt DESC);
CREATE INDEX IX_Quote_Validity ON Quotes(Status,ValidUntil);
CREATE INDEX IX_QuoteItems_Quote ON QuoteItems(QuoteId,DisplayOrder);
CREATE INDEX IX_QuoteHistory ON QuoteHistory(QuoteId,CreatedAt);
CREATE INDEX IX_Invoice_Customer ON Invoices(CustomerId,CreatedAt DESC);
CREATE INDEX IX_Invoice_Reporting ON Invoices(IssuedDate,Status) INCLUDE(Total,Tax,AmountPaid,RefundedAmount,TripId);
CREATE INDEX IX_InvoiceItems ON InvoiceItems(InvoiceId,ServiceId,CategoryId);
CREATE INDEX IX_Payment_Invoice ON Payments(InvoiceId,Status);
CREATE INDEX IX_Payment_Reporting ON Payments(ReceivedDate,Method) INCLUDE(Amount,RefundedAmount,InvoiceId,Status);
CREATE INDEX IX_Refund_Payment ON Refunds(PaymentId,Status);
CREATE INDEX IX_Vendor_Active ON Vendors(Active,Type,Name);
CREATE INDEX IX_Assignment_Vendor ON VendorAssignments(VendorId,Status,CreatedAt);
CREATE INDEX IX_Assignment_Trip ON VendorAssignments(TripId,Status) INCLUDE(Cost,RequestId);
CREATE INDEX IX_AssignmentHistory ON VendorAssignmentHistory(AssignmentId,CreatedAt);
CREATE INDEX IX_Transfer_Dispatch ON Transfers(ScheduledDate,Status,ScheduledTime);
CREATE INDEX IX_Transfer_Driver ON Transfers(DriverId,ScheduledDate,Status);
CREATE INDEX IX_Transfer_Vehicle ON Transfers(VehicleId,ScheduledDate,Status);
CREATE INDEX IX_TransferHistory ON TransferStatusHistory(TransferId,CreatedAt);
CREATE INDEX IX_Conversation_User ON ConversationParticipants(UserId,ConversationId);
CREATE INDEX IX_Messages_Conversation ON Messages(ConversationId,MessageSequence DESC);
GO
