using Microsoft.IdentityModel.Tokens;
using OnlineCourseManagement.Models;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using OnlineCourseManagement.Security;
using Microsoft.Extensions.Options;
using OnlineCourseManagement.Options;

namespace OnlineCourseManagement.Services
{
    public class JwtService
    {
        private readonly JwtOptions _options;
        private readonly TimeProvider _time;

        public JwtService(IOptions<JwtOptions> options, TimeProvider time)
        {
            _options = options.Value;
            _time = time;
        }

        public string GenerateToken(User user)
        {
            var key = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(_options.Key));

            var credentials = new SigningCredentials(
                key,
                SecurityAlgorithms.HmacSha256);

            var claims = new List<Claim>
            {
                new Claim(
                    ClaimTypes.NameIdentifier,
                    user.Id.ToString()),

                new Claim(
                    ClaimTypes.Name,
                    user.FullName),

                new Claim(
                    ClaimTypes.Email,
                    user.Email),

                new Claim(
                    ClaimTypes.Role,
                    user.Role),

                new Claim(AppRoles.SecurityStampClaim, user.SecurityStamp)
            };
            claims.AddRange(AppPermissions.ForRole(user.Role)
                .Select(permission => new Claim(AppPermissions.ClaimType, permission)));

            var token = new JwtSecurityToken(
                issuer: _options.Issuer,
                audience: _options.Audience,
                claims: claims,
                expires: _time.GetUtcNow().UtcDateTime.AddMinutes(_options.ExpirationMinutes),
                signingCredentials: credentials
            );

            return new JwtSecurityTokenHandler()
                .WriteToken(token);
        }
    }
}
