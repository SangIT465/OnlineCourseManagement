-- Seed 1000 test users
SET NOCOUNT ON;

DECLARE @i INT;
SELECT @i = ISNULL(MAX(Id), 0) + 1 FROM [Users];

DECLARE @MaxId INT;
SET @MaxId = @i + 999;  -- Create 1000 more users

DECLARE @FullName NVARCHAR(100);
DECLARE @Email NVARCHAR(255);
DECLARE @Role NVARCHAR(20);
DECLARE @PasswordHash NVARCHAR(MAX);

WHILE @i <= @MaxId
BEGIN
	SET @FullName = CONCAT('User ', @i);
	SET @Email = CONCAT('user', @i, '@example.com');

	IF @i % 15 = 0
		SET @Role = 'Admin';
	ELSE IF @i % 5 = 0
		SET @Role = 'Instructor';
	ELSE
		SET @Role = 'Student';

	SET @PasswordHash = CONCAT('hash_password_', @i);

	IF NOT EXISTS (SELECT 1 FROM [Users] WHERE Email = @Email)
	BEGIN
		INSERT INTO [Users] ([FullName], [Email], [PasswordHash], [Role], [CreatedAt])
		VALUES (
			@FullName, 
			@Email, 
			@PasswordHash,
			@Role, 
			DATEADD(DAY, -(@i - 1), GETUTCDATE())
		);
	END

	SET @i = @i + 1;
END

-- Verify results
SELECT COUNT(*) as TotalUsers FROM [Users];
SELECT 'Admin' as Role, COUNT(*) as Count FROM [Users] WHERE Role = 'Admin'
UNION ALL
SELECT 'Instructor', COUNT(*) FROM [Users] WHERE Role = 'Instructor'
UNION ALL
SELECT 'Student', COUNT(*) FROM [Users] WHERE Role = 'Student';

SELECT TOP 10 Id, FullName, Email, Role, CreatedAt 
FROM [Users] 
ORDER BY Id DESC;
