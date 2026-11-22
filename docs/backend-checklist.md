# Đối chiếu nội dung backend với các buổi học

Phạm vi đối chiếu là tên các chuyên đề nhìn thấy trong ảnh Buổi 2–15. Chưa có nội dung các PDF nên bảng này không thay cho việc đối chiếu từng yêu cầu trong slide.

| Buổi | Nội dung | Hiện thực và vị trí kiểm tra |
| --- | --- | --- |
| 2 | Web API, middleware, DI | `Program.cs`: đăng ký controller, DbContext, service, middleware theo vòng đời; `Middleware/RequestLoggingMiddleware.cs`. |
| 3 | Controller, routing, model binding, HTTP, REST, ActionResult | `Controllers/`: GET/POST/PUT/DELETE, route ID, `[FromQuery]`, `[FromBody]`, `ActionResult<T>`, 200/201/204/400/401/403/404/409. |
| 4 | DTO, validation, Swagger, Postman | `DTOs/`, `Validation/HttpUrlAttribute.cs`, validation response có `errors` và `traceId`; Swagger và [Postman](postman/README.md). |
| 5 | EF Core, Code First, migration | `Data/AppDbContext.cs`, `Models/`, `Migrations/`; migration mới bảo vệ tên danh mục và cặp CourseId/OrderIndex. |
| 6 | CRUD, LINQ, quan hệ dữ liệu | Service danh mục/khóa/bài học; các quan hệ User–Course, Course–Lesson, User–Enrollment, Enrollment–Progress; kiểm thử CRUD đối chiếu SQL. |
| 7 | Phân tầng, DI | Controller gọi `IAuthService`, `ICourseService`, `ILessonService`, `ICategoryService`; EF Core truy cập database; `IFileStorage` tách lưu file. User có repository riêng. |
| 8 | JWT | `Services/JwtService.cs`, `Options/JwtOptions.cs`, `Security/CurrentSessionJwtEvents.cs`: issuer, audience, chữ ký, thời hạn và thu hồi phiên. |
| 9 | Authorization, role, claims, policies | `AppRoles`, `AppPermissions`, `AppPolicies`; `ManageCourseHandler` kiểm tra khóa được giao; `CourseAccessService` dùng `IAuthorizationService`. |
| 10 | Upload, cấu hình, Options Pattern | `IFileStorage/LocalFileStorage`, `FileStorageOptions`, `JwtOptions`, `FrontendCorsOptions`; bind + validate khi khởi động; giới hạn và chữ ký ảnh/PDF. |
| 11 | Pagination, filtering, searching, sorting | `/api/users`, `/api/courses/paged`, `/api/lessons/paged`; giới hạn trang, sort whitelist, thứ tự ổn định theo ID. |
| 12 | Global exception, logging, custom middleware | `GlobalExceptionHandler` trả ProblemDetails; request middleware ghi JSON log có thời lượng, status, TraceId; không ghi password/token/body/query. |
| 13 | Swagger nâng cao, CORS, publish | `ApiDocumentationFilter`, XML comments, JWT Authorize; request công khai không bị ghi là cần JWT; CORS exact origins; FolderProfile và [triển khai](backend-deployment.md). |
| 14 | Tích hợp, quy trình phát triển | FE/BE độc lập, root scripts chạy/build/test, `.github/workflows/ci.yml` kiểm thử và tạo artifact. |
| 15 | Kiểm thử, báo cáo, bảo vệ | Project xUnit, các suite HTTP/SQL, [báo cáo và kịch bản demo](backend-report.md). |

## Kiến trúc và phạm vi

Đây là một ứng dụng ASP.NET có các tầng theo thư mục, không phải kiến trúc nhiều assembly Domain/Application/Infrastructure. Luồng danh mục/khóa/bài học/đăng nhập đã chuyển qua service. Các controller hỗ trợ người dùng, ghi danh và tiến độ còn sử dụng DbContext trực tiếp trong một số thao tác; không trình bày chúng như đã tách hoàn toàn sang service.

EF Core DbContext thực hiện truy cập dữ liệu và giao dịch. Không thêm generic repository cho mọi thực thể chỉ để tăng số lượng lớp. Quyền theo khóa được dùng chung ở catalog, file và báo cáo học viên.

## Chạy kiểm thử

```powershell
# Không cần database hoặc API đang chạy
npm.cmd test
npm.cmd run test:backend

# Cần SQL Server, migration, API và Admin test đã cấu hình
npm.cmd run test:authorization
npm.cmd run test:crud
npm.cmd run test:contracts
```

Chạy các suite tích hợp tuần tự vì chúng thêm/xóa bản ghi QA và kiểm tra dữ liệu trước/sau. Các suite dùng Admin trong User Secrets hoặc `COURSEFLOW_TEST_ADMIN_EMAIL/PASSWORD`; không chứa mật khẩu thật trong source. SQL test mặc định kết nối `.\SQLEXPRESS` bằng Windows Authentication. `COURSEFLOW_API_URL` đổi địa chỉ API; CRUD có thêm `COURSEFLOW_TEST_SQL_SERVER`, `COURSEFLOW_TEST_SQL_DATABASE`.

Test .NET kiểm tra policy, quyền theo khóa, token, options, validation, xử lý lỗi, logging và lưu file. Suite contracts kiểm tra HTTP thật, metadata công khai, paging, CORS, Swagger, DTO và ràng buộc xóa/chuyển bài học. CI chạy các test không cần SQL; các suite SQL được chạy riêng trên môi trường đã chuẩn bị.

## API và hợp đồng tương thích

- `GET /api/courses`, `GET /api/lessons` vẫn trả mảng như frontend đang dùng.
- `GET /api/courses/paged?Search=web&CategoryId=2&MinPrice=0&MaxPrice=500000&SortBy=price&IsDescending=false&PageNumber=1&PageSize=10` trả `{ items, totalCount, pageNumber, pageSize, totalPages, ... }`.
- Course sort: `createdat`, `title`, `price`. Lesson sort: `order`, `title`, `duration`. PageSize tối đa 100; truy vấn sai sort hoặc khoảng giá trả 400.
- Metadata bài học công khai không chứa nội dung/video. Nội dung, tải tài liệu và báo cáo tiếp tục kiểm tra ghi danh/quyền quản lý.
- Lỗi nghiệp vụ mới và lỗi không xử lý được trả `application/problem+json`, gồm `status`, `title`, `message`, `traceId`; validation có `errors`. Các response message cũ vẫn được frontend hỗ trợ.
- Header `X-Request-ID` được trả về và đưa vào log. ID phía client chỉ được nhận nếu dài tối đa 64 ký tự và thuộc nhóm chữ/số/dấu chấm/gạch ngang/gạch dưới.

## Lưu ý nghiệp vụ

- Xóa danh mục còn khóa hoặc khóa còn bài học/ghi danh/học liệu trả 409.
- Xóa bài học yêu cầu xử lý tài liệu trước; tiến độ của bài bị xóa trong cùng giao dịch với bài học. Ghi danh của sinh viên được giữ lại và tỷ lệ được tính theo số bài còn tồn tại.
- Không chuyển bài đã có tiến độ hoặc tài liệu sang khóa khác. Kiểm tra quyền trên cả khóa nguồn và đích luôn áp dụng.
- Vai trò vẫn là Admin, Staff, Instructor, User. JWT có permission claims do server sinh từ vai trò; đổi quyền/password vẫn thu hồi token bằng SecurityStamp. Token trước khi bổ sung permission claims cần đăng nhập lại.
- Migration thêm unique index, không xóa hoặc đổi dữ liệu có sẵn. Có thể cần dọn dữ liệu trùng bằng quy trình riêng trước khi áp dụng trên database khác; không tự xóa bản trùng.

## Tài liệu kỹ thuật tham chiếu

- [ASP.NET Core error handling (.NET 10)](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/error-handling?view=aspnetcore-10.0).
- [Options Pattern](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/configuration/options?view=aspnetcore-10.0).
- [Resource-based authorization](https://learn.microsoft.com/en-us/aspnet/core/security/authorization/resource-based?view=aspnetcore-10.0).
- Dependency `System.Security.Cryptography.Pkcs` được pin ở 10.0.15 để vượt các phiên bản có cảnh báo trước đó; xem [thông báo bảo mật của .NET](https://github.com/dotnet/runtime/security/advisories/GHSA-846f-f764-76mx).
