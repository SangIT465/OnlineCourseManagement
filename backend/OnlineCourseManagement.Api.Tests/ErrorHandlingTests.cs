using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using OnlineCourseManagement.Exceptions;
using OnlineCourseManagement.Middleware;

namespace OnlineCourseManagement.Api.Tests;

public sealed class ErrorHandlingTests
{
    [Theory]
    [InlineData(BusinessError.InvalidInput, 400)]
    [InlineData(BusinessError.Unauthenticated, 401)]
    [InlineData(BusinessError.Forbidden, 403)]
    [InlineData(BusinessError.NotFound, 404)]
    [InlineData(BusinessError.Conflict, 409)]
    public async Task Business_failures_have_status_and_traceable_problem_details(BusinessError error, int status)
    {
        var context = Context();
        var handler = new GlobalExceptionHandler(NullLogger<GlobalExceptionHandler>.Instance);
        Assert.True(await handler.TryHandleAsync(context, new BusinessException(error, "Safe message"), default));
        Assert.Equal(status, context.Response.StatusCode);
        context.Response.Body.Position = 0;
        using var body = await JsonDocument.ParseAsync(context.Response.Body);
        Assert.Equal(status, body.RootElement.GetProperty("status").GetInt32());
        Assert.Equal("qa-request", body.RootElement.GetProperty("traceId").GetString());
        Assert.Equal("Safe message", body.RootElement.GetProperty("message").GetString());
        Assert.StartsWith("application/problem+json", context.Response.ContentType);
    }

    [Fact]
    public async Task Unexpected_errors_do_not_expose_internal_details()
    {
        var context = Context();
        await new GlobalExceptionHandler(NullLogger<GlobalExceptionHandler>.Instance)
            .TryHandleAsync(context, new InvalidOperationException("Server=private;Password=do-not-expose"), default);
        context.Response.Body.Position = 0;
        var body = await new StreamReader(context.Response.Body).ReadToEndAsync();
        Assert.Equal(500, context.Response.StatusCode);
        Assert.DoesNotContain("do-not-expose", body);
        Assert.DoesNotContain("InvalidOperationException", body);
        Assert.Contains("qa-request", body);
    }

    [Fact]
    public async Task Request_size_errors_remain_413()
    {
        var context = Context();
        await new GlobalExceptionHandler(NullLogger<GlobalExceptionHandler>.Instance)
            .TryHandleAsync(context, new BadHttpRequestException("Too large", 413), default);
        Assert.Equal(413, context.Response.StatusCode);
    }

    private static DefaultHttpContext Context()
    {
        var context = new DefaultHttpContext { TraceIdentifier = "qa-request" };
        context.Request.Path = "/api/courses/99";
        context.Response.Body = new MemoryStream();
        return context;
    }
}
