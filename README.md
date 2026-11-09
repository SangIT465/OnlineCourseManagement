OnlineCourseManagement
Backend quản lý khóa học trực tuyến xây dựng bằng ASP.NET Core Web API (.NET 10), Entity Framework Core, SQL Server và JWT Authentication.
1. Chức năng
- Đăng nhập bằng JWT; phân quyền Admin, Instructor, Student.
- Quản lý người dùng, vai trò, đặt lại mật khẩu Student (Admin).
- Quản lý danh mục, khóa học, bài học; phân công giảng viên.
- API ghi danh khóa học, theo dõi tiến độ bài học và quản lý file học liệu (tùy phiên bản code hiện tại).
- Kiểm thử API qua Swagger UI.
2. Yêu cầu
- .NET SDK 10
- SQL Server và SQL Server Management Studio (SSMS)
- Visual Studio có hỗ trợ ASP.NET hoặc Visual Studio Code
- Công cụ Entity Framework Core (dotnet-ef)
Kiểm tra:
dotnet --version
dotnet ef --version
Nếu chưa có dotnet ef:
dotnet tool install --global dotnet-ef --version 10.*
Nếu đã cài, bảo đảm phiên bản công cụ tương thích với EF Core của dự án.
3. Tải mã nguồn
git clone <URL_REPOSITORY_GITHUB>
cd <THU_MUC_CHUA_FILE_OnlineCourseManagement.csproj>
Nếu đã tải dự án, chỉ cần mở Terminal tại thư mục chứa OnlineCourseManagement.csproj.

4. Cấu hình SQL Server
Mở file appsettings.json và thiết lập chuỗi kết nối cho SQL Server trên máy:
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=.\\SQLEXPRESS;Database=OnlineCourseDB;Trusted_Connection=True;TrustServerCertificate=True;"
  },
  "Jwt": {
    "Issuer": "OnlineCourseManagement",
    "Audience": "OnlineCourseManagementUsers"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*"
}
- Thay .\\SQLEXPRESS bằng tên SQL Server instance thực tế nếu khác.
- Nếu sử dụng SQL Server Authentication, cung cấp thông tin kết nối theo cách bảo mật (chẳng hạn User Secrets), không commit mật khẩu vào Git.
- DefaultConnection phải trùng tên được đọc trong Program.cs.
5. Cấu hình User Secrets
Ứng dụng cần JWT Key; cấu hình mẫu trong hướng dẫn này sử dụng Jwt:Key từ User Secrets khi chạy môi trường Development.
dotnet user-secrets init

# Sinh khóa ngẫu nhiên, tương thích Windows PowerShell
$bytes = New-Object byte[] 48
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
$key = [Convert]::ToBase64String($bytes)

dotnet user-secrets set "Jwt:Key" $key
Nếu ứng dụng có chức năng tự tạo Admin ban đầu từ cấu hình AdminSeed, thiết lập thêm:
dotnet user-secrets set "AdminSeed:Email" "admin@onlinecourse.local"
$adminPassword = Read-Host "Nhap mat khau Admin ban dau" -AsSecureString
$credential = [PSCredential]::new("admin", $adminPassword)
dotnet user-secrets set "AdminSeed:Password" $credential.GetNetworkCredential().Password
User Secrets chỉ lưu cấu hình. Tài khoản Admin chỉ được tạo tự động nếu code đã triển khai và gọi Seeder. Không đăng mật khẩu hoặc JWT Key lên GitHub.

6. Cài thư viện và cập nhật cơ sở dữ liệu
dotnet restore
dotnet build
dotnet ef migrations list
dotnet ef database update
database update áp dụng các Migration có sẵn (ví dụ: AddCourseInstructor, AddEnrollments, AddLessonProgress, AddUploadedFiles) vào database đã cấu hình. Không chạy dotnet ef migrations add chỉ để khởi động dự án đã có Migration.

Nếu cập nhật thất bại, kiểm tra SQL Server đã chạy, database/instance đúng và appsettings.json là JSON hợp lệ.
7. Chạy Backend
dotnet run --environment Development
Quan sát Now listening on: ... trong Terminal. Ví dụ nếu cổng là 5106:
- Swagger: http://localhost:5106/swagger
- API đăng nhập: POST http://localhost:5106/api/auth/login
Cổng thực tế có thể khác. Để chạy thử cố định ở cổng 5106:
dotnet run --no-launch-profile --environment Development --urls "http://localhost:5106"
Giữ Terminal chạy Backend khi sử dụng Swagger. Nhấn Ctrl+C để dừng trước khi build lại.
8. Kiểm thử trên Swagger
1. Mở /swagger theo đúng cổng ứng dụng.
2. Chọn POST /api/auth/login → Try it out; nhập email và mật khẩu của tài khoản đã tồn tại.
3. Sao chép token được trả về.
4. Nhấn Authorize và dán JWT (với HTTP Bearer scheme, không thêm tiền tố Bearer ).
5. Thử các endpoint phù hợp với vai trò đăng nhập.
Một số endpoint của dự án:
Phương thức	Endpoint	Mục đích
POST	/api/auth/login	Đăng nhập
GET	/api/users	Admin xem người dùng
POST	/api/users	Admin tạo người dùng
DELETE	/api/users/{id}	Admin xóa người dùng
PUT	/api/users/{id}/reset-password	Admin đặt lại mật khẩu Student
GET	/api/courses	Danh sách khóa học
GET	/api/courses/my	Khóa học giảng viên phụ trách
PUT	/api/courses/{id}/instructor	Admin phân công giảng viên
POST	/api/lessons	Tạo bài học (theo phân quyền)


Các endpoint phụ thuộc vào phiên bản controller đang được chạy. Trên Swagger, kiểm tra schema request trước khi gọi.
9. Xử lý lỗi thường gặp
Lỗi	Hướng xử lý
Unable to connect to the remote server	Khởi động Backend; kiểm tra port trong Now listening on
401 Unauthorized	Đăng nhập lại, kiểm tra JWT, username/password
403 Forbidden	Vai trò không đủ quyền gọi API
400 Bad Request	Xem Response body để sửa JSON/validation hoặc dữ liệu liên quan
MSB3021 / MSB3027	Dừng ứng dụng/Debug đang khóa .exe, rồi build lại
Không tạo được AppDbContext	Kiểm tra appsettings.json, chuỗi kết nối và đăng ký DbContext trong Program.cs
NU1902 / NU1903	Kiểm tra và nâng cấp gói NuGet có lỗ hổng lên phiên bản đã vá tương thích


10. Bảo mật
- Không commit JWT Key, mật khẩu Admin, thông tin đăng nhập SQL Server hoặc tệp .env chứa bí mật.
- Mật khẩu người dùng phải được hash; không lưu mật khẩu thô vào database.
- Dùng tài khoản và dữ liệu thử nghiệm khi test API xóa/sửa.
- Các API quản trị yêu cầu JWT có vai trò Admin.


account admin: {
     "email": "admin@onlinecourse.local",
     "password": "Admin@123"
   }