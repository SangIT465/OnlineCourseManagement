# Kiểm tra logic hệ thống — 22/11/2026

Kiểm tra mã nguồn, API thật, SQL Server và giao diện trên Edge. Các bộ kiểm thử chỉ tạo dữ liệu QA và dọn dữ liệu đó; giữ nguyên tài khoản, khóa học và tiến độ hiện có.

Kết quả đã ghi nhận: 25 kiểm thử Node, 52 kiểm thử xUnit, 5 suite API/SQL và 28 kiểm tra giao diện trong đợt kiểm tra quyền đều đạt. Sau cập nhật xác nhận đăng xuất, 10 kiểm tra auth/mất kết nối/Hủy đăng xuất đã qua và frontend build thành công. Suite đồng bộ quyền đối chiếu HTTP, hàm quyền FE và SQL, gồm 12 vòng thao tác đồng thời. Build backend/frontend thành công, không có cảnh báo .NET. EF xác nhận không có thay đổi model cần migration.

## Lỗi đã sửa

1. SQL Server không lưu `DateTime.Kind`, khiến thời gian API trả về mất hậu tố UTC sau khi đọc lại. Thêm EF value converter cho mọi timestamp, kể cả `CompletedAt` nullable. Không đổi schema, không cập nhật lại bản ghi cũ. Cách xử lý theo [tài liệu EF Core](https://learn.microsoft.com/en-us/ef/core/modeling/value-conversions#specify-the-datetimekind-when-reading-dates).
2. Đăng ký thành công nhưng yêu cầu đăng nhập tự động thất bại khiến biểu mẫu vẫn báo lỗi đăng ký chung. Giao diện nay thông báo tài khoản đã tạo, chuyển sang đăng nhập và điền email đã đăng ký.
3. Tải catalog thất bại sau đăng nhập/đăng xuất có thể giữ giao diện tài khoản cũ. Chuyển việc tải dữ liệu về luồng render có xử lý lỗi để cập nhật trạng thái tài khoản và xóa nội dung riêng tư trước khi tải catalog.
4. Admin đổi phân công ở phiên khác nhưng giảng viên vẫn thấy khóa cũ khi chuyển trang: tải lại dữ liệu khi điều hướng/quay lại cửa sổ và kiểm tra lại auth/me.
5. Thiếu bỏ phân công: cho phép Admin gửi null, thêm lựa chọn FE và kiểm chứng SQL NULL; hai phân công vẫn độc lập.
6. Phân công/đổi vai trò đồng thời có thể gặp deadlock trả 500: dùng cùng update lock/transaction và trả 409 cho deadlock kể cả khi EF bọc exception. Bảo vệ cả luồng tự tạo khóa.

## Phạm vi đã xác nhận

| Nhóm | Tình huống |
| --- | --- |
| Đăng ký | Trường bắt buộc, email sai, mật khẩu ngắn/trống, chặn tự cấp quyền, chuẩn hóa email/tên, email trùng và hai request đồng thời |
| Mật khẩu | SQL lưu hash PBKDF2 có salt; kiểm chứng hash với mật khẩu gốc ở bộ nhớ; giữ nguyên khoảng trắng trong mật khẩu; không trả hash/stamp trong hồ sơ |
| Đăng nhập | Email hoa/thường, sai mật khẩu, tài khoản không tồn tại, token thiếu/giả, khôi phục phiên khi tải lại trang |
| Phiên và quyền | Đổi quyền/đặt lại mật khẩu/xóa tài khoản làm token cũ mất hiệu lực; Staff không cấp quyền; Instructor chỉ quản lý khóa của mình; User không truy cập quản trị |
| Catalog | Thêm/sửa/xóa danh mục, khóa học, bài học; đọc SQL độc lập để xác nhận; chặn xóa khi còn dữ liệu liên quan |
| Học tập | Chặn xem bài khi chưa ghi danh; chặn ghi danh trùng/giả mạo sinh viên; hoàn thành lặp không đổi thời điểm; bỏ hoàn thành; hủy ghi danh xóa tiến độ; ghi danh lại bắt đầu từ 0 |
| Học liệu | Upload/download/xóa theo quyền; chặn định dạng giả; chặn chuyển/xóa bài đang có tài liệu không phù hợp |
| API | Validation, lỗi ProblemDetails, request ID, phân trang/lọc/sắp xếp, CORS, Swagger và health |
| Giao diện | 28 kiểm tra bốn vai trò/đồng bộ/mobile; 10 kiểm tra đăng ký/phiên, mất kết nối và xác nhận/Hủy đăng xuất |

## Chạy lại

### Tài khoản seed cũ

Database hiện có 1.004 tài khoản: 1.000 tài khoản chứa hash giả từ các script seed SQL cũ; 4 tài khoản có định dạng hash ASP.NET Identity hợp lệ. Tài khoản seed có hash giả không dùng để đăng nhập trực tiếp. Admin cần đặt lại mật khẩu cho tài khoản cụ thể muốn dùng thử, hoặc đăng ký tài khoản mới qua giao diện. Không đặt lại hàng loạt mật khẩu trong lần kiểm tra này. Tài khoản đăng ký mới đã được kiểm chứng lưu hash đúng và đăng nhập được.

### Lệnh kiểm thử

```powershell
npm.cmd test
npm.cmd run test:backend
# Khởi chạy API và SQL trước; chạy các lệnh sau lần lượt:
npm.cmd run test:auth
npm.cmd run test:authorization
npm.cmd run test:roles
npm.cmd run test:crud
npm.cmd run test:contracts
```

Các kiểm thử HTTP dùng `COURSEFLOW_API_URL` (mặc định `http://localhost:5106/api`). Kiểm thử SQL dùng `COURSEFLOW_TEST_SQL_SERVER` và `COURSEFLOW_TEST_SQL_DATABASE` (mặc định `.\SQLEXPRESS`, `OnlineCourseDB`), cần `sqlcmd`. Tài khoản kiểm thử lấy từ `COURSEFLOW_TEST_ADMIN_EMAIL`/`COURSEFLOW_TEST_ADMIN_PASSWORD` hoặc User Secrets hiện tại; không ghi mật khẩu/token vào repository hoặc log.

Để chạy kiểm tra giao diện đăng nhập, mở frontend và một Edge nền với profile riêng:

```powershell
$auditProfile = Join-Path $env:TEMP ('courseflow-auth-browser-' + [guid]::NewGuid().ToString('N'))
Start-Process -FilePath 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' -WindowStyle Hidden -ArgumentList @('--headless=new', '--no-first-run', '--remote-debugging-port=9333', ('--user-data-dir="' + $auditProfile + '"'), 'about:blank')
npm.cmd run test:auth:browser
npm.cmd run test:roles:browser
```

Chỉ kết nối với trình duyệt thử nghiệm này. Script có thể dùng `COURSEFLOW_FRONTEND_URL` và `COURSEFLOW_BROWSER_DEBUG_URL` khi đổi cổng. Sau kiểm thử, đóng tiến trình Edge thuộc profile vừa tạo. Các kiểm thử browser cần API qua proxy của frontend. Suite quyền browser còn đọc SQL và so checksum nên cần sqlcmd/cấu hình database như test:roles; không chạy song song với suite tạo dữ liệu khác.

Đây là kiểm tra chức năng trên môi trường development; chưa bao gồm kiểm thử tải hoặc thử nghiệm triển khai production. Hệ thống hiện ghi danh trực tiếp, chưa có thanh toán hoặc xác thực email/quên mật khẩu qua email; đặt lại mật khẩu do Admin/Staff thực hiện theo quyền.
