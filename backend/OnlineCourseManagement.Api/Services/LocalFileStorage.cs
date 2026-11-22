using Microsoft.Extensions.Options;
using OnlineCourseManagement.Exceptions;
using OnlineCourseManagement.Options;

namespace OnlineCourseManagement.Services;

public sealed class LocalFileStorage(IOptions<FileStorageOptions> configured, IWebHostEnvironment environment) : IFileStorage
{
    private readonly FileStorageOptions _options = configured.Value;
    private readonly string _root = Path.GetFullPath(configured.Value.RootPath, environment.ContentRootPath);

    public string GetPath(string fileType, string storedName)
    {
        var folder = fileType switch
        {
            "CourseImage" => "course-images",
            "LessonDocument" => "lesson-documents",
            _ => throw BusinessException.Invalid("Loại học liệu không hợp lệ.")
        };
        var extension = Path.GetExtension(storedName).ToLowerInvariant();
        if (Path.GetFileName(storedName) != storedName ||
            !Guid.TryParseExact(Path.GetFileNameWithoutExtension(storedName), "N", out _) ||
            !AllowedExtension(fileType, extension))
            throw BusinessException.Invalid("Tên file lưu trữ không hợp lệ.");
        return Path.Combine(_root, folder, storedName);
    }

    public async Task<StoredFile> SaveAsync(IFormFile file, string fileType, CancellationToken token)
    {
        if (file.Length <= 0) throw BusinessException.Invalid("Vui lòng chọn file.");
        var limit = fileType == "CourseImage" ? _options.MaxImageBytes : _options.MaxDocumentBytes;
        if (file.Length > limit) throw BusinessException.Invalid("File vượt quá dung lượng cho phép.");
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedExtension(fileType, extension)) throw BusinessException.Invalid("Định dạng file không hợp lệ.");
        await using var input = file.OpenReadStream();
        var header = new byte[12];
        var read = await input.ReadAtLeastAsync(header, (int)Math.Min(header.Length, file.Length), false, token);
        if (!FileSignatures.IsValid(header.AsSpan(0, read), extension))
            throw BusinessException.Invalid("Nội dung file không phù hợp với định dạng.");
        var name = $"{Guid.NewGuid():N}{extension}";
        var path = GetPath(fileType, name);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var contentType = extension switch
        {
            ".jpg" or ".jpeg" => "image/jpeg", ".png" => "image/png", ".webp" => "image/webp", _ => "application/pdf"
        };
        try
        {
            await using var output = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None);
            await output.WriteAsync(header.AsMemory(0, read), token);
            await input.CopyToAsync(output, token);
            if (output.Length > limit) throw BusinessException.Invalid("File vượt quá dung lượng cho phép.");
            return new(name, contentType, output.Length);
        }
        catch
        {
            if (File.Exists(path)) File.Delete(path);
            throw;
        }
    }

    public void Delete(string fileType, string storedName)
    {
        var path = GetPath(fileType, storedName);
        if (File.Exists(path)) File.Delete(path);
    }

    private static bool AllowedExtension(string type, string extension) => type switch
    {
        "CourseImage" => extension is ".jpg" or ".jpeg" or ".png" or ".webp",
        "LessonDocument" => extension == ".pdf",
        _ => false
    };
}

public static class FileSignatures
{
    public static bool IsValid(ReadOnlySpan<byte> header, string extension) => extension switch
    {
        ".jpg" or ".jpeg" => header.Length >= 3 && header[0] == 255 && header[1] == 216 && header[2] == 255,
        ".png" => header.Length >= 8 && header[..8].SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }),
        ".webp" => header.Length >= 12 && header[..4].SequenceEqual("RIFF"u8) && header[8..12].SequenceEqual("WEBP"u8),
        ".pdf" => header.Length >= 5 && header[..5].SequenceEqual("%PDF-"u8),
        _ => false
    };
}
