-- Seed 500 test users with pagination testing
DECLARE @i INT;
SELECT @i = ISNULL(MAX(Id), 0) + 1 FROM [Users];

DECLARE @MaxId INT = 500;
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

	-- Fake password hash for testing
	SET @PasswordHash = CONCAT('AQAAAAIAAYagP/2JM7R5kLWV8JF', @i);

	IF NOT EXISTS (SELECT 1 FROM [Users] WHERE Email = @Email)
	BEGIN
		INSERT INTO [Users] ([FullName], [Email], [PasswordHash], [Role], [CreatedAt])
		VALUES (
			@FullName, 
			@Email, 
			@PasswordHash,
			@Role, 
			DATEADD(DAY, -@i, GETUTCDATE())
		);
	END

	SET @i = @i + 1;
END

-- Verify seeding
SELECT 
	COUNT(*) as TotalUsers,
	SUM(CASE WHEN Role = 'Admin' THEN 1 ELSE 0 END) as AdminCount,
	SUM(CASE WHEN Role = 'Instructor' THEN 1 ELSE 0 END) as InstructorCount,
	SUM(CASE WHEN Role = 'Student' THEN 1 ELSE 0 END) as StudentCount
FROM [Users];
