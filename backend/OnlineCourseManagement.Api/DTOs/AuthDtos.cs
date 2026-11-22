using System.ComponentModel.DataAnnotations;

namespace OnlineCourseManagement.DTOs
{
    public class RegisterDto
    {
        [Required, MaxLength(100)]
        public string FullName { get; set; } = "";

        [Required, EmailAddress, MaxLength(255)]
        public string Email { get; set; } = "";

        [Required, MinLength(8)]
        public string Password { get; set; } = "";

        public string Role { get; set; } = "User";
    }

    public class LoginDto
    {
        [Required, EmailAddress, MaxLength(255)]
        public string Email { get; set; } = "";

        [Required]
        public string Password { get; set; } = "";
    }
}
