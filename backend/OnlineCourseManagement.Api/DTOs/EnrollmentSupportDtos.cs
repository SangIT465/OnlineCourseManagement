using System.ComponentModel.DataAnnotations;

namespace OnlineCourseManagement.DTOs;

public sealed class SupportEnrollmentDto
{
    [Range(1, int.MaxValue)] public int StudentId { get; set; }
    [Range(1, int.MaxValue)] public int CourseId { get; set; }
}

public sealed class EnrollmentReportQuery
{
    [Range(1, int.MaxValue)] public int? CourseId { get; set; }
    [MaxLength(200)] public string? Search { get; set; }
}

public sealed record EnrollmentReportRow(int StudentId, string StudentName, string StudentEmail,
    int CourseId, string CourseName, DateTime EnrolledAt, int TotalLessons, int CompletedLessons);
