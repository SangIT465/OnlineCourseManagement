using System.ComponentModel.DataAnnotations;

namespace OnlineCourseManagement.DTOs
{
    public class CreateCourseDto
    {
        [Required, MaxLength(200)]
        public string Title { get; set; } = "";

        public string? Description { get; set; }

        [Range(typeof(decimal), "0", "9999999999999999.99")]
        public decimal Price { get; set; }

        [Range(1, int.MaxValue)]
        public int CategoryId { get; set; }

        // Compatibility field only; teaching/staff assignments use dedicated Admin endpoints.
        public int? InstructorId { get; set; }
    }

    public class UpdateCourseDto : CreateCourseDto
    {
    }
}
