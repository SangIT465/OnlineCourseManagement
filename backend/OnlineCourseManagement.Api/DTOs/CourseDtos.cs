using System.ComponentModel.DataAnnotations;

namespace OnlineCourseManagement.DTOs
{
    public class CreateCourseDto
    {
        [Required, MaxLength(200)]
        public string Title { get; set; } = "";

        public string? Description { get; set; }

        [Range(0, double.MaxValue)]
        public decimal Price { get; set; }

        [Range(1, int.MaxValue)]
        public int CategoryId { get; set; }

        // Legacy field; assignment is controlled by /courses/{id}/staff.
        // Staff-created courses are assigned to the current Staff account.
        public int? InstructorId { get; set; }
    }

    public class UpdateCourseDto : CreateCourseDto
    {
    }
}
