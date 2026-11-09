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

	-- Fake password hash (trong thực tế nên hash đúng)
	SET @PasswordHash = CONCAT('hash', @i);

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

-- Kiểm tra kết quả
SELECT COUNT(*) as TotalUsers FROM [Users];
SELECT TOP 10 Id, FullName, Email, Role, CreatedAt FROM [Users] ORDER BY Id DESC;
