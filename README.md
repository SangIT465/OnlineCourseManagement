# CourseFlow — Online Course Management

Hệ thống quản lý khóa học trực tuyến được tổ chức thành hai ứng dụng độc lập: frontend JavaScript/Vite và backend ASP.NET Core Web API (.NET 10), sử dụng SQL Server, Entity Framework Core và JWT.

## Cấu trúc

```text
OnlineCourseManagement/
├── frontend/                      # Giao diện và cấu hình Vite
│   ├── public/                    # Tài nguyên tĩnh
│   ├── src/
│   │   ├── api/client.js          # HTTP client, JWT, lỗi API
│   │   ├── components/icons.js    # Thành phần SVG dùng chung
│   │   ├── styles/main.css        # Giao diện responsive
│   │   ├── app.js                 # Màn hình, biểu mẫu, định tuyến
│   │   ├── config.js              # Địa chỉ API theo môi trường
│   │   └── main.js                # Điểm khởi tạo frontend
│   ├── tests/                     # Kiểm thử frontend
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── backend/
│   └── OnlineCourseManagement.Api/
│       ├── Controllers/           # API endpoints và phân quyền
│       ├── DTOs/                  # Hợp đồng request/response
│       ├── Services/              # Nghiệp vụ, JWT, mật khẩu
│       ├── Repositories/          # Truy cập dữ liệu người dùng
│       ├── Models/                # Thực thể dữ liệu
│       ├── Data/                  # DbContext và tạo Admin ban đầu
│       ├── Migrations/            # Lịch sử schema EF Core
│       ├── Properties/            # Hồ sơ khởi chạy
│       ├── Uploads/               # File ảnh/PDF hiện có
│       ├── Program.cs
│       └── OnlineCourseManagement.Api.csproj
├── database/seeds/                # Script SQL chạy thủ công
├── docs/architecture.md           # Kiến trúc và luồng xử lý
├── scripts/                      # Chạy/build cả hai ứng dụng
├── archive/legacy-razor/           # Giao diện Razor cũ để đối chiếu
├── OnlineCourseManagement.sln     # Solution backend
├── package.json                  # Lệnh điều phối, npm workspaces
└── package-lock.json             # Phiên bản thư viện được khóa
```

## Yêu cầu

- .NET SDK 10.
- Node.js 22.12 trở lên (máy hiện tại dùng Node.js 24).
- SQL Server và database `OnlineCourseDB` đã cấu hình.
- `dotnet-ef` 10.x khi cần cập nhật database.

## Chạy cả frontend và backend

Mở Terminal tại thư mục gốc:

```powershell
npm.cmd install
npm.cmd run dev
```

Trên Windows PowerShell, dùng `npm.cmd` nếu chính sách máy chặn `npm.ps1`. Trên macOS/Linux có thể dùng `npm`.

- Frontend: **http://localhost:5173/**
- Backend API: **http://localhost:5106/api**
- Swagger: **http://localhost:5106/swagger**
- Health endpoint: **http://localhost:5106/health** (kiểm tra ứng dụng đang chạy, không kiểm tra SQL Server).

Nhấn `Ctrl+C` để dừng cả hai ứng dụng. Lệnh chạy chung tự dừng ứng dụng còn lại nếu một ứng dụng khởi chạy thất bại hoặc kết thúc.

Hoặc chạy riêng ở hai Terminal:

```powershell
# Terminal 1, từ thư mục gốc
npm.cmd run dev:backend

# Terminal 2, từ thư mục gốc
npm.cmd run dev:frontend
```

## Database và cấu hình backend

Các file cấu hình nằm tại `backend/OnlineCourseManagement.Api/appsettings*.json`. User Secrets ID được giữ nguyên nên cấu hình bí mật trên máy hiện tại tiếp tục được sử dụng. Database và lịch sử migration không bị tạo lại khi thay đổi bố cục thư mục.

Khi cài trên máy mới, cấu hình `ConnectionStrings:DefaultConnection`, `Jwt:Key` (ít nhất 32 byte), `Jwt:Issuer`, `Jwt:Audience`. Nếu cần Admin đầu tiên, cấu hình thêm `AdminSeed:Email` và `AdminSeed:Password` bằng User Secrets. Xem [hướng dẫn backend](backend/README.md).

Áp dụng các migration đã có khi cần:

```powershell
$env:ASPNETCORE_ENVIRONMENT = "Development"
dotnet ef database update --project backend/OnlineCourseManagement.Api --startup-project backend/OnlineCourseManagement.Api
```

Script trong `database/seeds/` là dữ liệu thử nghiệm chạy thủ công; kiểm tra nội dung trước khi chạy vào database đang sử dụng.

## Kết nối frontend với API

Mặc định frontend gọi `/api`, Vite chuyển tiếp request đến `http://localhost:5106`. Khi thay đổi môi trường, sao chép `frontend/.env.example` thành `frontend/.env.local` rồi cập nhật cấu hình. Xem [hướng dẫn frontend](frontend/README.md).

Khi triển khai hai ứng dụng khác tên miền, đặt `VITE_API_BASE_URL=https://api.example.com/api` lúc build frontend và khai báo đúng nguồn frontend trong `Cors:AllowedOrigins` của backend. Khi triển khai cùng tên miền, reverse proxy `/api` đến backend. Không cần đưa frontend vào backend để chạy production.

## Build và kiểm thử

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd test
```

- Frontend production: `frontend/dist/`.
- Backend Release: `backend/OnlineCourseManagement.Api/bin/Release/net10.0/`.
- Build riêng: `npm.cmd run build:frontend` hoặc `npm.cmd run build:backend`.
- Publish API: `dotnet publish backend/OnlineCourseManagement.Api -c Release -o artifacts/backend`.

Khi triển khai API, bố trí `Uploads/` dưới content root của ứng dụng trên ổ lưu trữ bền vững và chuyển các file hiện có sang đó. Không đặt JWT key hay mật khẩu database trong biến `VITE_*`.

## Chức năng theo vai trò

| Vai trò | Chức năng |
| --- | --- |
| Khách | Khám phá/tìm/lọc khóa học, xem chương trình và danh mục, đăng nhập/đăng ký. |
| Student | Ghi danh, học bài, tải tài liệu, cập nhật tiến độ học tập. |
| Instructor | Tạo và quản lý khóa học phụ trách, bài học, học liệu, theo dõi học viên. |
| Admin | Quản lý danh mục/khóa học/người dùng, phân quyền, phân công giảng viên và theo dõi ghi danh. |

Hệ thống hiện hỗ trợ ghi danh, chưa tích hợp thanh toán. Phân quyền cuối cùng luôn do backend kiểm tra.
