using System.Diagnostics;
using System.Text.RegularExpressions;

namespace OnlineCourseManagement.Middleware;

public sealed partial class RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
{
    [GeneratedRegex("^[a-zA-Z0-9._-]{1,64}$", RegexOptions.CultureInvariant)]
    private static partial Regex SafeRequestId();

    public async Task InvokeAsync(HttpContext context)
    {
        var incoming = context.Request.Headers["X-Request-ID"].ToString();
        context.TraceIdentifier = SafeRequestId().IsMatch(incoming) ? incoming : Guid.NewGuid().ToString("N");
        context.Response.OnStarting(() =>
        {
            context.Response.Headers["X-Request-ID"] = context.TraceIdentifier;
            return Task.CompletedTask;
        });
        using var scope = logger.BeginScope(new Dictionary<string, object> { ["TraceId"] = context.TraceIdentifier });
        var started = Stopwatch.GetTimestamp();
        try { await next(context); }
        finally
        {
            // Never log request bodies, query strings, cookies or Authorization headers.
            logger.LogInformation("HTTP {Method} {Path} returned {StatusCode} in {ElapsedMs} ms",
                context.Request.Method, context.Request.Path.Value, context.Response.StatusCode,
                Math.Round(Stopwatch.GetElapsedTime(started).TotalMilliseconds, 2));
        }
    }
}
