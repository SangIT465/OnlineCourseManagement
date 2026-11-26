using System.Globalization;
using System.Text;
using OnlineCourseManagement.DTOs;

namespace OnlineCourseManagement.Services;

public static class EnrollmentReport
{
    public static string Render(IEnumerable<EnrollmentReportRow> rows)
    {
        var csv = new StringBuilder("Mã học viên,Họ tên,Email,Mã khóa học,Khóa học,Ngày ghi danh (UTC),Tổng bài học,Bài hoàn thành,Tiến độ (%)\r\n");
        foreach (var row in rows)
        {
            var percentage = row.TotalLessons == 0 ? 0 : Math.Round(row.CompletedLessons * 100m / row.TotalLessons, 2);
            string[] cells = [row.StudentId.ToString(CultureInfo.InvariantCulture), row.StudentName, row.StudentEmail,
                row.CourseId.ToString(CultureInfo.InvariantCulture), row.CourseName,
                row.EnrolledAt.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture),
                row.TotalLessons.ToString(CultureInfo.InvariantCulture), row.CompletedLessons.ToString(CultureInfo.InvariantCulture),
                percentage.ToString(CultureInfo.InvariantCulture)];
            csv.AppendJoin(',', cells.Select(Cell)).Append("\r\n");
        }
        return csv.ToString();
    }

    private static string Cell(string value)
    {
        // Text entered by users must not become an Excel formula.
        var trimmed = value.TrimStart();
        if (trimmed.Length > 0 && "=+-@".Contains(trimmed[0]) || value.StartsWith('\t') || value.StartsWith('\r') || value.StartsWith('\n'))
            value = "'" + value;
        return "\"" + value.Replace("\"", "\"\"") + "\"";
    }
}
