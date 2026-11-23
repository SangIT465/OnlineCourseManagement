using System.ComponentModel.DataAnnotations;

namespace OnlineCourseManagement.DTOs;

public class AssignStaffDto
{
    [Range(1, int.MaxValue)]
    public required int? StaffId { get; set; }
}
