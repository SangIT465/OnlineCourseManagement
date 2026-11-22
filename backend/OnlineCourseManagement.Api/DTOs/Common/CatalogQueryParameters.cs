using System.ComponentModel.DataAnnotations;

namespace OnlineCourseManagement.DTOs.Common;

public sealed class CourseQueryParameters : PaginationQuery, IValidatableObject
{
    [MaxLength(200)] public string? Search { get; set; }
    [Range(1, int.MaxValue)] public int? CategoryId { get; set; }
    [Range(1, int.MaxValue)] public int? InstructorId { get; set; }
    [Range(typeof(decimal), "0", "9999999999999999.99")] public decimal? MinPrice { get; set; }
    [Range(typeof(decimal), "0", "9999999999999999.99")] public decimal? MaxPrice { get; set; }
    public string SortBy { get; set; } = "createdat";
    public bool IsDescending { get; set; } = true;

    public IEnumerable<ValidationResult> Validate(ValidationContext context)
    {
        if (MinPrice.HasValue && MaxPrice.HasValue && MinPrice > MaxPrice)
            yield return new("MinPrice must not exceed MaxPrice.", [nameof(MinPrice), nameof(MaxPrice)]);
        if (!new[] { "title", "price", "createdat" }.Contains(SortBy?.ToLowerInvariant()))
            yield return new("SortBy must be title, price or createdat.", [nameof(SortBy)]);
    }
}

public sealed class LessonQueryParameters : PaginationQuery, IValidatableObject
{
    [MaxLength(200)] public string? Search { get; set; }
    [Range(1, int.MaxValue)] public int? CourseId { get; set; }
    public string SortBy { get; set; } = "order";
    public bool IsDescending { get; set; }
    public IEnumerable<ValidationResult> Validate(ValidationContext context)
    {
        if (!new[] { "title", "duration", "order" }.Contains(SortBy?.ToLowerInvariant()))
            yield return new("SortBy must be title, duration or order.", [nameof(SortBy)]);
    }
}
