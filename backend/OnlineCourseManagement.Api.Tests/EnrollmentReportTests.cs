using System.Globalization;
using OnlineCourseManagement.DTOs;
using OnlineCourseManagement.Services;

namespace OnlineCourseManagement.Api.Tests;

public sealed class EnrollmentReportTests
{
    [Theory]
    [InlineData("=HYPERLINK(\"https://example.test\")")]
    [InlineData(" +SUM(1,2)")]
    [InlineData("-1+2")]
    [InlineData("@SUM(1)")]
    [InlineData("\tDanger")]
    [InlineData("\rDanger")]
    public void Exported_user_text_cannot_become_a_spreadsheet_formula(string name)
    {
        var csv = EnrollmentReport.Render([Row(name)]);
        Assert.Contains("\"'" + name.Replace("\"", "\"\"") + "\"", csv);
    }

    [Fact]
    public void Vietnamese_names_quotes_and_newlines_are_preserved_as_single_CSV_cells()
    {
        var csv = EnrollmentReport.Render([Row("Nguyễn, \"An\"\nBình")]);
        Assert.Contains("\"Nguyễn, \"\"An\"\"\nBình\"", csv);
        Assert.Contains("Ngày ghi danh (UTC)", csv);
        Assert.Contains("2026-11-26T03:04:05Z", csv);
    }

    [Fact]
    public void Percentages_are_numeric_in_all_locales_and_empty_courses_have_zero_progress()
    {
        var original = CultureInfo.CurrentCulture;
        try
        {
            CultureInfo.CurrentCulture = CultureInfo.GetCultureInfo("vi-VN");
            var csv = EnrollmentReport.Render([Row("An"), Row("Bình") with { TotalLessons = 0, CompletedLessons = 0 }]);
            Assert.Contains("\"12.5\"\r\n", csv);
            Assert.EndsWith("\"0\",\"0\",\"0\"\r\n", csv);
        }
        finally { CultureInfo.CurrentCulture = original; }
    }

    private static EnrollmentReportRow Row(string name) => new(1, name, "learner@example.test", 2,
        "Khóa học", new DateTime(2026, 11, 26, 3, 4, 5, DateTimeKind.Utc), 8, 1);
}
