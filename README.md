# CourseFlow — Online Course Management

Hệ thống quản lý khóa học trực tuyến được tổ chức thành hai ứng dụng độc lập: frontend JavaScript/Vite và backend ASP.NET Core Web API (.NET 10), sử dụng SQL Server, Entity Framework Core và JWT.

Xem [checklist backend theo Buổi 2–15](docs/backend-checklist.md), [Postman](docs/postman/README.md), [publish/triển khai](docs/backend-deployment.md) và [báo cáo/demo bảo vệ](docs/backend-report.md).

Chuẩn bị báo cáo: [kịch bản slide, demo đủ bốn vai trò và câu hỏi bảo vệ](docs/project-presentation.md). Cài đặt/chuyển máy: [SETUP_GUIDE.md](SETUP_GUIDE.md).

## Cấu trúc

```text
OnlineCourseManagement/
├── frontend/                      # Giao diện và cấu hình Vite
│   ├── public/                    # Tài nguyên tĩnh
│   ├── src/
│   │   ├── api/client.js          # HTTP client, JWT, lỗi API
│   │   ├── auth/                  # Quyền và vòng đời phiên đăng nhập
│   │   ├── components/            # UI dùng chung, shell, dialog và icons
│   │   ├── pages/                 # Màn hình theo chức năng
│   │   ├── forms/                 # Biểu mẫu catalog, tài khoản và upload
│   │   ├── state/store.js         # Dữ liệu dùng chung và tải API
│   │   ├── features/              # Workspace, hóa đơn, xem học liệu
│   │   ├── styles/                # CSS chia nhóm, main.css là điểm import
│   │   ├── utils/format.js        # Định dạng số, tiền và ngày
│   │   ├── actions.js             # Xử lý thao tác giao diện
│   │   ├── router.js              # Điều hướng hash và bộ lọc
│   │   ├── app.js                 # Khởi tạo, render và sự kiện
│   │   ├── config.js              # Địa chỉ API theo môi trường
│   │   └── main.js                # Điểm khởi tạo frontend
│   ├── tests/                     # Kiểm thử frontend
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── OnlineCourseManagement.Api/
│   │   ├── Controllers/           # API endpoints và phân quyền
│   │   ├── DTOs/                  # Hợp đồng request/response
│   │   ├── Services/              # Nghiệp vụ, ghi danh, tiến độ, JWT
│   │   ├── Security/              # Bốn vai trò và kiểm tra quyền theo khóa
│   │   ├── Repositories/          # Truy cập dữ liệu người dùng
│   │   ├── Models/                # Thực thể dữ liệu
│   │   ├── Data/                  # DbContext và tạo Admin ban đầu
│   │   ├── Migrations/            # Lịch sử schema EF Core
│   │   ├── Properties/            # Hồ sơ khởi chạy
│   │   ├── Uploads/               # File ảnh/PDF hiện có
│   │   ├── Program.cs
│   │   └── OnlineCourseManagement.Api.csproj
│   ├── OnlineCourseManagement.Api.Tests/ # Kiểm thử xUnit backend
│   └── tests/                     # Kiểm thử HTTP/SQL tích hợp
├── database/seeds/                # Script SQL và catalog khóa học mẫu
├── docs/architecture.md           # Kiến trúc và luồng xử lý
├── scripts/                      # Chạy/build cả hai ứng dụng
├── archive/legacy-razor/           # Giao diện Razor cũ để đối chiếu
├── OnlineCourseManagement.sln     # Solution backend
├── package.json                  # Lệnh điều phối, npm workspaces
└── package-lock.json             # Phiên bản thư viện được khóa
```

## Yêu cầu

- .NET SDK 10.
- Node.js 22.13 trở lên (máy hiện tại dùng Node.js 24).
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

## Nạp nhiều khóa học và bài học mẫu

Sau khi database đã áp dụng các migration, chạy từ thư mục gốc:

```powershell
npm.cmd run seed:catalog
```

Lệnh bổ sung **6 danh mục, 24 khóa học và 192 bài học** (8 bài/khóa), gồm 6 khóa miễn phí và 18 khóa có học phí. Các lĩnh vực: Lập trình Web, Backend & Cơ sở dữ liệu, Dữ liệu & AI, Thiết kế & Sáng tạo, Kinh doanh & Marketing, Ngoại ngữ & Kỹ năng. Bài học có tiêu đề, thời lượng, bài tập và nội dung tự kiểm tra để thử luồng học tập.

Chỉ lệnh chủ động này mới nạp catalog; khởi động ứng dụng bình thường không tự nạp lại. Lệnh chạy bằng cấu hình Release trong môi trường Development, không mở cổng HTTP, nên có thể dùng trong lúc ứng dụng development đang chạy.

Nạp lại không tạo trùng với danh mục/khóa học còn giữ tên và bài học còn giữ thứ tự. Các bản ghi có sẵn được giữ nguyên, gồm học phí, nhân viên và nội dung đã sửa. Danh mục được nhận diện bằng tên, khóa học bằng danh mục + tên, bài học bằng khóa học + thứ tự. Nếu đổi tên danh mục/khóa học hoặc xóa bài học rồi chạy lại, phần mẫu tương ứng có thể được thêm lại. Toàn bộ lần nạp nằm trong một giao dịch.

Dữ liệu được lưu ở `database/seeds/course-catalog.json`. Lệnh không tạo tài khoản, ghi danh hoặc tiến độ. Khóa mới chưa phân công nhân viên để Admin có thể thử thao tác phân công. Video và PDF có thể được thêm từ màn hình quản lý bài học.

Sau khi nạp, làm mới giao diện để thử tìm kiếm, lọc miễn phí/có học phí, phân trang, chỉnh sửa và ghi danh. Xem [hướng dẫn dữ liệu mẫu](database/README.md).

## Kết nối frontend với API

Mặc định frontend gọi `/api`, Vite chuyển tiếp request đến `http://localhost:5106`. Khi thay đổi môi trường, sao chép `frontend/.env.example` thành `frontend/.env.local` rồi cập nhật cấu hình. Xem [hướng dẫn frontend](frontend/README.md).

Khi triển khai hai ứng dụng khác tên miền, đặt `VITE_API_BASE_URL=https://api.example.com/api` lúc build frontend và khai báo đúng nguồn frontend trong `Cors:AllowedOrigins` của backend. Khi triển khai cùng tên miền, reverse proxy `/api` đến backend. Không cần đưa frontend vào backend để chạy production.

## Build và kiểm thử

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd test
npm.cmd run test:backend
```

- Frontend production: `frontend/dist/`.
- Backend Release: `backend/OnlineCourseManagement.Api/bin/Release/net10.0/`.
- Build riêng: `npm.cmd run build:frontend` hoặc `npm.cmd run build:backend`.
- Publish API: `dotnet publish backend/OnlineCourseManagement.Api -c Release -o artifacts/backend`.

Khi triển khai API, bố trí `Uploads/` dưới content root của ứng dụng trên ổ lưu trữ bền vững và chuyển các file hiện có sang đó. Không đặt JWT key hay mật khẩu database trong biến `VITE_*`.

## Chức năng theo vai trò

Giao diện tự chuyển theo tài khoản đăng nhập: **Admin** dùng thanh bên xanh đen, bảng quản lý khóa học, năm thẻ thống kê (có giảng viên), biểu đồ ghi danh và phân bố tài khoản; **User** dùng không gian học tập sáng, thanh menu ngang trên máy tính, tiếp tục học và tiến độ cá nhân; **Staff** dùng bàn vận hành xanh ngọc; **Instructor** dùng phòng giảng dạy tím với khóa được phân công. Điện thoại có menu nhanh ở dưới và menu đầy đủ dạng ngăn kéo. Các khối sách nổi dùng CSS phối cảnh, bóng đổ và chuyển động nhẹ; tự giảm hiệu ứng khi hệ điều hành bật giảm chuyển động. Số liệu lấy từ API hiện có và quyền thao tác vẫn do backend kiểm tra.

Hệ thống có bốn vai trò: **Admin**, **Staff (nhân viên)**, **Instructor (giảng viên)** và **User (sinh viên)**. Xem [ma trận quyền và cách cấp quyền](docs/permissions.md). Migration mới tách `StaffId` và `InstructorId`, giữ nguyên các phân công nhân viên cũ. Admin chủ động cấp quyền giảng viên và phân công giảng dạy.

| Vai trò | Chức năng |
| --- | --- |
| Khách | Khám phá/tìm/lọc khóa học, xem chương trình và danh mục, đăng nhập/đăng ký. |
| User (sinh viên) | Ghi danh, học bài, tải tài liệu, cập nhật tiến độ học tập. |
| Staff (nhân viên) | Quản lý danh mục, khóa học, bài học, học liệu, ghi danh và hỗ trợ tài khoản User. |
| Instructor (giảng viên) | Tạo khóa học, quản lý bài học/học liệu và xem tiến độ học viên chỉ trong khóa mình phụ trách. |
| Admin | Quản lý danh mục/khóa học/người dùng, phân quyền, phân công giảng viên/nhân viên và theo dõi ghi danh. |

User có thể mua khóa học qua payOS, quét QR, xem lịch sử đơn và in bill/lưu PDF. Backend xác minh thanh toán trước khi cấp quyền học cho khóa có phí. Khóa miễn phí được mở ngay và có bill 0 đồng. Xem [cấu hình payOS, migration và kiểm thử](docs/PAYOS-PURCHASES.md). Phân quyền cuối cùng luôn do backend kiểm tra.

Học liệu bài học hỗ trợ **ảnh JPG/JPEG/PNG/WebP/GIF/BMP**, **Word DOC/DOCX**, **PowerPoint PPT/PPTX**, **Excel XLS/XLSX**, **PDF**, **TXT và CSV UTF-8**. Tài liệu Office/PDF tối đa 25 MB, ảnh 5 MB, TXT/CSV 1 MB. Ảnh bìa khóa học tiếp tục nhận JPG/PNG/WebP tối đa 5 MB. Giao diện có nút **Tải tài liệu lên** và mở bản xem ngay sau khi upload; tệp đã có dùng nút **Xem**.

PDF hỗ trợ chuyển trang, phóng to/thu nhỏ và co giãn trên mobile. Word/PowerPoint/Excel được LibreOffice chuyển thành PDF riêng để xem; **Tải bản gốc** luôn trả đúng tệp Office đã upload, không đổi nội dung hay phần mở rộng. Văn bản được hiển thị như chữ thường, không thực thi HTML/script. API `GET /api/files/{id}/preview` kiểm tra quyền như download: người quản lý khóa hoặc User đã ghi danh mới được đọc tệp. Bản xem và tệp gốc không được lưu trong cache dùng chung. Không cần migration mới.

Để xem Office trên máy Windows mới, chạy một lần từ thư mục gốc:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-office-preview.ps1
```

Công cụ tải bản LibreOffice chính thức, xác minh SHA256 rồi giải nén vào `.tools/libreoffice` riêng của dự án; thư mục runtime không được commit lên Git. Khởi động lại backend trong Visual Studio bằng Shift+F5 rồi F5. Nếu đã cài LibreOffice trong Program Files, backend tự tìm. Có thể cấu hình `DocumentPreview:ExecutablePath` bằng User Secrets hoặc `DocumentPreview__ExecutablePath` trong môi trường triển khai; Linux dùng executable `soffice` của LibreOffice Writer/Impress/Calc.

Bộ chuyển Office dùng profile riêng, tắt macro/OLE/DDE, giới hạn thời gian và dọn thư mục tạm sau khi xử lý. Backend kiểm tra chữ ký tệp, cấu trúc DOCX/PPTX/XLSX, giới hạn giải nén và từ chối macro trong gói Open XML. Bản xem PDF được cache trong vùng lưu trữ riêng và xóa cùng tệp gốc. Tệp hỏng/cần mật khẩu hoặc máy chưa có bộ chuyển sẽ có thông báo; người dùng vẫn tải được bản gốc. Khi triển khai thực tế, chạy bộ chuyển bằng tài khoản ít quyền hoặc container, cập nhật LibreOffice và bố trí thư mục upload bền vững.

Sau khi chạy API và cập nhật database, có thể kiểm tra phân quyền thực tế bằng `npm.cmd run test:authorization`. Lệnh tạo và dọn các bản ghi QA tạm, không thay đổi tài khoản người dùng hiện có.

Kiểm tra vòng đời đăng ký/đăng nhập, hash mật khẩu trong SQL, email trùng khi gửi đồng thời, token giả, đặt lại mật khẩu và ghi danh/hủy ghi danh bằng `npm.cmd run test:auth`. Chạy tuần tự các bộ kiểm thử tích hợp vì chúng đối chiếu số lượng và checksum dữ liệu trước/sau. Cần `sqlcmd`, Windows Authentication và tài khoản Admin trong User Secrets hoặc biến môi trường; xem [kết quả kiểm tra logic](docs/logic-audit.md).

`npm.cmd run test:roles` so sánh các hàm quyền FE với API và SQL, bao gồm bỏ phân công và các tình huống đổi vai trò/phân công/tự tạo khóa đồng thời. Sau khi mở Edge thử nghiệm theo hướng dẫn kiểm thử browser, chạy `npm.cmd run test:roles:browser` để thử đủ bốn vai trò, chuyển phân công ở phiên khác và dữ liệu học tập. Script SQL chỉ đọc cho buổi demo: `database/queries/AuditPermissions.sql`.
