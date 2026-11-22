using System.ComponentModel.DataAnnotations;

namespace OnlineCourseManagement.Options;

public sealed class FileStorageOptions
{
    public const string SectionName = "FileStorage";
    [Required] public string RootPath { get; set; } = "Uploads";
    [Range(1, 50_000_000)] public long MaxImageBytes { get; set; } = 5_000_000;
    [Range(1, 50_000_000)] public long MaxDocumentBytes { get; set; } = 10_000_000;
    public long MaxRequestBytes => Math.Max(MaxImageBytes, MaxDocumentBytes) + 1_000_000;
}
