using Microsoft.EntityFrameworkCore;
using OnlineCourseManagement.Data;
using OnlineCourseManagement.Models;

namespace OnlineCourseManagement.Api.Tests;

public sealed class UtcTimestampTests
{
    [Fact]
    public void Sql_timestamp_reads_preserve_ticks_and_restore_utc_kind()
    {
        var converter = new UtcDateTimeConverter();
        var sqlValue = new DateTime(2026, 11, 22, 15, 0, 0, DateTimeKind.Unspecified).AddTicks(1234567);
        var value = Assert.IsType<DateTime>(converter.ConvertFromProvider(sqlValue));
        Assert.Equal(sqlValue.Ticks, value.Ticks);
        Assert.Equal(DateTimeKind.Utc, value.Kind);
        Assert.EndsWith("Z", System.Text.Json.JsonSerializer.Serialize(value).Trim('"'));
    }

    [Fact]
    public void Writes_normalize_local_time_and_preserve_existing_utc_or_unspecified_ticks()
    {
        var converter = new UtcDateTimeConverter();
        var utc = new DateTime(2026, 11, 22, 15, 0, 0, DateTimeKind.Utc);
        Assert.Equal(utc.Ticks, Assert.IsType<DateTime>(converter.ConvertToProvider(utc.ToLocalTime())).Ticks);
        Assert.Equal(utc.Ticks, Assert.IsType<DateTime>(converter.ConvertToProvider(utc)).Ticks);
        Assert.Equal(utc.Ticks, Assert.IsType<DateTime>(converter.ConvertToProvider(DateTime.SpecifyKind(utc, DateTimeKind.Unspecified))).Ticks);
    }

    [Fact]
    public void All_entity_timestamps_including_nullable_completion_use_the_utc_converter()
    {
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer("Server=(local);Database=ModelOnly;Integrated Security=True;TrustServerCertificate=True").Options);
        var properties = db.Model.GetEntityTypes().SelectMany(entity => entity.GetProperties())
            .Where(property => property.ClrType == typeof(DateTime) || property.ClrType == typeof(DateTime?)).ToList();
        Assert.Contains(properties, property => property.DeclaringType.ClrType == typeof(LessonProgress) && property.Name == nameof(LessonProgress.CompletedAt));
        Assert.All(properties, property => Assert.IsType<UtcDateTimeConverter>(property.GetValueConverter()));
        Assert.Null(db.Model.FindEntityType(typeof(LessonProgress))!.FindProperty(nameof(LessonProgress.CompletedAt))!
            .GetValueConverter()!.ConvertFromProvider(null));
    }
}
