using System.ComponentModel.DataAnnotations;

namespace OnlineCourseManagement.Validation;

public sealed class HttpUrlAttribute : ValidationAttribute
{
    public HttpUrlAttribute() => ErrorMessage = "The URL must use HTTP or HTTPS.";
    public override bool IsValid(object? value) => value is null || value is string text &&
        (text.Length == 0 || Uri.TryCreate(text, UriKind.Absolute, out var uri) && uri.Scheme is "http" or "https");
}
