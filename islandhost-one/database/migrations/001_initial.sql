-- Forward-only baseline. TypeORM records this migration and runs it in a transaction.
CREATE TABLE dbo.Users (
 Id uniqueidentifier NOT NULL CONSTRAINT PK_Users PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
 Email nvarchar(254) NOT NULL, DisplayName nvarchar(120) NOT NULL, Phone nvarchar(40) NULL, PasswordHash nvarchar(512) NOT NULL, Active bit NOT NULL DEFAULT 1,
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
GO
CREATE TABLE dbo.Roles (
 Id uniqueidentifier NOT NULL CONSTRAINT PK_Roles PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
 Name nvarchar(50) NOT NULL,
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
GO
CREATE TABLE dbo.UserRoles (
 Id uniqueidentifier NOT NULL CONSTRAINT PK_UserRoles PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
 UserId uniqueidentifier NOT NULL REFERENCES Users(Id), RoleId uniqueidentifier NOT NULL REFERENCES Roles(Id),
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
GO
CREATE TABLE dbo.Customers (
 Id uniqueidentifier NOT NULL CONSTRAINT PK_Customers PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
 UserId uniqueidentifier NULL REFERENCES Users(Id), DisplayName nvarchar(120) NOT NULL, Email nvarchar(254) NOT NULL, Phone nvarchar(40) NULL, Status nvarchar(20) NOT NULL DEFAULT 'Active', Notes nvarchar(2000) NULL,
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
GO
CREATE TABLE dbo.CustomerPreferences (
 Id uniqueidentifier NOT NULL CONSTRAINT PK_CustomerPreferences PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
 CustomerId uniqueidentifier NOT NULL REFERENCES Customers(Id), DietaryRequirements nvarchar(1000) NULL, Interests nvarchar(1000) NULL, Transportation nvarchar(1000) NULL, Notes nvarchar(2000) NULL,
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
GO
CREATE TABLE dbo.CustomerGuests (
 Id uniqueidentifier NOT NULL CONSTRAINT PK_CustomerGuests PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
 CustomerId uniqueidentifier NOT NULL REFERENCES Customers(Id), DisplayName nvarchar(120) NOT NULL, Relationship nvarchar(60) NULL, Notes nvarchar(1000) NULL,
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
GO
CREATE TABLE dbo.Trips (
 Id uniqueidentifier NOT NULL CONSTRAINT PK_Trips PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
 CustomerId uniqueidentifier NOT NULL REFERENCES Customers(Id), Name nvarchar(120) NOT NULL, ArrivalDate date NOT NULL, DepartureDate date NOT NULL, Adults int NOT NULL DEFAULT 1 CHECK (Adults BETWEEN 1 AND 100), Children int NOT NULL DEFAULT 0 CHECK (Children BETWEEN 0 AND 100), DietaryRequirements nvarchar(1000) NULL, SpecialOccasion nvarchar(200) NULL, TransportationRequirements nvarchar(1000) NULL, PersonalPreferences nvarchar(2000) NULL, Notes nvarchar(2000) NULL, CONSTRAINT CK_Trip_Dates CHECK (DepartureDate >= ArrivalDate),
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
GO
CREATE TABLE dbo.Flights (
 Id uniqueidentifier NOT NULL CONSTRAINT PK_Flights PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
 TripId uniqueidentifier NOT NULL REFERENCES Trips(Id), Direction nvarchar(10) NOT NULL CHECK (Direction IN ('Arrival','Departure')), FlightNumber nvarchar(30) NULL, FlightTime nvarchar(5) NULL,
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
GO
CREATE TABLE dbo.Accommodations (
 Id uniqueidentifier NOT NULL CONSTRAINT PK_Accommodations PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
 TripId uniqueidentifier NOT NULL REFERENCES Trips(Id), Type nvarchar(40) NULL, Name nvarchar(160) NULL, Address nvarchar(300) NULL,
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
GO
CREATE TABLE dbo.ServiceCategories (
 Id uniqueidentifier NOT NULL CONSTRAINT PK_ServiceCategories PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
 Name nvarchar(120) NOT NULL, Description nvarchar(1000) NULL, Active bit NOT NULL DEFAULT 1, DisplayOrder int NOT NULL DEFAULT 0,
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
GO
CREATE TABLE dbo.Services (
 Id uniqueidentifier NOT NULL CONSTRAINT PK_Services PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
 CategoryId uniqueidentifier NOT NULL REFERENCES ServiceCategories(Id), Name nvarchar(160) NOT NULL, ShortDescription nvarchar(300) NOT NULL, Description nvarchar(max) NOT NULL, Image nvarchar(1000) NULL, StartingPrice decimal(12,2) NULL CHECK (StartingPrice >= 0), PricingType nvarchar(30) NOT NULL CHECK (PricingType IN ('Fixed','Starting From','Per Person','Per Hour','Custom Quote')), Duration nvarchar(100) NULL, Active bit NOT NULL DEFAULT 1, Featured bit NOT NULL DEFAULT 0, DisplayOrder int NOT NULL DEFAULT 0,
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
GO
CREATE TABLE dbo.ServiceOptions (
 Id uniqueidentifier NOT NULL CONSTRAINT PK_ServiceOptions PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
 ServiceId uniqueidentifier NOT NULL REFERENCES Services(Id), Name nvarchar(120) NOT NULL, Description nvarchar(1000) NULL, Price decimal(12,2) NULL CHECK (Price >= 0), Active bit NOT NULL DEFAULT 1,
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
GO
CREATE TABLE dbo.ServiceRequests (
 Id uniqueidentifier NOT NULL CONSTRAINT PK_ServiceRequests PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
 RequestSequence bigint IDENTITY(1,1) NOT NULL, RequestNumber AS ('IHC-REQ-' + CASE WHEN RequestSequence < 1000000 THEN RIGHT('000000' + CONVERT(varchar(20),RequestSequence),6) ELSE CONVERT(varchar(20),RequestSequence) END) PERSISTED, TripId uniqueidentifier NOT NULL REFERENCES Trips(Id), CustomerId uniqueidentifier NOT NULL REFERENCES Customers(Id), ServiceId uniqueidentifier NOT NULL REFERENCES Services(Id), OptionId uniqueidentifier NULL REFERENCES ServiceOptions(Id), PreferredDate date NOT NULL, PreferredTime nvarchar(5) NOT NULL, Guests int NOT NULL CHECK (Guests BETWEEN 1 AND 200), SpecialRequirements nvarchar(2000) NULL, Notes nvarchar(2000) NULL, Status nvarchar(30) NOT NULL DEFAULT 'Requested', AssignedStaffId uniqueidentifier NULL REFERENCES Users(Id), Version int NOT NULL DEFAULT 1,
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
GO
CREATE TABLE dbo.ServiceRequestHistory (
 Id uniqueidentifier NOT NULL CONSTRAINT PK_ServiceRequestHistory PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
 RequestId uniqueidentifier NOT NULL REFERENCES ServiceRequests(Id), PreviousStatus nvarchar(30) NULL, NewStatus nvarchar(30) NOT NULL, ActorId uniqueidentifier NOT NULL REFERENCES Users(Id), Notes nvarchar(2000) NULL,
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
GO
CREATE TABLE dbo.Itineraries (
 Id uniqueidentifier NOT NULL CONSTRAINT PK_Itineraries PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
 TripId uniqueidentifier NOT NULL REFERENCES Trips(Id), Name nvarchar(160) NOT NULL,
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
GO
CREATE TABLE dbo.ItineraryItems (
 Id uniqueidentifier NOT NULL CONSTRAINT PK_ItineraryItems PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
 ItineraryId uniqueidentifier NOT NULL REFERENCES Itineraries(Id), RequestId uniqueidentifier NULL REFERENCES ServiceRequests(Id), EventDate date NOT NULL, EventTime nvarchar(5) NOT NULL, Activity nvarchar(160) NOT NULL, Location nvarchar(300) NULL, Notes nvarchar(2000) NULL, Active bit NOT NULL DEFAULT 1,
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
GO
CREATE TABLE dbo.Notifications (
 Id uniqueidentifier NOT NULL CONSTRAINT PK_Notifications PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
 UserId uniqueidentifier NOT NULL REFERENCES Users(Id), Title nvarchar(160) NOT NULL, Body nvarchar(2000) NOT NULL, Link nvarchar(300) NULL, ReadAt datetime2 NULL,
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
GO
CREATE TABLE dbo.AuditLogs (
 Id uniqueidentifier NOT NULL CONSTRAINT PK_AuditLogs PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
 ActorId uniqueidentifier NULL REFERENCES Users(Id), Action nvarchar(120) NOT NULL, Entity nvarchar(60) NOT NULL, EntityId uniqueidentifier NULL, Metadata nvarchar(4000) NULL,
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
GO
CREATE TABLE dbo.SystemSettings (
 Id uniqueidentifier NOT NULL CONSTRAINT PK_SystemSettings PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
 SettingKey nvarchar(80) NOT NULL, Value nvarchar(2000) NOT NULL,
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
GO
CREATE TABLE dbo.AuthSessions (
 Id uniqueidentifier NOT NULL CONSTRAINT PK_AuthSessions PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
 UserId uniqueidentifier NOT NULL REFERENCES Users(Id), TokenHash nvarchar(64) NOT NULL, ExpiresAt datetime2 NOT NULL, RevokedAt datetime2 NULL,
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
GO
CREATE TABLE dbo.PasswordResetTokens (
 Id uniqueidentifier NOT NULL CONSTRAINT PK_PasswordResetTokens PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
 UserId uniqueidentifier NOT NULL REFERENCES Users(Id), TokenHash nvarchar(64) NOT NULL, ExpiresAt datetime2 NOT NULL, UsedAt datetime2 NULL,
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
GO
CREATE TABLE dbo.Messages (
 Id uniqueidentifier NOT NULL CONSTRAINT PK_Messages PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
 CustomerId uniqueidentifier NOT NULL REFERENCES Customers(Id), SenderId uniqueidentifier NOT NULL REFERENCES Users(Id), Body nvarchar(4000) NOT NULL,
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CreatedBy uniqueidentifier NULL, UpdatedBy uniqueidentifier NULL
);
GO

CREATE UNIQUE INDEX UX_Users_Email ON Users(Email);
CREATE UNIQUE INDEX UX_Roles_Name ON Roles(Name);
CREATE UNIQUE INDEX UX_UserRoles_UserRole ON UserRoles(UserId,RoleId);
CREATE UNIQUE INDEX UX_Customers_User ON Customers(UserId) WHERE UserId IS NOT NULL;
CREATE UNIQUE INDEX UX_Preferences_Customer ON CustomerPreferences(CustomerId);
CREATE UNIQUE INDEX UX_Categories_Name ON ServiceCategories(Name);
CREATE UNIQUE INDEX UX_Flight_Direction ON Flights(TripId,Direction);
CREATE UNIQUE INDEX UX_Accommodations_Trip ON Accommodations(TripId);
CREATE UNIQUE INDEX UX_Itinerary_Trip ON Itineraries(TripId);
CREATE UNIQUE INDEX UX_Itinerary_Request ON ItineraryItems(RequestId) WHERE RequestId IS NOT NULL;
CREATE UNIQUE INDEX UX_Settings_Key ON SystemSettings(SettingKey);
CREATE UNIQUE INDEX UX_Request_Number ON ServiceRequests(RequestNumber);
CREATE INDEX IX_Trips_CustomerDates ON Trips(CustomerId,ArrivalDate,DepartureDate);
CREATE INDEX IX_Trips_Arrival ON Trips(ArrivalDate) INCLUDE (DepartureDate,Adults,Children);
CREATE INDEX IX_Services_Catalog ON Services(Active,CategoryId,DisplayOrder);
CREATE INDEX IX_ServiceOptions_Service ON ServiceOptions(ServiceId,Active);
CREATE INDEX IX_Requests_Operations ON ServiceRequests(Status,PreferredDate) INCLUDE (TripId,CustomerId,ServiceId);
CREATE INDEX IX_Requests_Customer ON ServiceRequests(CustomerId,CreatedAt DESC);
CREATE INDEX IX_RequestHistory_Request ON ServiceRequestHistory(RequestId,CreatedAt);
CREATE INDEX IX_Items_Schedule ON ItineraryItems(ItineraryId,EventDate,EventTime);
CREATE INDEX IX_Notifications_Inbox ON Notifications(UserId,ReadAt,CreatedAt DESC);
CREATE INDEX IX_Audit_Time ON AuditLogs(CreatedAt DESC);
CREATE INDEX IX_Sessions_User ON AuthSessions(UserId,RevokedAt);
CREATE UNIQUE INDEX UX_ResetToken_Hash ON PasswordResetTokens(TokenHash);
CREATE INDEX IX_Guests_Customer ON CustomerGuests(CustomerId);
CREATE INDEX IX_Messages_Customer ON Messages(CustomerId,CreatedAt DESC);
GO

