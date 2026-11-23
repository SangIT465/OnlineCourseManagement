using System.IO.Compression;
using System.Text;
using System.Xml;
using System.Xml.Linq;
using OnlineCourseManagement.Exceptions;

namespace OnlineCourseManagement.Services;

public static class LearningFileFormats
{
    public static bool IsImage(string extension) => extension is ".jpg" or ".jpeg" or ".png" or ".webp" or ".gif" or ".bmp";
    public static bool IsOffice(string extension) => extension is ".doc" or ".docx" or ".ppt" or ".pptx" or ".xls" or ".xlsx";
    public static bool IsText(string extension) => extension is ".txt" or ".csv";
    public static bool IsAllowed(string fileType, string extension) => fileType switch
    {
        "CourseImage" => extension is ".jpg" or ".jpeg" or ".png" or ".webp",
        "LessonDocument" => IsImage(extension) || IsOffice(extension) || IsText(extension) || extension == ".pdf",
        _ => false
    };
    public static string ContentType(string extension) => extension switch
    {
        ".jpg" or ".jpeg" => "image/jpeg", ".png" => "image/png", ".webp" => "image/webp",
        ".gif" => "image/gif", ".bmp" => "image/bmp", ".pdf" => "application/pdf",
        ".doc" => "application/msword", ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".ppt" => "application/vnd.ms-powerpoint", ".pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ".xls" => "application/vnd.ms-excel", ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".txt" => "text/plain; charset=utf-8", ".csv" => "text/csv; charset=utf-8",
        _ => throw BusinessException.Invalid("Định dạng tệp không được hỗ trợ.")
    };

    public static async Task ValidateDocumentAsync(string path, string extension, CancellationToken token)
    {
        if (extension is ".docx" or ".pptx" or ".xlsx")
        {
            try { ValidateOpenXml(path, extension); }
            catch (Exception error) when (error is InvalidDataException or XmlException or IOException or ArgumentException or OverflowException)
            { throw BusinessException.Invalid("Tệp Office bị hỏng hoặc nội dung không khớp định dạng. Hãy lưu lại tệp rồi thử lại."); }
        }
        else if (IsText(extension))
        {
            if (new FileInfo(path).Length > 1_000_000) throw BusinessException.Invalid("Tệp TXT/CSV tối đa 1 MB.");
            try
            {
                var text = new UTF8Encoding(false, true).GetString(await File.ReadAllBytesAsync(path, token));
                if (text.Any(c => char.IsControl(c) && c is not ('\r' or '\n' or '\t')))
                    throw BusinessException.Invalid("Tệp văn bản phải là UTF-8, không chứa dữ liệu nhị phân.");
            }
            catch (DecoderFallbackException) { throw BusinessException.Invalid("Hãy lưu tệp TXT/CSV bằng mã hóa UTF-8."); }
        }
        else if (extension is ".doc" or ".ppt" or ".xls")
        {
            var bytes = await File.ReadAllBytesAsync(path, token);
            var markers = extension switch { ".doc" => new[] { "WordDocument" }, ".ppt" => new[] { "PowerPoint Document" }, _ => new[] { "Workbook", "Book" } };
            if (!markers.Any(marker => bytes.AsSpan().IndexOf(Encoding.Unicode.GetBytes(marker)) >= 0))
                throw BusinessException.Invalid("Nội dung tệp Office không khớp phần mở rộng.");
        }
    }

    private static XDocument ReadXml(ZipArchiveEntry entry)
    {
        using var stream = entry.Open();
        using var reader = XmlReader.Create(stream, new XmlReaderSettings
        { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null, MaxCharactersInDocument = 2_000_000 });
        return XDocument.Load(reader);
    }

    private static void ValidateOpenXml(string path, string extension)
    {
        using var zip = ZipFile.OpenRead(path);
        if (zip.Entries.Count > 4096 || zip.Entries.Sum(entry => entry.Length) > 100_000_000)
            throw BusinessException.Invalid("Tài liệu Office có quá nhiều dữ liệu giải nén.");
        var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var entry in zip.Entries)
        {
            var name = entry.FullName;
            if (!names.Add(name) || name.StartsWith('/') || name.Contains('\\') || name.Split('/').Contains(".."))
                throw BusinessException.Invalid("Cấu trúc tệp Office không hợp lệ.");
            if (name.EndsWith("vbaProject.bin", StringComparison.OrdinalIgnoreCase))
                throw BusinessException.Invalid("Hãy lưu bản Office không có macro trước khi tải lên.");
            if (name.EndsWith(".rels", StringComparison.OrdinalIgnoreCase))
                foreach (var relation in ReadXml(entry).Descendants().Where(node => node.Name.LocalName == "Relationship"))
                    if ((string?)relation.Attribute("TargetMode") == "External" &&
                        !((string?)relation.Attribute("Type") ?? "").EndsWith("/hyperlink", StringComparison.Ordinal))
                        throw BusinessException.Invalid("Hãy nhúng ảnh và dữ liệu vào tệp Office thay vì liên kết đến tệp bên ngoài.");
        }
        var (mainPart, contentType, rootName) = extension switch
        {
            ".docx" => ("word/document.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml", "document"),
            ".pptx" => ("ppt/presentation.xml", "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml", "presentation"),
            _ => ("xl/workbook.xml", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml", "workbook")
        };
        var types = zip.GetEntry("[Content_Types].xml") ?? throw new InvalidDataException();
        if (!ReadXml(types).Descendants().Any(node => node.Name.LocalName == "Override" &&
            (string?)node.Attribute("PartName") == "/" + mainPart && (string?)node.Attribute("ContentType") == contentType))
            throw new InvalidDataException();
        var main = zip.GetEntry(mainPart) ?? throw new InvalidDataException();
        if (ReadXml(main).Root?.Name.LocalName != rootName) throw new InvalidDataException();
    }
}
