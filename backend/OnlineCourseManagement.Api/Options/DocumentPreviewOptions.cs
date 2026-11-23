using System.ComponentModel.DataAnnotations;

namespace OnlineCourseManagement.Options;

public sealed class DocumentPreviewOptions
{
    public const string SectionName = "DocumentPreview";
    public string ExecutablePath { get; set; } = "";
    [Range(5, 120)] public int TimeoutSeconds { get; set; } = 45;
}
