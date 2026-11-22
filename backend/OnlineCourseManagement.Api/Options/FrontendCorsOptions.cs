namespace OnlineCourseManagement.Options;

public sealed class FrontendCorsOptions
{
    public const string SectionName = "Cors";
    public string[] AllowedOrigins { get; set; } = [];

    public bool HasValidOrigins() => AllowedOrigins is not null && AllowedOrigins.All(origin =>
        Uri.TryCreate(origin, UriKind.Absolute, out var uri) &&
        uri.Scheme is "http" or "https" && !origin.Contains('*') &&
        uri.AbsolutePath == "/" && string.IsNullOrEmpty(uri.Query) &&
        string.IsNullOrEmpty(uri.Fragment) && string.IsNullOrEmpty(uri.UserInfo));
}
