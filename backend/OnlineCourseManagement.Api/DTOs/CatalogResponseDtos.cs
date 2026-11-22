namespace OnlineCourseManagement.DTOs;

public sealed record CourseResponseDto(int Id, string Title, string? Description, decimal Price,
    int CategoryId, string? CategoryName, int? InstructorId, int? StaffId,
    string? StaffName, string? InstructorName, DateTime CreatedAt);

public sealed record LessonSummaryDto(int Id, string Title, int DurationMinutes, int OrderIndex, int CourseId);

public sealed record LessonResponseDto(int Id, string Title, string? Content, string? VideoUrl,
    int DurationMinutes, int OrderIndex, int CourseId, DateTime CreatedAt);

public sealed record CourseCreatedDto(string Message, int Id, string Title, int? InstructorId, int? StaffId);
public sealed record LessonCreatedDto(string Message, int Id, string Title);
