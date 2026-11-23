using System.ComponentModel.DataAnnotations;
using OnlineCourseManagement.DTOs;
using OnlineCourseManagement.DTOs.Common;

namespace OnlineCourseManagement.Api.Tests;

public sealed class QueryValidationTests
{
    [Fact]
    public void Pagination_stays_bounded_and_cannot_overflow_skip()
    {
        var query = new CourseQueryParameters { PageNumber = int.MaxValue, PageSize = int.MaxValue };
        Assert.InRange(query.PageSize, 1, 100);
        Assert.True(checked((query.PageNumber - 1) * query.PageSize) >= 0);
        query.PageNumber = -1;
        query.PageSize = 0;
        Assert.Equal(1, query.PageNumber);
        Assert.Equal(1, query.PageSize);
    }

    [Fact]
    public void Filtering_rejects_reversed_price_range_and_unknown_sort_field()
    {
        Assert.False(Valid(new CourseQueryParameters { MinPrice = 500, MaxPrice = 100 }));
        Assert.False(Valid(new CourseQueryParameters { SortBy = "passwordHash" }));
        Assert.True(Valid(new CourseQueryParameters { MinPrice = 0, MaxPrice = 500, SortBy = "price" }));
    }

    [Theory]
    [InlineData("javascript:alert(1)", false)]
    [InlineData("ftp://example.com/video.mp4", false)]
    [InlineData("https://example.com/video", true)]
    [InlineData("", true)]
    public void Lesson_video_accepts_only_optional_http_urls(string url, bool valid) =>
        Assert.Equal(valid, Valid(new CreateLessonDto { Title = "Lesson", CourseId = 1, OrderIndex = 1, VideoUrl = url }));

    [Fact]
    public void Page_count_handles_empty_results_and_large_totals()
    {
        Assert.Equal(0, new PagedResult<int>([], 0, 1, 10).TotalPages);
        Assert.Equal(214748365, new PagedResult<int>([], int.MaxValue, 1, 10).TotalPages);
        Assert.Throws<ArgumentOutOfRangeException>(() => new PagedResult<int>([], 1, 1, 0));
    }

    private static bool Valid(object input) => Validator.TryValidateObject(input, new ValidationContext(input), [], true);

    [Theory]
    [InlineData(null, true)]
    [InlineData(1, true)]
    [InlineData(0, false)]
    [InlineData(-1, false)]
    public void Assignment_accepts_explicit_unassignment_but_rejects_invalid_account_ids(int? id, bool valid)
    {
        Assert.Equal(valid, Valid(new AssignInstructorDto { InstructorId = id }));
        Assert.Equal(valid, Valid(new AssignStaffDto { StaffId = id }));
    }

    [Fact]
    public void Assignment_json_requires_the_field_but_accepts_explicit_null()
    {
        var options = new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web);
        Assert.Throws<System.Text.Json.JsonException>(() => System.Text.Json.JsonSerializer.Deserialize<AssignInstructorDto>("{}", options));
        Assert.Throws<System.Text.Json.JsonException>(() => System.Text.Json.JsonSerializer.Deserialize<AssignStaffDto>("{}", options));
        Assert.Null(System.Text.Json.JsonSerializer.Deserialize<AssignInstructorDto>("{\"instructorId\":null}", options)!.InstructorId);
        Assert.Null(System.Text.Json.JsonSerializer.Deserialize<AssignStaffDto>("{\"staffId\":null}", options)!.StaffId);
    }
}
