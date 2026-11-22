using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using OnlineCourseManagement.Security;

namespace OnlineCourseManagement.Models
{
    public class User
    {
        public int Id { get; set; }

        [Required, MaxLength(100)]
        public string FullName { get; set; } = string.Empty;

        [Required, MaxLength(255)]
        public string Email { get; set; } = string.Empty;

        [Required]
        [JsonIgnore]
        public string PasswordHash { get; set; } = string.Empty;

        [Required]
        public string Role { get; set; } = AppRoles.User;

        [Required, MaxLength(64)]
        [JsonIgnore]
        public string SecurityStamp { get; set; } = Guid.NewGuid().ToString("N");

        public DateTime CreatedAt { get; set; }
            = DateTime.UtcNow;
    }
}
