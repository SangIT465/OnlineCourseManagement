USE [OnlineCourseDB];
GO
SET NOCOUNT ON;

-- Run with F5 in SSMS. These queries only read application data.
SELECT @@SERVERNAME AS ServerName, DB_NAME() AS DatabaseName;

SELECT N'Users' AS TableName, COUNT_BIG(*) AS Total FROM dbo.Users
UNION ALL SELECT N'Categories', COUNT_BIG(*) FROM dbo.Categories
UNION ALL SELECT N'Courses', COUNT_BIG(*) FROM dbo.Courses
UNION ALL SELECT N'Lessons', COUNT_BIG(*) FROM dbo.Lessons
UNION ALL SELECT N'Enrollments', COUNT_BIG(*) FROM dbo.Enrollments
UNION ALL SELECT N'LessonProgresses', COUNT_BIG(*) FROM dbo.LessonProgresses
UNION ALL SELECT N'UploadedFiles', COUNT_BIG(*) FROM dbo.UploadedFiles;

SELECT Role, COUNT(*) AS Total FROM dbo.Users GROUP BY Role ORDER BY Role;

SELECT c.Id, c.Title, c.Price, cat.Name AS CategoryName,
       teacher.FullName AS InstructorName, staff.FullName AS StaffName,
       (SELECT COUNT(*) FROM dbo.Lessons l WHERE l.CourseId = c.Id) AS TotalLessons
FROM dbo.Courses c
LEFT JOIN dbo.Categories cat ON cat.Id = c.CategoryId
LEFT JOIN dbo.Users teacher ON teacher.Id = c.InstructorId
LEFT JOIN dbo.Users staff ON staff.Id = c.StaffId
ORDER BY c.Id;

SELECT TOP (30) l.Id, l.CourseId, c.Title AS CourseName, l.Title,
       l.OrderIndex, l.DurationMinutes, l.Content
FROM dbo.Lessons l
INNER JOIN dbo.Courses c ON c.Id = l.CourseId
ORDER BY l.CourseId, l.OrderIndex;

SELECT TOP (30) e.Id, student.FullName AS StudentName, c.Title AS CourseName, e.EnrolledAt
FROM dbo.Enrollments e
INNER JOIN dbo.Users student ON student.Id = e.StudentId
INNER JOIN dbo.Courses c ON c.Id = e.CourseId
ORDER BY e.EnrolledAt DESC;

SELECT MigrationId, ProductVersion FROM dbo.__EFMigrationsHistory ORDER BY MigrationId;
