using System.ComponentModel.DataAnnotations;
using System.IdentityModel.Tokens.Jwt;
using OnlineCourseManagement.Models;
using OnlineCourseManagement.Options;
using OnlineCourseManagement.Security;
using OnlineCourseManagement.Services;

namespace OnlineCourseManagement.Api.Tests;

public sealed class ConfigurationAndJwtTests
{
    [Theory]
    [InlineData("", false)]
    [InlineData("short", false)]
    [InlineData("12345678901234567890123456789012", true)]
    public void Signing_keys_must_have_sufficient_UTF8_bytes(string key, bool valid) =>
        Assert.Equal(valid, new JwtOptionsValidator().Validate(null, new JwtOptions { Key = key }).Succeeded);

    [Fact]
    public void Token_contains_only_permissions_for_the_current_role_and_configured_lifetime()
    {
        var now = new DateTimeOffset(2026, 11, 22, 0, 0, 0, TimeSpan.Zero);
        var configured = new JwtOptions { Key = new string('k', 64), Issuer = "tests", Audience = "clients", ExpirationMinutes = 17 };
        var service = new JwtService(Microsoft.Extensions.Options.Options.Create(configured), new FixedTime(now));
        foreach (var role in AppRoles.All)
        {
            var user = new User { Id = 12, FullName = "Test User", Email = "user@example.test", Role = role };
            var jwt = new JwtSecurityTokenHandler().ReadJwtToken(service.GenerateToken(user));
            Assert.Equal(now.AddMinutes(17).UtcDateTime, jwt.ValidTo);
            Assert.Equal("tests", jwt.Issuer);
            Assert.Equal(["clients"], jwt.Audiences);
            Assert.Equal(AppPermissions.ForRole(role).Order(), jwt.Claims.Where(c => c.Type == AppPermissions.ClaimType).Select(c => c.Value).Order());
            Assert.Equal(user.SecurityStamp, jwt.Claims.Single(c => c.Type == AppRoles.SecurityStampClaim).Value);
            Assert.DoesNotContain(jwt.Claims, claim => claim.Type.Contains("password", StringComparison.OrdinalIgnoreCase));
        }
    }

    [Theory]
    [InlineData("https://courses.example.com", true)]
    [InlineData("http://localhost:5173", true)]
    [InlineData("*", false)]
    [InlineData("https://courses.example.com/private", false)]
    [InlineData("https://user:password@example.com", false)]
    public void Cors_accepts_only_exact_http_origins(string origin, bool valid) =>
        Assert.Equal(valid, new FrontendCorsOptions { AllowedOrigins = [origin] }.HasValidOrigins());

    [Theory]
    [InlineData(0)]
    [InlineData(1441)]
    public void Token_lifetime_is_bounded(int minutes)
    {
        var input = new JwtOptions
        {
            Key = new string('k', 64), Issuer = "tests", Audience = "clients", ExpirationMinutes = minutes
        };
        Assert.False(Validator.TryValidateObject(input, new ValidationContext(input), [], true));
    }

    private sealed class FixedTime(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
