using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using OnlineCourseManagement.Middleware;

namespace OnlineCourseManagement.Api.Tests;

public sealed class RequestLoggingTests
{
    [Theory]
    [InlineData("client-request.123", true)]
    [InlineData("", false)]
    [InlineData("unsafe request id with spaces", false)]
    public async Task Request_ids_are_safe_and_sensitive_input_is_never_logged(string requested, bool kept)
    {
        var context = new DefaultHttpContext();
        context.Request.Method = "POST";
        context.Request.Path = "/api/auth/login";
        context.Request.QueryString = new QueryString("?token=private-query");
        context.Request.Headers.Authorization = "Bearer private-authorization";
        context.Request.Headers["X-Request-ID"] = requested;
        var logger = new CaptureLogger();
        var middleware = new RequestLoggingMiddleware(http =>
        {
            http.Response.StatusCode = 204;
            return Task.CompletedTask;
        }, logger);
        await middleware.InvokeAsync(context);
        if (kept) Assert.Equal(requested, context.TraceIdentifier);
        else Assert.True(Guid.TryParseExact(context.TraceIdentifier, "N", out _));
        Assert.Contains("/api/auth/login", string.Join(" ", logger.Messages));
        Assert.DoesNotContain("private-query", string.Join(" ", logger.Messages));
        Assert.DoesNotContain("private-authorization", string.Join(" ", logger.Messages));
    }

    private sealed class CaptureLogger : ILogger<RequestLoggingMiddleware>
    {
        public List<string> Messages { get; } = [];
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel level) => true;
        public void Log<TState>(LogLevel level, EventId id, TState state, Exception? error, Func<TState, Exception?, string> format) =>
            Messages.Add(format(state, error));
    }
}
