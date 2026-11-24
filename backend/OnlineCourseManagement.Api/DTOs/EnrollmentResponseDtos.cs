namespace OnlineCourseManagement.DTOs;

public sealed record EnrollmentResponseDto(int Id, int StudentId, int CourseId, DateTime EnrolledAt);

public sealed record MyEnrollmentDto(int EnrollmentId, int CourseId, string CourseName,
    string? Description, decimal Price, DateTime EnrolledAt);

public sealed record EnrollmentSummaryDto(int Id, int StudentId, string StudentName,
    string StudentEmail, int CourseId, string CourseName, DateTime EnrolledAt);

public sealed record EnrolledStudentDto(int EnrollmentId, int StudentId,
    string FullName, string Email, DateTime EnrolledAt);

public sealed record CourseStudentsDto(int CourseId, string CourseName,
    int TotalStudents, List<EnrolledStudentDto> Students);
