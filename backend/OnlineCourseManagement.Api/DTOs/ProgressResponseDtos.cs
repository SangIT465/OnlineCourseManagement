namespace OnlineCourseManagement.DTOs;

public sealed record LessonCompletionDto(int LessonId, bool IsCompleted, DateTime? CompletedAt);

public sealed record LessonProgressDto(int LessonId, string Title, int OrderIndex, bool IsCompleted);

public sealed record CourseProgressSummaryDto(int CourseId, string CourseName,
    int TotalLessons, int CompletedLessons, double Percentage);

public sealed record CourseProgressDto(int CourseId, string CourseName, int TotalLessons,
    int CompletedLessons, double Percentage, IReadOnlyList<LessonProgressDto> Lessons);

public sealed record StudentProgressDto(int StudentId, string StudentName, string StudentEmail,
    DateTime EnrolledAt, int TotalLessons, int CompletedLessons, double Percentage);

public sealed record CourseStudentsProgressDto(int CourseId, string CourseName,
    int TotalStudents, IReadOnlyList<StudentProgressDto> Students);
