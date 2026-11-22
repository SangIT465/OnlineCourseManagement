# Publish và triển khai backend

## Kiểm tra và tạo bản phát hành

Từ thư mục gốc:

```powershell
dotnet restore OnlineCourseManagement.sln
npm.cmd ci
npm.cmd test
npm.cmd run test:backend
npm.cmd run build:frontend
npm.cmd run publish:backend
```

API được publish vào `artifacts/backend/`, frontend vào `frontend/dist/`. Có thể dùng profile cho Visual Studio hoặc CLI:

```powershell
dotnet publish backend/OnlineCourseManagement.Api --configuration Release -p:PublishProfile=FolderProfile
```

Profile không chứa mật khẩu hoặc thông tin đăng nhập máy chủ. `.github/workflows/ci.yml` thực hiện build/test/publish và lưu artifact; workflow không tự triển khai lên máy chủ và không chạy test ghi dữ liệu vào database production.

## Cấu hình khi triển khai

Máy chủ chạy .NET/ASP.NET Core Runtime 10. Với IIS, cài Hosting Bundle phù hợp. Dùng biến môi trường hoặc secret store; User Secrets chỉ dùng trên máy development.

| Biến môi trường | Nội dung |
| --- | --- |
| `ASPNETCORE_ENVIRONMENT` | `Production` |
| `ConnectionStrings__DefaultConnection` | SQL Server/database của môi trường triển khai |
| `Jwt__Key` | Khóa ngẫu nhiên ít nhất 32 byte UTF-8, giữ bí mật |
| `Jwt__Issuer`, `Jwt__Audience` | Giá trị nhất quán giữa phát hành và kiểm tra JWT |
| `Jwt__ExpirationMinutes` | Thời hạn token, 1–1440 phút; mặc định 120 |
| `Cors__AllowedOrigins__0` | Nguồn frontend chính xác, ví dụ `https://courses.example.com` |
| `FileStorage__RootPath` | Thư mục lưu bền vững; có thể dùng đường dẫn tuyệt đối |
| `FileStorage__MaxImageBytes` | Mặc định 5.000.000 |
| `FileStorage__MaxDocumentBytes` | Mặc định 10.000.000 |
| `Swagger__Enabled` | Mặc định false ngoài Development; chỉ bật khi cần và kiểm soát nguồn truy cập |

Ví dụ domain chỉ là giá trị minh họa. CORS không dùng ký tự `*`, không thêm đường dẫn sau domain. Lỗi cấu hình JWT/CORS/upload làm ứng dụng từ chối khởi động thay vì chạy với cấu hình không hợp lệ.

Kết nối Windows Authentication trên máy development dùng danh tính Windows hiện tại. Khi chạy dưới IIS/service, cần cấp quyền database cho danh tính chạy ứng dụng hoặc cấu hình tài khoản SQL riêng; không mặc định dùng được quyền của tài khoản đang mở SSMS.

## Database và dữ liệu

Sao lưu database trước khi triển khai migration. Từ checkout đã cấu hình đúng connection string:

```powershell
dotnet ef database update --project backend/OnlineCourseManagement.Api --startup-project backend/OnlineCourseManagement.Api
```

Ứng dụng không tự chạy migration hoặc nạp catalog khi khởi động production. Không chạy các script seed người dùng có hash giả vào production. Catalog Development được nạp chủ động bằng `npm.cmd run seed:catalog`.

Các file đã upload phải được chuyển cùng metadata trong SQL Server. Nếu giữ `RootPath=Uploads`, thư mục này phải nằm dưới content root của bản publish; nếu dùng đường dẫn tuyệt đối thì cấp quyền đọc/ghi cho danh tính chạy API. Không ghi đè thư mục dữ liệu khi cập nhật binary. File phát sinh trong Uploads được Git bỏ qua; các file mẫu đã được track trước đó vẫn giữ nguyên.

## FE/BE và HTTPS

- Cùng domain: web server/reverse proxy phục vụ `frontend/dist` và chuyển `/api` sang API.
- Khác domain: build frontend với `VITE_API_BASE_URL=https://api.example.com/api`, khai báo đúng domain frontend trong CORS backend.
- Không đưa connection string, mật khẩu hoặc JWT signing key vào `VITE_*`.
- Cấu hình chứng chỉ HTTPS ở IIS/Kestrel hoặc reverse proxy. Nếu dùng proxy ngoài IIS, cấu hình forwarded headers và danh sách proxy tin cậy theo môi trường; không bật tin cậy mọi proxy.

## Kiểm tra sau triển khai

1. `/health` trả 200 khi tiến trình chạy. `/health/ready` trả 200 khi kết nối được database; endpoint này không kiểm tra đủ lịch sử migration.
2. Dùng tài khoản thử riêng để kiểm tra đăng nhập và quyền. Trong production, chuẩn bị Admin qua quy trình quản trị; DevAdminSeeder không tạo Admin ở môi trường này.
3. Kiểm tra một thao tác đọc, một thao tác ghi với bản ghi thử có kiểm soát, và upload/download học liệu.
4. Xem JSON log: method, path, status, thời gian, TraceId. Client có thể cung cấp `X-Request-ID` khi báo lỗi. Không bật logging nội dung password hoặc Authorization header.
