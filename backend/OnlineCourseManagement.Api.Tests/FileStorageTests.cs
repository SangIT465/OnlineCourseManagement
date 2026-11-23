using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.FileProviders;
using OnlineCourseManagement.Exceptions;
using OnlineCourseManagement.Options;
using OnlineCourseManagement.Services;
using System.IO.Compression;
using System.Text;

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

    [Theory]
    [InlineData(".docx", "word/document.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml", "document")]
    [InlineData(".pptx", "ppt/presentation.xml", "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml", "presentation")]
    [InlineData(".xlsx", "xl/workbook.xml", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml", "workbook")]
    public async Task Office_packages_are_validated_and_keep_their_original_content_type(string extension, string main, string mime, string root)
    {
        using var stream = OfficePackage(main, mime, root);
        var input = new FormFile(stream, 0, stream.Length, "file", "document" + extension) { Headers = new HeaderDictionary(), ContentType = "application/pdf" };
        var stored = await Storage().SaveAsync(input, "LessonDocument", default);
        Assert.Equal(LearningFileFormats.ContentType(extension), stored.ContentType);
        Assert.EndsWith(extension, stored.StoredName);
    }

    [Theory]
    [InlineData("mismatch")]
    [InlineData("macro")]
    [InlineData("traversal")]
    [InlineData("external")]
    [InlineData("xml-entity")]
    public async Task Invalid_Office_packages_are_rejected_and_not_left_on_disk(string kind)
    {
        var main = kind == "mismatch" ? "ppt/presentation.xml" : "word/document.xml";
        using var stream = OfficePackage(main, "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml", "document", kind);
        var input = new FormFile(stream, 0, stream.Length, "file", "document.docx");
        await Assert.ThrowsAsync<BusinessException>(() => Storage(10000).SaveAsync(input, "LessonDocument", default));
        Assert.Empty(Directory.GetFiles(_root, "*", SearchOption.AllDirectories));
    }

    [Fact]
    public async Task Lesson_images_and_UTF8_text_are_supported_without_executing_HTML()
    {
        var content = "<script>alert('example')</script>\nNội dung tiếng Việt";
        using var text = new MemoryStream(Encoding.UTF8.GetBytes(content));
        var stored = await Storage().SaveAsync(new FormFile(text, 0, text.Length, "file", "notes.txt"), "LessonDocument", default);
        Assert.Equal("text/plain; charset=utf-8", stored.ContentType);
        Assert.Equal(content, await File.ReadAllTextAsync(Storage().GetPath("LessonDocument", stored.StoredName)));
        using var image = new MemoryStream(new byte[] {137,80,78,71,13,10,26,10,0,0,0,0});
        var png = await Storage().SaveAsync(new FormFile(image, 0, image.Length, "file", "lesson.png"), "LessonDocument", default);
        Assert.Equal("image/png", png.ContentType);
    }

    [Fact]
    public async Task Binary_text_executables_and_renamed_zip_files_are_rejected()
    {
        foreach (var name in new[] { "bad.txt", "bad.exe", "bad.docx" })
        {
            using var stream = new MemoryStream(new byte[] {0,1,2,3,4,5,6});
            await Assert.ThrowsAsync<BusinessException>(() => Storage().SaveAsync(new FormFile(stream,0,stream.Length,"file",name),"LessonDocument",default));
        }
    }

    private static MemoryStream OfficePackage(string main, string mime, string root, string kind = "valid")
    {
        var output = new MemoryStream();
        using (var zip = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: true))
        {
            void Add(string path, string text) { using var writer = new StreamWriter(zip.CreateEntry(path).Open()); writer.Write(text); }
            Add("[Content_Types].xml", $"<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Override PartName=\"/{main}\" ContentType=\"{mime}\" /></Types>");
            Add(main, kind == "xml-entity" ? "<!DOCTYPE document [<!ENTITY sample SYSTEM 'file:///not-read'>]><document>&sample;</document>" : $"<{root} />");
            if (kind == "macro") Add("word/vbaProject.bin", "macro");
            if (kind == "traversal") Add("../outside.xml", "outside");
            if (kind == "external") Add("word/_rels/document.xml.rels", "<Relationships><Relationship Type=\"image\" TargetMode=\"External\" Target=\"https://example.invalid/image.png\" /></Relationships>");
        }
        output.Position = 0;
        return output;
    }

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
