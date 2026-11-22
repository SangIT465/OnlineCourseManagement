using System.ComponentModel.DataAnnotations;
using System.Text;
using Microsoft.Extensions.Options;

namespace OnlineCourseManagement.Options;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";
    [Required] public string Key { get; set; } = "";
    [Required] public string Issuer { get; set; } = "";
    [Required] public string Audience { get; set; } = "";
    [Range(1, 1440)] public int ExpirationMinutes { get; set; } = 120;
}

public sealed class JwtOptionsValidator : IValidateOptions<JwtOptions>
{
    public ValidateOptionsResult Validate(string? name, JwtOptions options) =>
        string.IsNullOrWhiteSpace(options.Key) || Encoding.UTF8.GetByteCount(options.Key) < 32
            ? ValidateOptionsResult.Fail("Jwt:Key must contain at least 32 UTF-8 bytes.")
            : ValidateOptionsResult.Success;
}
