namespace OnlineCourseManagement.DTOs.Common
{
    public class UserQueryParameters : PaginationQuery
    {
        // Search (Từ khóa tìm chung: Email, FullName...)
        [System.ComponentModel.DataAnnotations.MaxLength(200)]
        public string? SearchTerm { get; set; }

        // Filter (Lọc theo trường cụ thể)
        public string? Role { get; set; }

        [Microsoft.AspNetCore.Mvc.ModelBinding.BindNever]
        public string[]? AllowedRoles { get; set; }

        // Sort
        public string? SortBy { get; set; } // Ví dụ: "email", "createdat"
        public bool IsDescending { get; set; } = false;
    }
}
