using System.ComponentModel.DataAnnotations;

namespace OnlineCourseManagement.DTOs
{
    public class ResetPasswordDto
    {
        [Required(ErrorMessage = "Vui lòng nhập mật khẩu mới")]
        [MinLength(8, ErrorMessage = "Mật khẩu phải có ít nhất 8 ký tự")]
        public string NewPassword { get; set; } = string.Empty;
    }
}
