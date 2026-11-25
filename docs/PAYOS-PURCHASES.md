# Mua khóa học qua payOS và in bill

User chọn **Mua khóa học**, nhập thông tin người mua và tạo đơn. Backend lưu giá từ khóa học tại thời điểm đặt, tạo payment link bằng SDK payOS và hiển thị mã QR do payOS trả về. Khi thanh toán được xác minh, hệ thống chuyển đơn sang Paid và tạo ghi danh trong cùng transaction. Khóa miễn phí có bill tổng 0 đồng và mở quyền học ngay.

## Cấu hình kênh payOS

Tạo kênh thanh toán tại https://my.payos.vn và kết nối ngân hàng nhận tiền theo hướng dẫn payOS. Lấy Client ID, API Key và Checksum Key của kênh. Đặt khóa ở **backend**, không đặt trong `VITE_*`, không commit và không gửi vào chat.

Cách nhập khóa không hiển thị ra màn hình và không đưa khóa vào lịch sử lệnh: mở PowerShell tại thư mục gốc và chạy:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/configure-payos.ps1 -FromClipboard
```

Dùng nút sao chép cạnh Client ID trên kênh payOS, quay về Terminal và chỉ nhấn Enter (không Ctrl+V). Công cụ đọc clipboard trực tiếp và chỉ in số ký tự đã nhận. Lặp lại với API Key và Checksum Key khi được hỏi. Công cụ chỉ cập nhật ba khóa payOS bằng User Secrets, giữ nguyên JWT và chuỗi kết nối đang có. Khởi động lại backend sau khi nhập.

Windows PowerShell có thể lưu phím Ctrl+V thành một ký tự điều khiển trong ô nhập `Read-Host -AsSecureString`. Nếu mỗi khóa chỉ có một ký tự thì cấu hình chưa đúng. Công cụ từ chối khóa quá ngắn hoặc chứa ký tự điều khiển và không lưu bất kỳ khóa nào trong lần nhập lỗi. Chế độ `-FromClipboard` tránh lỗi dán này.

Khi chạy bằng Visual Studio, dùng **Stop Debugging (Shift+F5)** rồi chạy lại bằng F5 sau khi lưu khóa. Profile `http`/`https` trong dự án dùng môi trường Development và đọc cùng User Secrets như lệnh dotnet. Cũng có thể bấm phải project **OnlineCourseManagement.Api → Manage User Secrets**, sửa ba trường `PayOS:ClientId`, `PayOS:ApiKey`, `PayOS:ChecksumKey` bằng khóa thật và giữ nguyên các trường JWT/SQL Server khác. Không gửi nội dung file secrets để nhờ hỗ trợ.

Nếu cấu hình trước đó lưu nguyên chữ `DAN_CLIENT_ID_VAO_DAY`, `DAN_API_KEY_VAO_DAY`, `DAN_CHECKSUM_KEY_VAO_DAY` hoặc `<CLIENT_ID>`, đó là chữ mẫu, không phải khóa thật. payOS sẽ không nhận diện được kênh. Ứng dụng không coi các chữ mẫu này là cấu hình hợp lệ.

Cách cấu hình bằng lệnh bên dưới cũng được hỗ trợ; **bắt buộc thay toàn bộ placeholder trong dấu ngoặc kép bằng khóa thật trên máy của bạn**:

```powershell
dotnet user-secrets set "PayOS:ClientId" "<CLIENT_ID>" --project backend/OnlineCourseManagement.Api
dotnet user-secrets set "PayOS:ApiKey" "<API_KEY>" --project backend/OnlineCourseManagement.Api
dotnet user-secrets set "PayOS:ChecksumKey" "<CHECKSUM_KEY>" --project backend/OnlineCourseManagement.Api
dotnet user-secrets set "PayOS:FrontendUrl" "http://localhost:5173" --project backend/OnlineCourseManagement.Api
dotnet user-secrets set "PayOS:SellerName" "Tên đơn vị bán khóa học" --project backend/OnlineCourseManagement.Api
dotnet user-secrets set "PayOS:SellerAddress" "Địa chỉ đơn vị" --project backend/OnlineCourseManagement.Api
dotnet user-secrets set "PayOS:SellerContact" "Email hoặc số điện thoại hỗ trợ" --project backend/OnlineCourseManagement.Api
```

Ở môi trường triển khai, dùng biến môi trường `PayOS__ClientId`, `PayOS__ApiKey`, `PayOS__ChecksumKey`, `PayOS__FrontendUrl` và các trường Seller tương ứng. FrontendUrl là địa chỉ frontend tin cậy để backend tạo return/cancel URL; không nhận returnUrl tùy ý từ người mua. Khởi động lại backend sau khi cấu hình.

Webhook trong kênh payOS phải trỏ đến:

```text
https://<BACKEND_PUBLIC_DOMAIN>/api/purchases/payos/webhook
```

Backend cần được payOS truy cập bằng HTTPS công khai. `localhost` không phải URL webhook mà máy chủ payOS có thể truy cập. Khi chạy cục bộ, dùng một URL HTTPS được chuyển tiếp tới backend hoặc triển khai backend thử nghiệm. Return URL chỉ đưa người dùng về ứng dụng; tham số `status`, `code`, `cancel` trong URL không được dùng làm bằng chứng trả tiền.

Nếu thiếu khóa, ứng dụng vẫn lưu đơn và cho in phiếu đặt mua nhưng hiển thị kênh chưa cấu hình; không tạo mã QR ngân hàng giả hay cấp quyền học cho khóa trả phí.

## Cập nhật SQL Server

```powershell
$env:ASPNETCORE_ENVIRONMENT = "Development"
dotnet ef database update --project backend/OnlineCourseManagement.Api --startup-project backend/OnlineCourseManagement.Api
```

Migration AddCoursePurchases thêm bảng `CoursePurchases`. Dữ liệu tài khoản, khóa và ghi danh cũ được giữ nguyên. Ghi danh có sẵn tiếp tục có quyền học; hệ thống không tự tạo một bill “đã thanh toán” cho lịch sử chưa có chứng từ.

Schema mới có OrderCode duy nhất, mỗi cặp User/Course chỉ có một đơn PendingPayment, FK tới Users/Courses dùng Restrict để giữ lịch sử hóa đơn. Các đơn đã đóng có thể tạo lần mua mới. Đơn đã Paid có thể khôi phục ghi danh đã hủy mà không thu tiền lại qua thao tác mua cùng khóa.

## Giao diện

1. Đăng nhập User, mở khóa chưa ghi danh và chọn Mua khóa học hoặc Nhận khóa học miễn phí.
2. Kiểm tra họ tên trên bill; email được lấy từ tài khoản. Có thể điền điện thoại và địa chỉ.
3. Xác nhận để tạo đơn. Server tự xác định giá, không lấy số tiền do client gửi. Giá có phần lẻ được làm tròn đến đơn vị đồng để thanh toán VND.
4. Với đơn có phí, quét QR bằng ứng dụng ngân hàng hoặc mở trang payOS. Chỉ tạo QR khi kênh được cấu hình. Có thể bấm Tạo QR thanh toán payOS để thử lại việc tạo link cho đơn đã lưu.
5. Màn hình kiểm tra thanh toán định kỳ khi đang mở và có liên kết. Nút Kiểm tra thanh toán cho phép kiểm tra lại trực tiếp từ server. Khi Paid, chọn Vào học ngay.
6. Mở **Đơn mua & hóa đơn** để xem lịch sử và tiếp tục đơn đang chờ. Chọn **In bill / Lưu PDF** để mở chức năng in của trình duyệt.
7. Admin có mục **Đơn mua khóa học** để xem đơn và bill; Staff/Instructor không có quyền đọc hóa đơn người mua.

Trước thanh toán, bản in mang tên Phiếu đặt mua, trạng thái Chờ thanh toán. Sau thanh toán, bản in là Hóa đơn mua khóa học, có số bill, thông tin đơn vị, người mua, tên khóa, số lượng, giá, tổng tiền, ngày tạo/ngày thanh toán và tham chiếu payOS. Đây là chứng từ dịch vụ của ứng dụng, chưa tích hợp nhà cung cấp hóa đơn điện tử thuế.

## API

| Method và route | Quyền | Kết quả |
| --- | --- | --- |
| POST /api/purchases | User | Tạo hoặc lấy lại đơn hiện hành; khóa miễn phí tạo ghi danh ngay |
| GET /api/purchases/my?page=1 | User | 20 đơn mỗi trang của chính mình |
| GET /api/purchases?page=1 | Admin | 20 đơn mỗi trang toàn hệ thống |
| GET /api/purchases/{id} | Chủ đơn User hoặc Admin | Chi tiết bill và QR thanh toán khi còn chờ |
| POST /api/purchases/{id}/payment-link | Chủ đơn User | Tạo/lấy lại payment link payOS cho cùng OrderCode |
| POST /api/purchases/{id}/sync | Chủ đơn User hoặc Admin | Backend hỏi payOS và đồng bộ trạng thái |
| POST /api/purchases/{id}/cancel | Chủ đơn User hoặc Admin | Hủy đơn chờ; cập nhật SQL và hủy liên kết payOS nếu đã tạo |
| GET /api/purchases/{id}/invoice | Chủ đơn User hoặc Admin | HTML đã escape để xem/in |
| POST /api/purchases/payos/webhook | Không dùng JWT; bắt buộc chữ ký payOS hợp lệ | Xử lý thông báo payOS, xác minh lại link và ghi nhận tiền |

Payload tạo đơn:

```json
{
  "courseId": 123,
  "buyerName": "Nguyễn Văn A",
  "buyerPhone": "0901234567",
  "buyerAddress": "Địa chỉ nhận bill"
}
```

Họ tên, số điện thoại và địa chỉ là bắt buộc khi tạo đơn, kể cả khóa miễn phí. Thiếu số điện thoại/địa chỉ hoặc chỉ nhập khoảng trắng sẽ bị chặn trên giao diện; API trả 400 với thông báo tương ứng và không tạo đơn hay ghi danh. Số điện thoại phải có đúng 10 chữ số ASCII từ 0–9; không chấp nhận chữ, khoảng trắng, dấu `+`, dấu gạch hoặc ký tự đặc biệt. Địa chỉ tối đa 300 ký tự; khoảng trắng ở đầu/cuối địa chỉ được loại bỏ trước khi lưu.

Các trường giá, người sở hữu, trạng thái Paid và OrderCode không do client quyết định. `POST /api/enrollments` bị chặn cho khóa có phí khi User chưa có đơn Paid của khóa; không thể bỏ qua thanh toán bằng cách gọi trực tiếp API ghi danh.

## Xác minh và chống xử lý lặp

### Hủy thanh toán và đồng bộ trạng thái

User được hủy đơn đang chờ của mình; Admin được hủy mọi đơn đang chờ. Nút **Hủy thanh toán** xuất hiện ở danh sách cạnh **Xem bill** và trong trang chi tiết. Người dùng phải xác nhận trước khi gửi yêu cầu. API lưu trạng thái `Cancelled` trong `CoursePurchases`, giữ nguyên bill/thông tin người mua và không tạo ghi danh; không xóa lịch sử. Sau khi hủy có thể tạo một đơn mới cho cùng khóa. Gọi hủy lại một đơn đã hủy không tạo thay đổi trùng.

Đơn đã thanh toán không thể hủy bằng chức năng này. Nếu có payment link, backend yêu cầu hủy trên payOS và đối chiếu mã đơn, link, số tiền trước khi cập nhật SQL. Nếu payOS lỗi hoặc chưa xác nhận hủy, SQL giữ trạng thái chờ. Nếu thanh toán hoàn tất trước lúc hủy, backend lưu `Paid` cùng quyền học rồi trả 409 để giao diện hiển thị trạng thái thực tế. Đây không phải chức năng hoàn tiền.

Hủy và xác nhận thanh toán/demo dùng cùng thứ tự khóa SQL theo người mua và đơn, nên không thể vừa hủy vừa cấp quyền từ hai thao tác đối nghịch. Sau thao tác, giao diện tải lại dữ liệu từ API. Danh sách có đơn chờ và chi tiết đơn chờ lấy lại trạng thái mỗi 10 giây khi trang đang hiển thị; lượt làm mới không đóng hộp xác nhận đang mở. Đơn demo không có link payOS cũng được cập nhật khi Admin/User khác thay đổi trạng thái. Khi quay lại cửa sổ, giao diện tiếp tục cơ chế tải lại phiên và dữ liệu hiện có.

### Xác nhận thanh toán demo

Khi chạy Development, `DemoPayment:Enabled=true` được bật sẵn trong `appsettings.Development.json`. Trang đơn đang chờ của User có thêm nút **Đã thanh toán (demo)**. Nút gọi `POST /api/purchases/{id}/demo-confirm`, đánh dấu đơn Paid và ghi danh khóa học trong cùng một giao dịch; sau đó hiển thị **Vào học ngay**. Bấm lại hoặc gửi đồng thời không tạo ghi danh trùng. Đơn và bill cũ được giữ nguyên; tham chiếu xác nhận demo có dạng `DEMO-{OrderCode}` và bill ghi phương thức **Thanh toán demo**.

Chức năng chỉ áp dụng cho đơn của chính User, chặn đơn đã hủy/hết hạn và không gọi ngân hàng/payOS. Nút chỉ hiện khi API trả `canConfirmDemoPayment=true`. Đặt `DemoPayment:Enabled=false` để tắt; ngoài Development, API luôn chặn xác nhận demo dù cờ được bật. Luồng tạo QR, đồng bộ và webhook payOS vẫn hoạt động như trước.

SDK payOS chính thức kiểm tra chữ ký webhook. Sau đó backend đối chiếu OrderCode, PaymentLinkId, số tiền, đơn vị tiền tệ của thông báo và hỏi trạng thái link từ payOS bằng khóa server. Chỉ link PAID và nhận đủ tiền mới mở quyền học.

Thanh toán và ghi danh được lưu trong cùng transaction, có khóa cập nhật. Webhook/polling lặp không tạo enrollment thứ hai hoặc đổi PaidAt của đơn đã Paid. Nếu payOS tạo link nhưng ứng dụng bị mất phản hồi, lần thử lại dùng cùng OrderCode và có nhánh lấy lại link; mã QR phục hồi có thể mở trang checkout payOS thay cho payload chuyển khoản trực tiếp.

Người khác đoán ID không được đọc bill. Thay giá hoặc tên khóa về sau không thay nội dung bill đã lưu. Xóa khóa/người dùng đang có đơn sẽ bị FK chặn; không dọn hóa đơn bằng thao tác xóa dữ liệu catalog.

## Kiểm thử

```powershell
npm.cmd test
npm.cmd run build:frontend
npm.cmd run test:backend

# Chạy thêm các test SQL trên database ngẫu nhiên, dùng gateway giả trong test.
$env:COURSEFLOW_RUN_PURCHASE_SQL_TESTS = "1"
dotnet test backend/OnlineCourseManagement.Api.Tests --configuration Release
Remove-Item Env:COURSEFLOW_RUN_PURCHASE_SQL_TESTS
```

Test SQL tạo database `CourseFlow_PayOS_Test_<GUID>` trên server từ `COURSEFLOW_TEST_SQL_SERVER` hoặc mặc định `.\SQLEXPRESS`, áp dụng migration, chạy luồng mua và tự dọn. Cần tài khoản Windows có quyền tạo/xóa database test. Các test này không gọi chuyển khoản thật và không thay database ứng dụng.

Để kiểm tra thực tế sau cấu hình, tạo đơn của tài khoản thử nghiệm, mở QR payOS, xác nhận chữ ký/tiền và kiểm tra User chỉ học được sau Paid. Kiểm tra thêm tải lại trang, trở về từ payOS, webhook trùng, giá khóa đổi sau khi đặt và in A4/lưu PDF. Việc có khóa SDK hoặc unit test đạt không thay thế một lần thanh toán thử bằng kênh payOS đã cấu hình.

SQL đối chiếu:

```sql
SELECT TOP (20) Id, OrderCode, StudentId, CourseId, Status, Amount, Currency,
       CourseTitle, BuyerName, BuyerEmail, PaymentLinkId, PaymentReference,
       CreatedAt, PaidAt
FROM dbo.CoursePurchases
ORDER BY Id DESC;

SELECT e.Id, e.StudentId, e.CourseId, e.EnrolledAt,
       p.Id AS PurchaseId, p.Status, p.Amount, p.PaidAt
FROM dbo.Enrollments AS e
LEFT JOIN dbo.CoursePurchases AS p
    ON p.StudentId = e.StudentId AND p.CourseId = e.CourseId AND p.Status = N'Paid'
ORDER BY e.Id DESC;
```

Tài liệu nhà cung cấp: [SDK .NET payOS](https://payos.vn/docs/sdks/back-end/net/), [webhook payOS](https://payos.vn/docs/du-lieu-tra-ve/webhook/), [API payOS](https://payos.vn/docs/api/).
