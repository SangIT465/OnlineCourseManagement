using System.Data;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using OnlineCourseManagement.Models;

namespace OnlineCourseManagement.Data;

/// <summary>
/// Adds an explicitly requested demo catalog without changing existing records.
/// The entire operation is transactional and can be run repeatedly.
/// </summary>
public static class CourseCatalogSeeder
{
    public static async Task SeedAsync(
        AppDbContext db,
        ILogger logger,
        CancellationToken cancellationToken = default)
    {
        var path = Path.Combine(AppContext.BaseDirectory, "SeedData", "course-catalog.json");
        await using var stream = File.OpenRead(path);
        var catalog = await JsonSerializer.DeserializeAsync<CatalogDefinition>(
            stream, new JsonSerializerOptions(JsonSerializerDefaults.Web), cancellationToken)
            ?? throw new InvalidDataException("Dữ liệu khóa học mẫu không hợp lệ.");

        Validate(catalog);

        await using var transaction = await db.Database.BeginTransactionAsync(
            IsolationLevel.Serializable, cancellationToken);

        var existingCategories = await db.Categories.OrderBy(category => category.Id)
            .ToListAsync(cancellationToken);
        var categories = existingCategories.GroupBy(category => category.Name, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);
        var addedCategories = 0;

        foreach (var definition in catalog.Categories)
        {
            if (categories.ContainsKey(definition.Name)) continue;
            var category = new Category { Name = definition.Name, Description = definition.Description };
            db.Categories.Add(category);
            categories.Add(definition.Name, category);
            addedCategories++;
        }
        await db.SaveChangesAsync(cancellationToken);

        var existingCourses = await db.Courses.OrderBy(course => course.Id).ToListAsync(cancellationToken);
        var courses = existingCourses.GroupBy(course => CourseKey(course.CategoryId, course.Title))
            .ToDictionary(group => group.Key, group => group.First());
        var selected = new List<(Course Course, CourseDefinition Definition)>();
        var addedCourses = 0;

        // Interleave categories so the newest-course list covers different subjects.
        var maxCourses = catalog.Categories.Max(category => category.Courses.Count);
        for (var index = 0; index < maxCourses; index++)
        {
            foreach (var definition in catalog.Categories)
            {
                if (index >= definition.Courses.Count) continue;
                var input = definition.Courses[index];
                var categoryId = categories[definition.Name].Id;
                var key = CourseKey(categoryId, input.Title);
                if (!courses.TryGetValue(key, out var course))
                {
                    course = new Course
                    {
                        Title = input.Title,
                        Description = input.Description,
                        Price = input.Price,
                        CategoryId = categoryId,
                        CreatedAt = DateTime.UtcNow
                    };
                    db.Courses.Add(course);
                    courses.Add(key, course);
                    addedCourses++;
                }
                selected.Add((course, input));
            }
        }
        await db.SaveChangesAsync(cancellationToken);

        var courseIds = selected.Select(item => item.Course.Id).ToArray();
        var existingLessons = await db.Lessons.AsNoTracking()
            .Where(lesson => courseIds.Contains(lesson.CourseId))
            .Select(lesson => new { lesson.CourseId, lesson.OrderIndex })
            .ToListAsync(cancellationToken);
        var lessonPositions = existingLessons.Select(lesson => (lesson.CourseId, lesson.OrderIndex)).ToHashSet();
        var addedLessons = 0;

        foreach (var (course, definition) in selected)
        {
            for (var index = 0; index < definition.Lessons.Count; index++)
            {
                var order = index + 1;
                if (!lessonPositions.Add((course.Id, order))) continue;
                var input = definition.Lessons[index];
                db.Lessons.Add(new Lesson
                {
                    Title = input.Title,
                    Content = input.Content,
                    DurationMinutes = input.DurationMinutes,
                    OrderIndex = order,
                    CourseId = course.Id,
                    CreatedAt = DateTime.UtcNow
                });
                addedLessons++;
            }
        }
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        logger.LogInformation(
            "Nạp catalog hoàn tất: thêm {Categories} danh mục, {Courses} khóa học, {Lessons} bài học. Dữ liệu đã có được giữ nguyên.",
            addedCategories, addedCourses, addedLessons);
    }

    private static (int CategoryId, string Title) CourseKey(int categoryId, string title) =>
        (categoryId, title.ToUpperInvariant());

    private static void Validate(CatalogDefinition catalog)
    {
        if (catalog.Version != 1 || catalog.Categories is not { Count: > 0 })
            throw new InvalidDataException("Phiên bản hoặc danh sách danh mục mẫu không hợp lệ.");

        var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var category in catalog.Categories)
        {
            if (string.IsNullOrWhiteSpace(category.Name) || category.Name.Length > 100 ||
                !names.Add(category.Name) || category.Courses is not { Count: > 0 })
                throw new InvalidDataException("Danh mục mẫu không hợp lệ hoặc bị trùng tên.");

            var titles = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var course in category.Courses)
            {
                if (string.IsNullOrWhiteSpace(course.Title) || course.Title.Length > 200 ||
                    !titles.Add(course.Title) || course.Price < 0 ||
                    course.Lessons is not { Count: > 0 })
                    throw new InvalidDataException($"Khóa học mẫu không hợp lệ trong danh mục {category.Name}.");

                if (course.Lessons.Any(lesson => string.IsNullOrWhiteSpace(lesson.Title) ||
                    lesson.Title.Length > 200 || string.IsNullOrWhiteSpace(lesson.Content) ||
                    lesson.DurationMinutes <= 0))
                    throw new InvalidDataException($"Bài học mẫu không hợp lệ trong khóa {course.Title}.");
            }
        }
    }

    private sealed record CatalogDefinition(int Version, List<CategoryDefinition> Categories);
    private sealed record CategoryDefinition(string Name, string Description, List<CourseDefinition> Courses);
    private sealed record CourseDefinition(string Title, string Description, decimal Price, List<LessonDefinition> Lessons);
    private sealed record LessonDefinition(string Title, string Content, int DurationMinutes);
}
