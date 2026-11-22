USE [OnlineCourseDB];
GO
SET NOCOUNT ON;

-- Read-only evidence for the presentation. Does not return hashes or session stamps.
SELECT @@SERVERNAME AS ServerName, DB_NAME() AS DatabaseName;
SELECT Role, COUNT_BIG(*) AS Total FROM dbo.Users GROUP BY Role ORDER BY Role;

-- Expected: 0 rows. Course assignments must point to the matching role.
SELECT c.Id AS CourseId, c.Title, c.InstructorId, teacher.Role AS InstructorRole,
       c.StaffId, staff.Role AS StaffRole
FROM dbo.Courses c
LEFT JOIN dbo.Users teacher ON teacher.Id = c.InstructorId
LEFT JOIN dbo.Users staff ON staff.Id = c.StaffId
WHERE (c.InstructorId IS NOT NULL AND (teacher.Id IS NULL OR teacher.Role <> N'Instructor'))
   OR (c.StaffId IS NOT NULL AND (staff.Id IS NULL OR staff.Role <> N'Staff'));

-- Expected: 0 rows. Progress must belong to a lesson in the enrolled course.
SELECT p.Id AS ProgressId, e.StudentId, e.CourseId AS EnrolledCourseId,
       p.LessonId, l.CourseId AS LessonCourseId
FROM dbo.LessonProgresses p
JOIN dbo.Enrollments e ON e.Id = p.EnrollmentId
JOIN dbo.Lessons l ON l.Id = p.LessonId
WHERE e.CourseId <> l.CourseId;

-- Expected: 0 rows. Lesson document metadata must reference the same course.
SELECT f.Id AS FileId, f.LessonId, f.CourseId, l.CourseId AS LessonCourseId
FROM dbo.UploadedFiles f
LEFT JOIN dbo.Lessons l ON l.Id = f.LessonId
WHERE f.FileType = N'LessonDocument'
  AND (l.Id IS NULL OR f.CourseId IS NULL OR f.CourseId <> l.CourseId);

-- Evidence: assigned people and total lessons (no private account fields).
SELECT c.Id, c.Title, teacher.FullName AS InstructorName, staff.FullName AS StaffName,
       (SELECT COUNT(*) FROM dbo.Lessons l WHERE l.CourseId = c.Id) AS TotalLessons
FROM dbo.Courses c
LEFT JOIN dbo.Users teacher ON teacher.Id = c.InstructorId
LEFT JOIN dbo.Users staff ON staff.Id = c.StaffId
ORDER BY c.Id;

-- Evidence: real learning activity. Times are stored as UTC by the API.
SELECT e.Id AS EnrollmentId, student.FullName AS StudentName, c.Title AS CourseName,
       e.EnrolledAt AS EnrolledAtUtc,
       (SELECT COUNT(*) FROM dbo.Lessons l WHERE l.CourseId = e.CourseId) AS TotalLessons,
       (SELECT COUNT(*) FROM dbo.LessonProgresses p JOIN dbo.Lessons l ON l.Id = p.LessonId
        WHERE p.EnrollmentId = e.Id AND p.IsCompleted = 1 AND l.CourseId = e.CourseId) AS CompletedLessons
FROM dbo.Enrollments e
JOIN dbo.Users student ON student.Id = e.StudentId
JOIN dbo.Courses c ON c.Id = e.CourseId
ORDER BY e.EnrolledAt DESC;
