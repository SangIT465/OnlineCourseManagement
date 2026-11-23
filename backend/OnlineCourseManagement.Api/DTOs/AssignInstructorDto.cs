using System.ComponentModel.DataAnnotations;

namespace OnlineCourseManagement.DTOs
{
    public class AssignInstructorDto
    {
        [Range(1, int.MaxValue)]
        public required int? InstructorId { get; set; }
    }
}
