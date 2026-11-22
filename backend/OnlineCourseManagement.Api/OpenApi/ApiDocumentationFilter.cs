using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.OpenApi;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace OnlineCourseManagement.OpenApi;

public sealed class ApiDocumentationFilter : IOperationFilter
{
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        var metadata = context.ApiDescription.ActionDescriptor.EndpointMetadata;
        var authorized = metadata.OfType<IAuthorizeData>().Any() && !metadata.OfType<IAllowAnonymous>().Any();
        if (!authorized) operation.Security = [];
        operation.Responses ??= new OpenApiResponses();
        var schema = context.SchemaGenerator.GenerateSchema(typeof(ProblemDetails), context.SchemaRepository);
        foreach (var (status, description) in new[]
        {
            ("400", "Invalid request or validation failure"),
            ("404", "Resource not found"),
            ("409", "Related data, duplicate value or concurrent change"),
            ("500", "Unexpected failure; use traceId for support")
        })
            operation.Responses.TryAdd(status, new OpenApiResponse
            {
                Description = description,
                Content = new Dictionary<string, OpenApiMediaType>
                {
                    ["application/problem+json"] = new() { Schema = schema }
                }
            });
        if (authorized)
        {
            operation.Responses.TryAdd("401", new OpenApiResponse { Description = "Missing, expired or revoked JWT" });
            operation.Responses.TryAdd("403", new OpenApiResponse { Description = "Role, permission or course ownership denied" });
        }
    }
}
