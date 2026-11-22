using System.ComponentModel.DataAnnotations;

namespace OnlineCourseManagement.DTOs;

public sealed class CategoryInputDto
{
    [Required, MaxLength(100)] public string Name { get; set; } = "";
    [MaxLength(4000)] public string? Description { get; set; }
}

public sealed record CategoryResponseDto(int Id, string Name, string? Description);
