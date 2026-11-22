using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.FileProviders;
using OnlineCourseManagement.Exceptions;
using OnlineCourseManagement.Options;
using OnlineCourseManagement.Services;

namespace OnlineCourseManagement.Api.Tests;

public sealed class FileStorageTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "courseflow-storage-tests-" + Guid.NewGuid().ToString("N"));

    private LocalFileStorage Storage(long maximum = 1024) => new(
        Microsoft.Extensions.Options.Options.Create(new FileStorageOptions { RootPath = _root, MaxDocumentBytes = maximum }),
        new EnvironmentStub { ContentRootPath = Path.GetTempPath() });

    [Fact]
    public async Task Valid_pdf_uses_safe_name_and_server_detected_content_type()
    {
        var storage = Storage();
        var content = "%PDF-1.4\n%%EOF"u8.ToArray();
        using var stream = new MemoryStream(content);
        var input = new FormFile(stream, 0, stream.Length, "file", "../../notes.pdf") { Headers = new HeaderDictionary(), ContentType = "text/plain" };
        var stored = await storage.SaveAsync(input, "LessonDocument", default);
        Assert.Equal("application/pdf", stored.ContentType);
        Assert.True(Guid.TryParseExact(Path.GetFileNameWithoutExtension(stored.StoredName), "N", out _));
        Assert.Equal(content, await File.ReadAllBytesAsync(storage.GetPath("LessonDocument", stored.StoredName)));
        storage.Delete("LessonDocument", stored.StoredName);
        Assert.False(File.Exists(storage.GetPath("LessonDocument", stored.StoredName)));
    }

    [Fact]
    public async Task Invalid_signatures_and_configured_size_limit_are_enforced()
    {
        using var invalid = new MemoryStream("not a PDF"u8.ToArray());
        var input = new FormFile(invalid, 0, invalid.Length, "file", "notes.pdf");
        Assert.Equal(BusinessError.InvalidInput, (await Assert.ThrowsAsync<BusinessException>(() => Storage().SaveAsync(input, "LessonDocument", default))).Error);
        Assert.Equal(BusinessError.InvalidInput, (await Assert.ThrowsAsync<BusinessException>(() => Storage(2).SaveAsync(input, "LessonDocument", default))).Error);
    }

    [Fact]
    public void Stored_names_cannot_escape_the_configured_directory() =>
        Assert.Throws<BusinessException>(() => Storage().GetPath("LessonDocument", "../../outside.pdf"));

    public void Dispose()
    {
        var absolute = Path.GetFullPath(_root);
        if (!absolute.StartsWith(Path.GetFullPath(Path.GetTempPath()), StringComparison.OrdinalIgnoreCase) ||
            !Path.GetFileName(absolute).StartsWith("courseflow-storage-tests-", StringComparison.Ordinal))
            throw new InvalidOperationException("Unexpected cleanup directory.");
        if (Directory.Exists(absolute)) Directory.Delete(absolute, recursive: true);
    }

    private sealed class EnvironmentStub : IWebHostEnvironment
    {
        public string ApplicationName { get; set; } = "Tests";
        public string EnvironmentName { get; set; } = "Testing";
        public string ContentRootPath { get; set; } = "";
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
        public string WebRootPath { get; set; } = "";
        public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
    }
}
