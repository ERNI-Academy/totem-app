/* Totem backoffice schema. SQL Server / Azure SQL Database. Safe to rerun. */
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF OBJECT_ID(N'dbo.SchemaMigrations', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SchemaMigrations (
    Version int NOT NULL CONSTRAINT PK_SchemaMigrations PRIMARY KEY,
    Name nvarchar(200) NOT NULL,
    Checksum char(64) NOT NULL,
    AppliedAt datetime2(3) NOT NULL CONSTRAINT DF_SchemaMigrations_AppliedAt DEFAULT SYSUTCDATETIME()
  );
END;
GO

IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Users (
    Id uniqueidentifier NOT NULL CONSTRAINT PK_Users PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    Email nvarchar(320) NOT NULL,
    EmailNormalized AS UPPER(LTRIM(RTRIM(Email))) PERSISTED,
    DisplayName nvarchar(150) NOT NULL,
    Role varchar(10) NOT NULL CONSTRAINT CK_Users_Role CHECK (Role IN ('admin','user')),
    PasswordHash nvarchar(300) NOT NULL,
    IsActive bit NOT NULL CONSTRAINT DF_Users_IsActive DEFAULT 1,
    CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt datetime2(3) NOT NULL CONSTRAINT DF_Users_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_Users_EmailNormalized UNIQUE (EmailNormalized)
  );
END;
GO

IF OBJECT_ID(N'dbo.UserSessions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.UserSessions (
    Id uniqueidentifier NOT NULL CONSTRAINT PK_UserSessions PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    UserId uniqueidentifier NOT NULL,
    TokenHash char(64) NOT NULL,
    CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_UserSessions_CreatedAt DEFAULT SYSUTCDATETIME(),
    ExpiresAt datetime2(3) NOT NULL,
    RevokedAt datetime2(3) NULL,
    CONSTRAINT FK_UserSessions_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id) ON DELETE CASCADE,
    CONSTRAINT UQ_UserSessions_TokenHash UNIQUE (TokenHash)
  );
END;
GO

IF OBJECT_ID(N'dbo.OneTimeTokens', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.OneTimeTokens (
    Id uniqueidentifier NOT NULL CONSTRAINT PK_OneTimeTokens PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    UserId uniqueidentifier NOT NULL,
    TokenHash char(64) NOT NULL,
    Purpose varchar(16) NOT NULL CONSTRAINT CK_OneTimeTokens_Purpose CHECK (Purpose IN ('activation','recovery')),
    CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_OneTimeTokens_CreatedAt DEFAULT SYSUTCDATETIME(),
    ExpiresAt datetime2(3) NOT NULL,
    UsedAt datetime2(3) NULL,
    CONSTRAINT FK_OneTimeTokens_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id) ON DELETE CASCADE,
    CONSTRAINT UQ_OneTimeTokens_TokenHash UNIQUE (TokenHash)
  );
END;
GO

IF OBJECT_ID(N'dbo.Visualisations', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Visualisations (
    Id uniqueidentifier NOT NULL CONSTRAINT PK_Visualisations PRIMARY KEY,
    Name nvarchar(160) NOT NULL,
    Kind varchar(16) NOT NULL CONSTRAINT CK_Visualisations_Kind CHECK (Kind IN ('visualisation','system')),
    IsProtected bit NOT NULL CONSTRAINT DF_Visualisations_IsProtected DEFAULT 0,
    IsDeleted bit NOT NULL CONSTRAINT DF_Visualisations_IsDeleted DEFAULT 0,
    OwnerId uniqueidentifier NULL,
    CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_Visualisations_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt datetime2(3) NOT NULL CONSTRAINT DF_Visualisations_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Visualisations_Users FOREIGN KEY (OwnerId) REFERENCES dbo.Users(Id)
  );
END;
GO

IF OBJECT_ID(N'dbo.VisualisationDrafts', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.VisualisationDrafts (
    VisualisationId uniqueidentifier NOT NULL CONSTRAINT PK_VisualisationDrafts PRIMARY KEY,
    DocumentJson nvarchar(max) NOT NULL CONSTRAINT CK_VisualisationDrafts_Json CHECK (ISJSON(DocumentJson)=1),
    Revision int NOT NULL CONSTRAINT DF_VisualisationDrafts_Revision DEFAULT 1,
    UpdatedBy uniqueidentifier NULL,
    UpdatedAt datetime2(3) NOT NULL CONSTRAINT DF_VisualisationDrafts_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_VisualisationDrafts_Visualisations FOREIGN KEY (VisualisationId) REFERENCES dbo.Visualisations(Id) ON DELETE CASCADE,
    CONSTRAINT FK_VisualisationDrafts_Users FOREIGN KEY (UpdatedBy) REFERENCES dbo.Users(Id)
  );
END;
GO

IF OBJECT_ID(N'dbo.VisualisationVersions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.VisualisationVersions (
    Id uniqueidentifier NOT NULL CONSTRAINT PK_VisualisationVersions PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    VisualisationId uniqueidentifier NOT NULL,
    VersionNumber int NOT NULL,
    DocumentJson nvarchar(max) NOT NULL CONSTRAINT CK_VisualisationVersions_Json CHECK (ISJSON(DocumentJson)=1),
    PublishedBy uniqueidentifier NULL,
    PublishedAt datetime2(3) NOT NULL CONSTRAINT DF_VisualisationVersions_PublishedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_VisualisationVersions_Visualisations FOREIGN KEY (VisualisationId) REFERENCES dbo.Visualisations(Id),
    CONSTRAINT FK_VisualisationVersions_Users FOREIGN KEY (PublishedBy) REFERENCES dbo.Users(Id),
    CONSTRAINT UQ_VisualisationVersions_Number UNIQUE (VisualisationId,VersionNumber)
  );
END;
GO

IF OBJECT_ID(N'dbo.Templates', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Templates (
    Id uniqueidentifier NOT NULL CONSTRAINT PK_Templates PRIMARY KEY,
    Name nvarchar(160) NOT NULL,
    Description nvarchar(500) NOT NULL,
    DocumentJson nvarchar(max) NOT NULL CONSTRAINT CK_Templates_Json CHECK (ISJSON(DocumentJson)=1),
    IsSystem bit NOT NULL CONSTRAINT DF_Templates_IsSystem DEFAULT 0,
    CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_Templates_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt datetime2(3) NOT NULL CONSTRAINT DF_Templates_UpdatedAt DEFAULT SYSUTCDATETIME()
  );
END;
GO

IF OBJECT_ID(N'dbo.Assets', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Assets (
    Id uniqueidentifier NOT NULL CONSTRAINT PK_Assets PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    FileName nvarchar(260) NOT NULL,
    ContentType varchar(120) NOT NULL,
    SizeBytes bigint NOT NULL CONSTRAINT CK_Assets_Size CHECK (SizeBytes > 0),
    Sha256 char(64) NOT NULL,
    StorageKey nvarchar(600) NOT NULL,
    CreatedBy uniqueidentifier NULL,
    Environment varchar(20) NOT NULL CONSTRAINT DF_Assets_Environment DEFAULT 'development',
    CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_Assets_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_Assets_Environment CHECK (Environment IN ('development','production')),
    CONSTRAINT FK_Assets_Users FOREIGN KEY (CreatedBy) REFERENCES dbo.Users(Id)
  );
END;
GO

-- Upgrade an existing database; pre-existing media belongs to local development.
IF COL_LENGTH(N'dbo.Assets', N'Environment') IS NULL
BEGIN
  ALTER TABLE dbo.Assets ADD Environment varchar(20) NOT NULL
    CONSTRAINT DF_Assets_Environment DEFAULT 'development' WITH VALUES;
END;
GO
IF OBJECT_ID(N'dbo.CK_Assets_Environment', N'C') IS NULL
BEGIN
  ALTER TABLE dbo.Assets ADD CONSTRAINT CK_Assets_Environment
    CHECK (Environment IN ('development','production'));
END;
GO

IF OBJECT_ID(N'dbo.DraftAssets', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.DraftAssets (
    VisualisationId uniqueidentifier NOT NULL,
    AssetId uniqueidentifier NOT NULL,
    CONSTRAINT PK_DraftAssets PRIMARY KEY (VisualisationId,AssetId),
    CONSTRAINT FK_DraftAssets_Drafts FOREIGN KEY (VisualisationId) REFERENCES dbo.VisualisationDrafts(VisualisationId) ON DELETE CASCADE,
    CONSTRAINT FK_DraftAssets_Assets FOREIGN KEY (AssetId) REFERENCES dbo.Assets(Id)
  );
END;
GO

IF OBJECT_ID(N'dbo.VersionAssets', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.VersionAssets (
    VersionId uniqueidentifier NOT NULL,
    AssetId uniqueidentifier NOT NULL,
    CONSTRAINT PK_VersionAssets PRIMARY KEY (VersionId,AssetId),
    CONSTRAINT FK_VersionAssets_Versions FOREIGN KEY (VersionId) REFERENCES dbo.VisualisationVersions(Id),
    CONSTRAINT FK_VersionAssets_Assets FOREIGN KEY (AssetId) REFERENCES dbo.Assets(Id)
  );
END;
GO

IF OBJECT_ID(N'dbo.Devices', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Devices (
    Id uniqueidentifier NOT NULL CONSTRAINT PK_Devices PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    Name nvarchar(160) NOT NULL,
    CredentialHash char(64) NULL,
    IsActive bit NOT NULL CONSTRAINT DF_Devices_IsActive DEFAULT 1,
    CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_Devices_CreatedAt DEFAULT SYSUTCDATETIME(),
    LastSeenAt datetime2(3) NULL
  );
END;
GO

IF OBJECT_ID(N'dbo.AuditEvents', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.AuditEvents (
    Id bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_AuditEvents PRIMARY KEY,
    UserId uniqueidentifier NULL,
    Action varchar(80) NOT NULL,
    EntityType varchar(60) NOT NULL,
    EntityId nvarchar(80) NULL,
    DetailsJson nvarchar(max) NULL CONSTRAINT CK_AuditEvents_Json CHECK (DetailsJson IS NULL OR ISJSON(DetailsJson)=1),
    CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_AuditEvents_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_AuditEvents_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id)
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.UserSessions') AND name=N'IX_UserSessions_User_Expiry')
  CREATE INDEX IX_UserSessions_User_Expiry ON dbo.UserSessions(UserId,ExpiresAt) INCLUDE(RevokedAt);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.Visualisations') AND name=N'IX_Visualisations_Catalogue')
  CREATE INDEX IX_Visualisations_Catalogue ON dbo.Visualisations(IsDeleted,Kind,UpdatedAt);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.VisualisationVersions') AND name=N'IX_VisualisationVersions_Latest')
  CREATE INDEX IX_VisualisationVersions_Latest ON dbo.VisualisationVersions(VisualisationId,VersionNumber DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.AuditEvents') AND name=N'IX_AuditEvents_CreatedAt')
  CREATE INDEX IX_AuditEvents_CreatedAt ON dbo.AuditEvents(CreatedAt DESC);
GO

CREATE OR ALTER VIEW dbo.vw_VisualisationOverview AS
SELECT v.Id,v.Name,v.Kind,v.IsProtected,v.OwnerId,u.DisplayName AS OwnerName,v.CreatedAt,v.UpdatedAt,d.Revision,
  (SELECT MAX(x.VersionNumber) FROM dbo.VisualisationVersions x WHERE x.VisualisationId=v.Id) AS LatestPublishedVersion
FROM dbo.Visualisations v LEFT JOIN dbo.Users u ON u.Id=v.OwnerId
LEFT JOIN dbo.VisualisationDrafts d ON d.VisualisationId=v.Id
WHERE v.IsDeleted=0;
GO

CREATE OR ALTER VIEW dbo.vw_PublicationHistory AS
SELECT x.Id AS VersionId,x.VisualisationId,v.Name,x.VersionNumber,x.PublishedBy,u.DisplayName AS PublishedByName,x.PublishedAt
FROM dbo.VisualisationVersions x JOIN dbo.Visualisations v ON v.Id=x.VisualisationId
LEFT JOIN dbo.Users u ON u.Id=x.PublishedBy;
GO

CREATE OR ALTER VIEW dbo.vw_AssetUsage AS
SELECT a.Id AS AssetId,a.FileName,a.ContentType,a.SizeBytes,a.Sha256,
  (SELECT COUNT_BIG(*) FROM dbo.DraftAssets d WHERE d.AssetId=a.Id) AS DraftReferences,
  (SELECT COUNT_BIG(*) FROM dbo.VersionAssets x WHERE x.AssetId=a.Id) AS PublishedReferences,
  a.CreatedAt
FROM dbo.Assets a;
GO

CREATE OR ALTER VIEW dbo.vw_UserOverview AS
SELECT u.Id,u.Email,u.DisplayName,u.Role,u.IsActive,u.CreatedAt,u.UpdatedAt,
  (SELECT COUNT_BIG(*) FROM dbo.UserSessions s WHERE s.UserId=u.Id AND s.RevokedAt IS NULL AND s.ExpiresAt>SYSUTCDATETIME()) AS ActiveSessions
FROM dbo.Users u;
GO

CREATE OR ALTER VIEW dbo.vw_AuditTimeline AS
SELECT a.Id,a.UserId,u.DisplayName AS ActorName,a.Action,a.EntityType,a.EntityId,a.DetailsJson,a.CreatedAt
FROM dbo.AuditEvents a LEFT JOIN dbo.Users u ON u.Id=a.UserId;
GO

DECLARE @BaseId uniqueidentifier='00000000-0000-4000-8000-000000000001';
DECLARE @TemplateId uniqueidentifier='00000000-0000-4000-8000-000000000002';
DECLARE @BaseDoc nvarchar(max)=N'{"schemaVersion":1,"width":1080,"height":1920,"name":"Totem original","screens":[{"id":"home","name":"Inicio","mode":"embedded","elements":[{"id":"welcome","type":"text","x":40,"y":40,"width":1000,"height":100,"text":"Welcome to the Swiss Tech Center","fontSize":48,"color":"#033778"},{"id":"demo-robotic","type":"card","x":40,"y":170,"width":470,"height":180,"title":"Robotic assembly","description":"A cobot that follows the car to assemble it","target":"robotic","locked":true},{"id":"demo-lab","type":"card","x":550,"y":170,"width":470,"height":180,"title":"Lab automation","description":"A cobot that loads samples into the analyser","target":"lab","locked":true},{"id":"demo-ai","type":"card","x":40,"y":380,"width":470,"height":180,"title":"AI caricatures","description":"A robot draws your portrait","target":"ai","locked":true},{"id":"demo-music","type":"card","x":550,"y":380,"width":470,"height":180,"title":"Music without barriers","description":"A robot plays the piano","target":"music","locked":true}]},{"id":"robotic","name":"Robotic assembly","mode":"fullscreen","elements":[{"id":"robotic-title","type":"text","x":80,"y":160,"width":920,"height":160,"text":"Robotic assembly","fontSize":68,"color":"#ffffff","locked":true},{"id":"robotic-copy","type":"text","x":80,"y":360,"width":920,"height":240,"text":"Explore the Swiss Tech Center demonstration","fontSize":40,"color":"#ffffff"}]},{"id":"lab","name":"Lab automation","mode":"fullscreen","elements":[{"id":"lab-title","type":"text","x":80,"y":160,"width":920,"height":160,"text":"Lab automation","fontSize":68,"color":"#ffffff","locked":true}]},{"id":"ai","name":"AI caricatures","mode":"fullscreen","elements":[{"id":"ai-title","type":"text","x":80,"y":160,"width":920,"height":160,"text":"AI caricatures","fontSize":68,"color":"#ffffff","locked":true}]},{"id":"music","name":"Music without barriers","mode":"fullscreen","elements":[{"id":"music-title","type":"text","x":80,"y":160,"width":920,"height":160,"text":"Music without barriers","fontSize":68,"color":"#ffffff","locked":true}]}]}';
DECLARE @TemplateDoc nvarchar(max)=N'{"schemaVersion":1,"width":1080,"height":1920,"name":"ERNI base","regions":{"header":{"x":0,"y":0,"width":1080,"height":110,"locked":true},"hero":{"x":0,"y":110,"width":1080,"height":580,"locked":true},"canvas":{"x":0,"y":690,"width":1080,"height":1080,"locked":false},"footer":{"x":0,"y":1770,"width":1080,"height":150,"locked":true}},"screens":[{"id":"home","name":"Inicio","mode":"embedded","elements":[]}]}';
IF NOT EXISTS (SELECT 1 FROM dbo.Visualisations WHERE Id=@BaseId)
BEGIN
  INSERT dbo.Visualisations(Id,Name,Kind,IsProtected) VALUES(@BaseId,N'Totem original','system',1);
  INSERT dbo.VisualisationDrafts(VisualisationId,DocumentJson,Revision) VALUES(@BaseId,@BaseDoc,1);
  INSERT dbo.VisualisationVersions(VisualisationId,VersionNumber,DocumentJson) VALUES(@BaseId,1,@BaseDoc);
END;
IF NOT EXISTS (SELECT 1 FROM dbo.Templates WHERE Id=@TemplateId)
  INSERT dbo.Templates(Id,Name,Description,DocumentJson,IsSystem) VALUES(@TemplateId,N'ERNI base',N'Plantilla inspirada en totem-web. Cabecera, hero y footer protegidos; zona central editable.',@TemplateDoc,1);
IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigrations WHERE Version=1)
  INSERT dbo.SchemaMigrations(Version,Name,Checksum) VALUES(1,N'Initial Totem schema',REPLICATE('0',64));
GO

