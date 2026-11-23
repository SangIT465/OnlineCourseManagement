namespace OnlineCourseManagement.Options;

public sealed class PayOSPaymentOptions
{
    public const string SectionName = "PayOS";
    public string ClientId { get; set; } = "";
    public string ApiKey { get; set; } = "";
    public string ChecksumKey { get; set; } = "";
    public string FrontendUrl { get; set; } = "http://localhost:5173";
    public string SellerName { get; set; } = "CourseFlow";
    public string SellerAddress { get; set; } = "";
    public string SellerContact { get; set; } = "";
    public bool IsConfigured => IsCredential(ClientId) && IsCredential(ApiKey) && IsCredential(ChecksumKey);

    private static bool IsCredential(string value) => !string.IsNullOrWhiteSpace(value)
        && !value.Any(char.IsWhiteSpace)
        && !new[] { "DAN_", "DIEN_", "YOUR_", "CLIENT_ID", "API_KEY", "CHECKSUM_KEY", "<", ">" }
            .Any(marker => value.Contains(marker, StringComparison.OrdinalIgnoreCase));

    public bool IsValid() => Uri.TryCreate(FrontendUrl, UriKind.Absolute, out var url)
        && url.Scheme is "http" or "https" && string.IsNullOrEmpty(url.UserInfo)
        && string.IsNullOrEmpty(url.Query) && string.IsNullOrEmpty(url.Fragment)
        && !string.IsNullOrWhiteSpace(SellerName) && SellerName.Length <= 150
        && SellerAddress.Length <= 300 && SellerContact.Length <= 100;
}
