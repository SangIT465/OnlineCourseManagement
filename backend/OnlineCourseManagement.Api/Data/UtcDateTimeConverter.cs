using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace OnlineCourseManagement.Data;

// SQL datetime2 preserves ticks but not DateTime.Kind. All application timestamps are UTC.
public sealed class UtcDateTimeConverter() : ValueConverter<DateTime, DateTime>(
    value => value.Kind == DateTimeKind.Local ? value.ToUniversalTime() : value,
    value => DateTime.SpecifyKind(value, DateTimeKind.Utc));
