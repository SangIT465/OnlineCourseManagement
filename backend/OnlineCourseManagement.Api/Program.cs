using System.Reflection;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using OnlineCourseManagement.Data;
using OnlineCourseManagement.Health;
using OnlineCourseManagement.Middleware;
using OnlineCourseManagement.Models;
using OnlineCourseManagement.OpenApi;
using OnlineCourseManagement.Options;
using OnlineCourseManagement.Repositories;
using OnlineCourseManagement.Security;
using OnlineCourseManagement.Services;

var seedCatalog = args.Contains("--seed-catalog", StringComparer.Ordinal);
var builder = WebApplication.CreateBuilder(args.Where(argument => argument != "--seed-catalog").ToArray());
builder.Logging.AddJsonConsole(options =>
{
    options.IncludeScopes = true;
    options.UseUtcTimestamp = true;
    options.TimestampFormat = "yyyy-MM-ddTHH:mm:ss.fffZ";
});

builder.Services.AddOptions<JwtOptions>().BindConfiguration(JwtOptions.SectionName)
    .ValidateDataAnnotations().ValidateOnStart();
builder.Services.AddSingleton<IValidateOptions<JwtOptions>, JwtOptionsValidator>();
builder.Services.AddOptions<FileStorageOptions>().BindConfiguration(FileStorageOptions.SectionName)
    .ValidateDataAnnotations().ValidateOnStart();
builder.Services.AddOptions<FrontendCorsOptions>().BindConfiguration(FrontendCorsOptions.SectionName)
    .Validate(options => options.HasValidOrigins(), "Cors:AllowedOrigins must contain exact HTTP(S) origins.")
    .ValidateOnStart();
builder.Services.AddOptions<FormOptions>().Configure<IOptions<FileStorageOptions>>((form, storage) =>
    form.MultipartBodyLengthLimit = storage.Value.MaxRequestBytes);
builder.Services.AddOptions<KestrelServerOptions>().Configure<IOptions<FileStorageOptions>>((server, storage) =>
    server.Limits.MaxRequestBodySize = storage.Value.MaxRequestBytes);

builder.Services.AddControllers().ConfigureApiBehaviorOptions(options =>
{
    options.InvalidModelStateResponseFactory = context =>
    {
        var problem = new ValidationProblemDetails(context.ModelState)
        {
            Status = 400, Title = "Vui lòng kiểm tra các trường dữ liệu.", Instance = context.HttpContext.Request.Path
        };
        problem.Extensions["traceId"] = context.HttpContext.TraceIdentifier;
        return new BadRequestObjectResult(problem) { ContentTypes = { "application/problem+json" } };
    };
});
builder.Services.AddProblemDetails(options => options.CustomizeProblemDetails = context =>
{
    context.ProblemDetails.Extensions["traceId"] = context.HttpContext.TraceIdentifier;
    context.ProblemDetails.Extensions.TryAdd("message", context.ProblemDetails.Title);
});
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("database", tags: ["ready"]);
builder.Services.AddCors();
builder.Services.AddOptions<Microsoft.AspNetCore.Cors.Infrastructure.CorsOptions>()
    .Configure<IOptions<FrontendCorsOptions>>((cors, frontend) =>
        cors.AddPolicy("Frontend", policy =>
        {
            if (frontend.Value.AllowedOrigins.Length > 0)
                policy.WithOrigins(frontend.Value.AllowedOrigins.Select(origin => origin.TrimEnd('/')).ToArray())
                    .AllowAnyHeader().AllowAnyMethod().WithExposedHeaders("X-Request-ID");
        }));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Online Course Management API", Version = "v1",
        Description = "Course catalog, enrollment, learning progress and four-role account management."
    });
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization", Description = "JWT returned by POST /api/auth/login",
        In = ParameterLocation.Header, Type = SecuritySchemeType.Http, Scheme = "bearer", BearerFormat = "JWT"
    });
    options.AddSecurityRequirement(document => new OpenApiSecurityRequirement
    {
        [new OpenApiSecuritySchemeReference("Bearer", document)] = new List<string>()
    });
    options.OperationFilter<ApiDocumentationFilter>();
    var xml = Path.Combine(AppContext.BaseDirectory, $"{Assembly.GetExecutingAssembly().GetName().Name}.xml");
    if (File.Exists(xml)) options.IncludeXmlComments(xml, includeControllerXmlComments: true);
});

builder.Services.AddDbContext<AppDbContext>(options => options.UseSqlServer(
    builder.Configuration.GetConnectionString("DefaultConnection")));
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddOptions<PayOSPaymentOptions>().BindConfiguration(PayOSPaymentOptions.SectionName)
    .Validate(options => options.IsValid(), "PayOS frontend URL and seller details must be valid.")
    .ValidateOnStart();
builder.Services.AddScoped<IPayOSGateway, PayOSGateway>();
builder.Services.AddScoped<PurchaseService>();
builder.Services.AddOptions<DemoPaymentOptions>().BindConfiguration(DemoPaymentOptions.SectionName);
builder.Services.AddScoped<DemoPaymentService>();
builder.Services.AddScoped<JwtService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<CurrentSessionJwtEvents>();
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IEnrollmentService, EnrollmentService>();
builder.Services.AddScoped<ILessonProgressService, LessonProgressService>();
builder.Services.AddScoped<ICourseAccessService, CourseAccessService>();
builder.Services.AddSingleton<IAuthorizationHandler, ManageCourseHandler>();
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.AddScoped<ICourseService, CourseService>();
builder.Services.AddScoped<ILessonService, LessonService>();
builder.Services.AddScoped<ICategoryService, CategoryService>();
builder.Services.AddScoped<IFileStorage, LocalFileStorage>();
builder.Services.AddOptions<DocumentPreviewOptions>().BindConfiguration(DocumentPreviewOptions.SectionName)
    .ValidateDataAnnotations().ValidateOnStart();
builder.Services.AddScoped<IOfficePreviewService, OfficePreviewService>();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<IOptions<JwtOptions>>((options, configured) =>
    {
        var jwt = configured.Value;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true, ValidateAudience = true, ValidateLifetime = true, ValidateIssuerSigningKey = true,
            ValidIssuer = jwt.Issuer, ValidAudience = jwt.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)), ClockSkew = TimeSpan.Zero
        };
        options.EventsType = typeof(CurrentSessionJwtEvents);
    });
builder.Services.AddAuthorization(AppPolicies.Configure);

var app = builder.Build();
if (seedCatalog)
{
    if (!app.Environment.IsDevelopment()) throw new InvalidOperationException("Sample catalog seeding requires Development.");
    await using var scope = app.Services.CreateAsyncScope();
    await CourseCatalogSeeder.SeedAsync(scope.ServiceProvider.GetRequiredService<AppDbContext>(),
        scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("CourseCatalogSeeder"));
    return;
}

app.UseMiddleware<RequestLoggingMiddleware>();
app.UseExceptionHandler(new ExceptionHandlerOptions { AllowStatusCode404Response = true });
app.UseStatusCodePages(async context =>
{
    var http = context.HttpContext;
    await Results.Problem(statusCode: http.Response.StatusCode, title: http.Response.StatusCode switch
    {
        401 => "Vui lòng đăng nhập hoặc đăng nhập lại khi phiên đã hết hiệu lực.",
        403 => "Bạn không có quyền thực hiện thao tác này.",
        404 => "Không tìm thấy dữ liệu được yêu cầu.",
        _ => "Không thể xử lý yêu cầu. Vui lòng thử lại."
    }, instance: http.Request.Path).ExecuteAsync(http);
});
if (app.Environment.IsDevelopment() || builder.Configuration.GetValue<bool>("Swagger:Enabled"))
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
if (!app.Environment.IsDevelopment()) app.UseHttpsRedirection();
app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/health", new HealthCheckOptions { Predicate = _ => false });
app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = check => check.Tags.Contains("ready") });
app.MapGet("/", () => Results.Ok(new
{
    name = "CourseFlow API", documentation = "/swagger", health = "/health", readiness = "/health/ready"
})).ExcludeFromDescription();
if (app.Environment.IsDevelopment()) await DevAdminSeeder.SeedAsync(app.Services, app.Configuration);
app.Run();
