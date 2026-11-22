# Chạy và báo cáo dự án OnlineCourseManagement

Backend là **C# / ASP.NET Core Web API trên .NET 10**, frontend JavaScript/Vite, database SQL Server. Tài liệu báo cáo/demo bốn vai trò: [docs/project-presentation.md](docs/project-presentation.md).

## 1. Yêu cầu và cài thư viện

- .NET SDK 10, Node.js từ 22.12 trở lên.
- SQL Server; cấu hình trên máy này dùng `.\SQLEXPRESS`, database `OnlineCourseDB`.
- SSMS để xem dữ liệu; `sqlcmd` nếu chạy kiểm thử SQL tích hợp.
- `dotnet-ef` 10.x khi áp dụng migration.

Từ thư mục gốc chứa solution và package.json:

```powershell
dotnet --version
node --version
npm.cmd ci
dotnet restore OnlineCourseManagement.sln
```

`npm ci` cài thư viện JavaScript; `dotnet restore` cài NuGet. Trên PowerShell dùng `npm.cmd` nếu `npm.ps1` bị chặn.

## 2. Cấu hình database và bí mật trên máy mới

Máy hiện tại đã có User Secrets và database thì dùng lại, không cần đặt lại. Khi chuyển sang máy mới, cấu hình bằng User Secrets từ thư mục gốc:

```powershell
dotnet user-secrets set 'ConnectionStrings:DefaultConnection' 'Server=.\SQLEXPRESS;Database=OnlineCourseDB;Trusted_Connection=True;TrustServerCertificate=True;' --project backend/OnlineCourseManagement.Api
dotnet user-secrets set 'Jwt:Key' '<KHOA_NGAU_NHIEN_IT_NHAT_32_BYTE>' --project backend/OnlineCourseManagement.Api
dotnet user-secrets set 'AdminSeed:Email' '<EMAIL_ADMIN_CUA_BAN>' --project backend/OnlineCourseManagement.Api
dotnet user-secrets set 'AdminSeed:Password' '<MAT_KHAU_ADMIN_CUA_BAN>' --project backend/OnlineCourseManagement.Api
```

Thay mọi placeholder bằng giá trị của bạn. `Jwt:Issuer` và `Jwt:Audience` phải khớp cấu hình đang dùng trong appsettings. Không đưa giá trị khóa/mật khẩu lên Git, slide hay ảnh chụp. User Secrets được lưu ngoài repository và không tự đi sang máy khác.

Trong SSMS kết nối `.\SQLEXPRESS` bằng Windows Authentication. Nếu dùng instance khác, cập nhật connection string tương ứng.

## 3. Áp dụng migration

```powershell
$env:ASPNETCORE_ENVIRONMENT = 'Development'
dotnet ef database update --project backend/OnlineCourseManagement.Api --startup-project backend/OnlineCourseManagement.Api
```

Lệnh áp dụng schema và có thể tạo database nếu tài khoản SQL có quyền. **Migration không tạo tài khoản Admin**. Admin đầu tiên được tạo khi ứng dụng khởi động trong Development, đã cấu hình AdminSeed và chưa có Admin trong database. Seeder không đổi mật khẩu hoặc quyền tài khoản hiện có.

Nếu chuyển máy và muốn giữ dữ liệu cũ, cần backup/restore SQL và sao chép file Uploads; migration không tự sao chép dữ liệu từ máy cũ.

## 4. Chạy frontend và backend

```powershell
npm.cmd run dev
```

- Giao diện: http://localhost:5173
- API: http://localhost:5106/api
- Swagger: http://localhost:5106/swagger
- Kiểm tra API và kết nối SQL: http://localhost:5106/health/ready

Ctrl+C dừng hai ứng dụng. Hoặc mở hai terminal tại thư mục gốc, chạy `npm.cmd run dev:backend` và `npm.cmd run dev:frontend`.

Nếu mở solution trong Visual Studio, đặt `OnlineCourseManagement.Api` làm Startup Project và dùng profile `http`. Frontend chạy riêng bằng `npm.cmd run dev:frontend`. Dừng backend từ lệnh chạy chung trước khi F5 để tránh trùng cổng.

## 5. Đăng nhập và kiểm tra bốn vai trò

Dùng tài khoản Admin thật đã cấu hình, không mặc định có sẵn một mật khẩu mẫu trong tài liệu.

| Mã lưu trong SQL/API | Tên giao diện | Phạm vi |
| --- | --- | --- |
| Admin | Admin | Tài khoản, quyền, phân công và toàn bộ catalog |
| Staff | Nhân viên | Toàn bộ catalog, báo cáo; xem/hỗ trợ tài khoản User |
| Instructor | Giảng viên | Tạo khóa của mình và quản lý khóa được giao |
| User | User (sinh viên) | Ghi danh, học, tài liệu và tiến độ của mình |

Đăng ký công khai chỉ tạo User. Admin tạo/cấp các quyền còn lại trong Tài khoản. Không gửi `Student` vì đây là mã cũ không còn được hỗ trợ.

Trong chi tiết khóa, Admin phân công Staff/Instructor hoặc chọn **Chưa phân công / Bỏ phân công**. Hai phân công độc lập. Phải giải phóng mọi khóa của Staff/Instructor trước khi đổi tài khoản sang vai trò khác.

### Dùng Swagger đúng cách

1. Mở `POST /api/auth/login` → Try it out, nhập email và mật khẩu của tài khoản thật → Execute.
2. Sao chép **giá trị `token`** từ response.
3. Nhấn Authorize, dán token vào ô Bearer và xác nhận. Swagger tự thêm `Authorization: Bearer ...`; không nhập email/mật khẩu tại đây.
4. Gọi GET /api/auth/me hoặc GET /api/users theo quyền. Không trình chiếu token thật trong tài liệu công khai.

Sau khi đổi role/reset password, token cũ nhận 401; đăng nhập lại để lấy token mới. 403 nghĩa là tài khoản đã xác thực nhưng thiếu quyền; 409 thường là dữ liệu còn quan hệ hoặc có xung đột cập nhật.

## 6. Dữ liệu mẫu và kiểm tra SQL

Nạp catalog khóa/bài khi cần:

```powershell
npm.cmd run seed:catalog
```

Lệnh thêm phần còn thiếu của 6 danh mục, 24 khóa và 192 bài; không tạo tài khoản hoặc ghi danh. Không dùng seed để kiểm tra xóa vì chạy lại có thể thêm lại mẫu vừa xóa.

Các script users cũ nằm trong `database/seeds/` dùng hash giả để thử danh sách/phân trang. Chúng không tạo tài khoản đăng nhập được và không nên dùng cho demo xác thực. Đăng ký mới hoặc dùng Admin tạo tài khoản qua FE; nếu cần dùng tài khoản seed cụ thể thì Admin đặt lại mật khẩu cho tài khoản đó.

Trong SSMS chạy các file chỉ đọc:

- `database/queries/InspectData.sql`: danh sách, số lượng, migration.
- `database/queries/AuditPermissions.sql`: kiểm tra người phụ trách đúng vai trò và quan hệ tiến độ/học liệu.

Chạy lại SELECT bằng F5 sau khi thao tác ở FE. Không SELECT * từ Users khi báo cáo vì có trường bí mật. API ghi dữ liệu vào SQL Server; SSMS không cần mở để API lưu được.

## 7. Build và kiểm thử

```powershell
npm.cmd run build
npm.cmd test
npm.cmd run test:backend
# Các lệnh sau cần API/SQL đang chạy, thực hiện lần lượt:
npm.cmd run test:authorization
npm.cmd run test:roles
npm.cmd run test:auth
npm.cmd run test:crud
npm.cmd run test:contracts
```

Các test HTTP/SQL tạo và dọn fixture QA. Không chạy đồng thời các suite có so checksum. Cần thông tin Admin qua User Secrets hiện tại hoặc `COURSEFLOW_TEST_ADMIN_EMAIL` / `COURSEFLOW_TEST_ADMIN_PASSWORD`. Không ghi thông tin đó vào Git. Xem hướng dẫn browser QA tại [docs/logic-audit.md](docs/logic-audit.md).

## 8. Xử lý lỗi thường gặp

- **Không mở được API/connection refused:** kiểm tra terminal backend, `/health/ready` và cổng 5106.
- **Trùng cổng:** dừng tiến trình dev cũ của dự án trước khi chạy npm dev hoặc F5; không chạy hai backend cùng cổng.
- **Lỗi SQL/migration:** kiểm tra instance, quyền Windows, connection string và trạng thái dịch vụ SQL Server.
- **Ứng dụng từ chối khởi động do JWT:** kiểm tra khóa ngẫu nhiên tối thiểu 32 byte và issuer/audience theo cấu hình.
- **Tài khoản seed không đăng nhập:** hash giả không phải mật khẩu thật; tạo tài khoản qua ứng dụng hoặc đặt lại mật khẩu bằng quyền Admin.
- **Đổi phân công ở phiên khác chưa thấy ngay:** chuyển trang, quay lại cửa sổ hoặc nhấn nút làm mới. Chưa có WebSocket đẩy dữ liệu liên tục.
- **Không đổi được quyền giảng viên/nhân viên:** bỏ hoặc chuyển hết các phân công của họ trước, rồi đổi vai trò.

## Tài liệu báo cáo

- [Kịch bản slide, demo bốn vai trò và câu hỏi bảo vệ](docs/project-presentation.md)
- [Báo cáo kỹ thuật và bằng chứng kiểm thử](docs/backend-report.md)
- [Ma trận quyền](docs/permissions.md)
- [Checklist Buổi 2–15](docs/backend-checklist.md)
- [Postman](docs/postman/README.md)
- [Triển khai](docs/backend-deployment.md)