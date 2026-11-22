using Microsoft.Extensions.Diagnostics.HealthChecks;
using OnlineCourseManagement.Data;

namespace OnlineCourseManagement.Health;

public sealed class DatabaseHealthCheck(AppDbContext db) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken token = default)
    {
        try
        {
            return await db.Database.CanConnectAsync(token)
                ? HealthCheckResult.Healthy()
                : HealthCheckResult.Unhealthy("Database is unavailable.");
        }
        catch (Exception) when (!token.IsCancellationRequested)
        {
            return HealthCheckResult.Unhealthy("Database is unavailable.");
        }
    }
}
