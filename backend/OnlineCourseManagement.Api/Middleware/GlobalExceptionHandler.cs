using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using OnlineCourseManagement.Exceptions;

namespace OnlineCourseManagement.Middleware;

public sealed class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken token)
    {
        if (exception is OperationCanceledException && context.RequestAborted.IsCancellationRequested)
        {
            context.Response.StatusCode = 499;
            return true;
        }

        var status = exception switch
        {
            BusinessException { Error: BusinessError.InvalidInput } => 400,
            BusinessException { Error: BusinessError.Unauthenticated } => 401,
            BusinessException { Error: BusinessError.Forbidden } => 403,
            BusinessException { Error: BusinessError.NotFound } => 404,
            BusinessException { Error: BusinessError.Conflict } => 409,
            DbUpdateConcurrencyException => 409,
            DbUpdateException { InnerException: SqlException { Number: 2601 or 2627 or 547 } } => 409,
            BadHttpRequestException request => request.StatusCode,
            _ => 500
        };
        var message = exception is BusinessException business ? business.Message : status switch
        {
            409 => "Dữ liệu đã thay đổi hoặc đang có bản ghi liên quan. Vui lòng tải lại và kiểm tra.",
            413 => "Dữ liệu tải lên vượt quá dung lượng cho phép.",
            400 => "Dữ liệu yêu cầu không hợp lệ.",
            _ => "Có lỗi khi xử lý yêu cầu. Vui lòng thử lại hoặc cung cấp mã yêu cầu để được hỗ trợ."
        };
        if (status >= 500)
            logger.LogError(exception, "Unhandled request failure. TraceId={TraceId}", context.TraceIdentifier);
        else
            logger.LogWarning("Request rejected. StatusCode={StatusCode} TraceId={TraceId} Error={Error}",
                status, context.TraceIdentifier, exception.GetType().Name);

        var problem = new ProblemDetails
        {
            Status = status, Type = "about:blank", Title = message,
            Detail = message, Instance = context.Request.Path
        };
        problem.Extensions["message"] = message; // Keep compatibility with the existing frontend.
        problem.Extensions["traceId"] = context.TraceIdentifier;
        problem.Extensions["code"] = exception is BusinessException known ? known.Error.ToString() : "RequestFailure";
        context.Response.StatusCode = status;
        await context.Response.WriteAsJsonAsync(problem, JsonOptions, "application/problem+json", token);
        return true;
    }
}
