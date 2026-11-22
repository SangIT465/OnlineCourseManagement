namespace OnlineCourseManagement.DTOs.Common;

public class PaginationQuery
{
    private int _pageNumber = 1;
    private int _pageSize = 10;
    public int PageNumber { get => _pageNumber; set => _pageNumber = Math.Clamp(value, 1, 1_000_000); }
    public int PageSize { get => _pageSize; set => _pageSize = Math.Clamp(value, 1, 100); }
    internal int Skip => (PageNumber - 1) * PageSize;
}
