namespace OnlineCourseManagement.DTOs.Common
{
    public class UserQueryParameters
    {
        private const int MaxPageSize = 100;

        private int _pageNumber = 1;
        public int PageNumber
        {
            get => _pageNumber;
            set => _pageNumber = Math.Max(1, value);
        }

        private int _pageSize = 10;
        public int PageSize
        {
            get => _pageSize;
            set => _pageSize = Math.Clamp(value, 1, MaxPageSize);
        }

        // Search (Từ khóa tìm chung: Email, FullName...)
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
