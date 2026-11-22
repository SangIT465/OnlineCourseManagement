namespace OnlineCourseManagement.Exceptions;

public enum BusinessError { InvalidInput, NotFound, Forbidden, Conflict, Unauthenticated }

/// <summary>A business failure translated into an HTTP response by the global handler.</summary>
public sealed class BusinessException(BusinessError error, string message) : Exception(message)
{
    public BusinessError Error { get; } = error;
    public static BusinessException Invalid(string message) => new(BusinessError.InvalidInput, message);
    public static BusinessException NotFound(string message) => new(BusinessError.NotFound, message);
    public static BusinessException Forbidden() => new(BusinessError.Forbidden, "Bạn không có quyền thực hiện thao tác này.");
    public static BusinessException Conflict(string message) => new(BusinessError.Conflict, message);
    public static BusinessException Unauthenticated() => new(BusinessError.Unauthenticated, "Vui lòng đăng nhập lại.");
}
