-- Seed 500 test users
SET NOCOUNT ON;

DECLARE @i INT;
SELECT @i = ISNULL(MAX(Id), 0) + 1 FROM [Users];

DECLARE @MaxId INT;
SET @MaxId = @i + 499;  -- Create 500 more users

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
DECLARE @TotalUsers INT = (SELECT COUNT(*) FROM [Users]);
DECLARE @AdminCount INT = (SELECT COUNT(*) FROM [Users] WHERE Role = 'Admin');
DECLARE @InstructorCount INT = (SELECT COUNT(*) FROM [Users] WHERE Role = 'Instructor');
DECLARE @StudentCount INT = (SELECT COUNT(*) FROM [Users] WHERE Role = 'Student');

SELECT 
	@TotalUsers AS TotalUsers,
	@AdminCount AS AdminCount,
	@InstructorCount AS InstructorCount,
	@StudentCount AS StudentCount;

SELECT TOP 10 Id, FullName, Email, Role, CreatedAt 
FROM [Users] 
ORDER BY Id DESC;
