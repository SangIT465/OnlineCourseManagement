# Backend — ASP.NET Core Web API

Thư mục `OnlineCourseManagement.Api/` là ứng dụng API độc lập. Backend không phục vụ HTML, CSS hoặc JavaScript của frontend.

## Chạy riêng

Từ thư mục gốc repository:

```powershell
dotnet run --project backend/OnlineCourseManagement.Api --launch-profile http
```

Hoặc từ `backend/OnlineCourseManagement.Api/`:

```powershell
dotnet run --launch-profile http
```

Swagger: http://localhost:5106/swagger. Endpoint `/` trả thông tin API, `/health` kiểm tra ứng dụng đang hoạt động.

## Phân chia trách nhiệm

- `Controllers/`: route, xác thực/phân quyền, HTTP request và response.
- `DTOs/`: định dạng và validation dữ liệu trao đổi.
- `Services/`: nghiệp vụ người dùng, JWT và xử lý mật khẩu.
- `Repositories/`: truy vấn người dùng, lọc, sắp xếp và phân trang.
- `Data/`: EF Core DbContext và tạo Admin ban đầu trong môi trường Development.
- `Models/`: các thực thể Course, Lesson, User, Enrollment, LessonProgress và UploadedFile.
- `Migrations/`: các migration hiện có; giữ nguyên namespace và lịch sử database.
- `Uploads/`: dữ liệu ảnh/PDF, tên file được giữ nguyên sau khi di chuyển.

Một số controller khóa học/bài học/ghi danh của mã nguồn hiện tại vẫn gọi DbContext trực tiếp. Lần sắp xếp này giữ nguyên nghiệp vụ đó; chưa tách thành nhiều assembly Domain/Application/Infrastructure.

## Cấu hình trên máy mới

Dùng file `appsettings.Development.json`, biến môi trường hoặc User Secrets. Ví dụ thiết lập từ thư mục gốc:

```powershell
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Server=.\SQLEXPRESS;Database=OnlineCourseDB;Trusted_Connection=True;TrustServerCertificate=True;" --project backend/OnlineCourseManagement.Api
dotnet user-secrets set "Jwt:Key" "<KHOA_NGAU_NHIEN_IT_NHAT_32_BYTE>" --project backend/OnlineCourseManagement.Api
dotnet user-secrets set "AdminSeed:Email" "<EMAIL_ADMIN>" --project backend/OnlineCourseManagement.Api
dotnet user-secrets set "AdminSeed:Password" "<MAT_KHAU_ADMIN>" --project backend/OnlineCourseManagement.Api
```

Thay các giá trị trong dấu `<...>`. `UserSecretsId` vẫn là ID cũ nên không cần nhập lại bí mật đã có trên máy này. Seeder chỉ tạo Admin đầu tiên trong Development khi đã cấu hình email/mật khẩu và chưa có Admin.

Nếu cần cập nhật database:

```powershell
$env:ASPNETCORE_ENVIRONMENT = "Development"
dotnet ef database update --project backend/OnlineCourseManagement.Api --startup-project backend/OnlineCourseManagement.Api
```

Không tạo migration mới chỉ vì di chuyển thư mục. Các script seed được chuyển sang `database/seeds/` tại gốc repository.

## CORS và triển khai

`Cors:AllowedOrigins` là danh sách nguồn frontend được phép gọi API trực tiếp. Development có localhost/127.0.0.1 tại cổng 5173 và 4173. Khi triển khai khác tên miền, thiết lập nguồn cụ thể, ví dụ biến môi trường `Cors__AllowedOrigins__0=https://courses.example.com`.

Frontend dùng JWT Bearer, không dùng cookie cross-site. Backend kiểm tra quyền cho từng endpoint, kể cả khi giao diện đã ẩn nút thao tác.

Publish độc lập:

```powershell
dotnet publish backend/OnlineCourseManagement.Api -c Release -o artifacts/backend
```

Trên máy chủ, cung cấp cấu hình database/JWT từ môi trường hoặc secret store; bố trí thư mục `Uploads/` bền vững dưới content root và chuyển file hiện có cùng với dữ liệu database. Không dùng User Secrets làm cơ chế cấu hình production.
