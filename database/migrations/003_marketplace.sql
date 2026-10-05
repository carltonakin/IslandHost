-- Additive marketplace and confirmed-booking checkout. Preserve existing records.
ALTER TABLE Services ADD Destination nvarchar(100) NOT NULL CONSTRAINT DF_Service_Destination DEFAULT 'Bahamas', Location nvarchar(300) NULL, Images nvarchar(max) NULL, Amenities nvarchar(2000) NULL, VendorId uniqueidentifier NULL REFERENCES Vendors(Id), BookingRequirements nvarchar(2000) NULL, CancellationPolicy nvarchar(2000) NULL, AvailabilityNotes nvarchar(1000) NULL, Published bit NOT NULL CONSTRAINT DF_Service_Published DEFAULT 0, Bookable bit NOT NULL CONSTRAINT DF_Service_Bookable DEFAULT 1;
GO
ALTER TABLE Itineraries ADD Destination nvarchar(100) NOT NULL CONSTRAINT DF_Itinerary_Destination DEFAULT 'Bahamas', Status nvarchar(25) NOT NULL CONSTRAINT DF_Itinerary_Status DEFAULT 'Draft', Currency char(3) NOT NULL CONSTRAINT DF_Itinerary_Currency DEFAULT 'USD' CHECK(Currency='USD'), GuestReference uniqueidentifier NULL;
GO
ALTER TABLE ItineraryItems ADD ManagedBooking bit NOT NULL CONSTRAINT DF_ManagedBooking DEFAULT 0, ServiceId uniqueidentifier NULL REFERENCES Services(Id), VendorId uniqueidentifier NULL REFERENCES Vendors(Id), OptionId uniqueidentifier NULL REFERENCES ServiceOptions(Id), Quantity int NOT NULL CONSTRAINT DF_Booking_Quantity DEFAULT 1 CHECK(Quantity BETWEEN 1 AND 1000), PartySize int NOT NULL CONSTRAINT DF_Booking_Party DEFAULT 1 CHECK(PartySize BETWEEN 1 AND 200), Pickup nvarchar(300) NULL, Dropoff nvarchar(300) NULL, BookingStatus nvarchar(30) NOT NULL CONSTRAINT DF_Booking_Status DEFAULT 'PLANNED' CHECK(BookingStatus IN ('PLANNED','PENDING_CONFIRMATION','CONFIRMED','CHANGE_REQUESTED','RECONFIRMING','REJECTED','CANCELLED','EXPIRED','COMPLETED')), PaymentStatus nvarchar(30) NOT NULL CONSTRAINT DF_Booking_Payment DEFAULT 'UNPAID' CHECK(PaymentStatus IN ('UNPAID','PENDING','PAID','PARTIALLY_REFUNDED','REFUNDED')), QuotedPrice decimal(14,2) NULL CHECK(QuotedPrice>=0), ConfirmedPrice decimal(14,2) NULL CHECK(ConfirmedPrice>0), ConfirmationReference nvarchar(160) NULL, ConfirmedAt datetime2 NULL, ConfirmationExpiresAt datetime2 NULL, ConfirmationConditions nvarchar(2000) NULL, ConfirmedBy uniqueidentifier NULL REFERENCES Users(Id), Version int NOT NULL CONSTRAINT DF_Booking_Version DEFAULT 1, CheckoutInvoiceId uniqueidentifier NULL REFERENCES Invoices(Id);
GO
UPDATE i SET ServiceId=r.ServiceId,OptionId=r.OptionId,PartySize=r.Guests FROM ItineraryItems i JOIN ServiceRequests r ON r.Id=i.RequestId;
GO
ALTER TABLE Invoices ADD ItineraryId uniqueidentifier NULL REFERENCES Itineraries(Id), CheckoutKey nvarchar(100) NULL, CheckoutHash char(64) NULL;
GO
CREATE TABLE dbo.BookingHistory (
 Id uniqueidentifier NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(), ItineraryItemId uniqueidentifier NOT NULL REFERENCES ItineraryItems(Id), PreviousStatus nvarchar(30) NULL, NewStatus nvarchar(30) NOT NULL, ActorId uniqueidentifier NOT NULL REFERENCES Users(Id), Notes nvarchar(2000) NULL, Snapshot nvarchar(max) NOT NULL,
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
CREATE TABLE dbo.InvoiceBookings (
 Id uniqueidentifier NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(), InvoiceId uniqueidentifier NOT NULL REFERENCES Invoices(Id), ItineraryItemId uniqueidentifier NOT NULL REFERENCES ItineraryItems(Id), BookingVersion int NOT NULL, ConfirmedAmount decimal(14,2) NOT NULL CHECK(ConfirmedAmount>0),
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL,
 CONSTRAINT UX_InvoiceBooking UNIQUE(InvoiceId,ItineraryItemId)
);
CREATE TABLE dbo.PaymentAllocations (
 Id uniqueidentifier NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(), PaymentId uniqueidentifier NOT NULL REFERENCES Payments(Id), ItineraryItemId uniqueidentifier NOT NULL REFERENCES ItineraryItems(Id), Amount decimal(14,2) NOT NULL CHECK(Amount>0), RefundedAmount decimal(14,2) NOT NULL DEFAULT 0 CHECK(RefundedAmount>=0), CHECK(RefundedAmount<=Amount),
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL,
 CONSTRAINT UX_PaymentAllocation UNIQUE(PaymentId,ItineraryItemId)
);
GO
CREATE UNIQUE INDEX UX_Itinerary_GuestReference ON Itineraries(GuestReference) WHERE GuestReference IS NOT NULL;
CREATE UNIQUE INDEX UX_Invoice_CheckoutKey ON Invoices(CheckoutKey) WHERE CheckoutKey IS NOT NULL;
CREATE INDEX IX_Marketplace_Public ON Services(Published,Active,Destination,CategoryId) INCLUDE(Name,VendorId,StartingPrice);
CREATE INDEX IX_Bookings_Queue ON ItineraryItems(BookingStatus,VendorId,EventDate) INCLUDE(ItineraryId,ServiceId,PaymentStatus,ConfirmationExpiresAt);
CREATE INDEX IX_Bookings_Checkout ON ItineraryItems(ItineraryId,BookingStatus,PaymentStatus) INCLUDE(ConfirmedPrice,ConfirmationExpiresAt,Version);
CREATE INDEX IX_Booking_History ON BookingHistory(ItineraryItemId,CreatedAt);
CREATE INDEX IX_InvoiceBookings_Item ON InvoiceBookings(ItineraryItemId,InvoiceId);
CREATE INDEX IX_Allocations_Item ON PaymentAllocations(ItineraryItemId,PaymentId);
GO
INSERT INTO ServiceCategories(Name,Description,DisplayOrder)
SELECT name,'Explore Jamaica: '+name,100+position FROM (VALUES
('Resorts',1),('Hotels',2),('Villas',3),('Beaches',4),('Vacation Spots',5),('Restaurants',6),('Dining Experiences',7),('Entertainment',8),('Attractions',9),('Tours',10),('Excursions',11),('Experiences',12),('Transportation',13),('Events',14)) categories(name,position)
WHERE NOT EXISTS(SELECT 1 FROM ServiceCategories existing WHERE existing.Name=categories.name);
GO