# Database scripts

`seeds/` lưu các script SQL được chuyển nguyên trạng từ `SeedData/` và `seed_users.sql` tại thư mục gốc cũ.

Schema chuẩn được quản lý bởi EF Core migrations trong `backend/OnlineCourseManagement.Api/Migrations/`. Việc sắp xếp thư mục không thay đổi database, tên bảng hay lịch sử migration.

## Kiểm tra dữ liệu trong SSMS và thử thêm/sửa/xóa

Kết nối SSMS tới `.\SQLEXPRESS` bằng Windows Authentication, chọn database `OnlineCourseDB`. Mở `database/queries/InspectData.sql` và nhấn F5 để xem số lượng bản ghi, vai trò, danh sách khóa học/bài học, ghi danh và lịch sử migration. Script này chỉ đọc dữ liệu, không hiển thị password hash hoặc khóa bảo vệ phiên.

Khi backend đang chạy và SQL Server đã áp dụng migration, từ thư mục gốc chạy:

```powershell
npm.cmd run test:crud
```

Lệnh thêm, đọc lại, sửa và xóa danh mục/khóa học/bài học QA tạm qua API, đối chiếu trực tiếp dữ liệu SQL sau từng bước, kiểm tra tiếng Việt và học phí thập phân. Lệnh cũng kiểm tra việc chặn xóa danh mục còn khóa học và khóa còn bài học. Sau cùng, các bản ghi QA được xóa; số lượng và checksum các bảng phải khớp với trước khi thử. ID tự tăng có thể có khoảng trống do các bản ghi kiểm thử đã bị xóa.

Kiểm thử cần `sqlcmd` trong PATH và Windows Authentication. Thông tin Admin lấy từ User Secrets hoặc `COURSEFLOW_TEST_ADMIN_EMAIL`/`COURSEFLOW_TEST_ADMIN_PASSWORD`. Có thể cấu hình `COURSEFLOW_API_URL`, `COURSEFLOW_TEST_SQL_SERVER`, `COURSEFLOW_TEST_SQL_DATABASE` khi thử trên môi trường khác; API và kết nối SQL phải trỏ cùng database.

Các script seed là dữ liệu thử nghiệm chạy thủ công. Đọc script, kiểm tra database đích và dữ liệu đang có trước khi thực thi. Ứng dụng không tự chạy các script trong thư mục này.

## Catalog khóa học có thể nạp lại

`seeds/course-catalog.json` là bộ dữ liệu mẫu mới:

| Nội dung | Số lượng |
| --- | --- |
| Danh mục | 6 |
| Khóa học | 24 |
| Bài học | 192 (8 bài/khóa) |
| Khóa miễn phí | 6 |
| Khóa có học phí | 18 |

Mỗi bài có tiêu đề, thời lượng và bài tập thực hành bằng tiếng Việt. Đây là nội dung mẫu phục vụ thử nghiệm thao tác, không phải bộ video hoặc giáo trình đầy đủ.

Từ thư mục gốc, sau khi đã cấu hình backend và cập nhật schema:

```powershell
npm.cmd run seed:catalog
```

Seeder chỉ chạy khi được gọi bằng `--seed-catalog` trong Development, không mở HTTP server và không tự chạy khi khởi động ứng dụng. Nó không tạo hoặc thay đổi tài khoản, ghi danh, tiến độ hay file đã tải lên.

Quy tắc nạp:

- Tái sử dụng danh mục có cùng tên và khóa học có cùng tên trong danh mục đó, không phân biệt chữ hoa/thường.
- Tái sử dụng bài học theo khóa học + thứ tự. Giữ nguyên tiêu đề/nội dung nếu người dùng đã sửa bài tại thứ tự đó.
- Không ghi đè mô tả, học phí hoặc phân công nhân viên của khóa học đã có.
- Chỉ thêm phần còn thiếu; toàn bộ lần nạp được commit hoặc rollback cùng nhau.
- Đổi tên danh mục/khóa học rồi nạp lại có thể tạo thêm bản mẫu với tên ban đầu. Phần đã xóa sẽ được thêm lại chỉ khi chủ động chạy lệnh.

Các khóa mới để trống nhân viên để bạn dễ thử thao tác phân công từ tài khoản Admin.

## Sáu khóa thử banking giá nhỏ

Chạy `npm.cmd run seed:banking` khi API local đang hoạt động và Admin test đã cấu hình trong User Secrets hoặc `COURSEFLOW_TEST_ADMIN_EMAIL`/`COURSEFLOW_TEST_ADMIN_PASSWORD`. Dữ liệu nằm ở `seeds/banking-test-courses.json`: danh mục **Kiểm thử Banking**, ba khóa **10.000 VNĐ**, ba khóa **5 VNĐ** và mỗi khóa có một bài thực hành để thử quyền học sau thanh toán. Mốc 5 VNĐ là 5 đồng, không phải 5.000 đồng.

Lệnh thêm qua API vào SQL, không tạo đơn/thanh toán/ghi danh và không sửa dữ liệu đang có. Chạy lại sẽ dùng lại danh mục/khóa cùng tên và bài thứ nhất; nếu một khóa đã có nhưng giá khác bộ seed, lệnh báo lỗi thay vì ghi đè. Kết quả và ID lưu tại `artifacts/banking-courses-seed.json`. Trên frontend mở `/#/courses?search=Banking` hoặc lọc danh mục **Kiểm thử Banking** để xem đủ sáu khóa; frontend lấy giá từ API.

## Gợi ý thử giao diện

1. Vào Khám phá, thử danh mục, học phí, tìm kiếm, sắp xếp và chuyển trang.
2. Dùng Admin mở một khóa, sửa thông tin, phân công nhân viên và quản lý tám bài học.
3. Dùng User (sinh viên) ghi danh một khóa miễn phí, đọc bài đầu tiên và đánh dấu hoàn thành. Với tám bài, tiến độ đầu tiên là 12,5%.
4. Tải lại trang để kiểm tra tiến độ vẫn được lưu trong SQL Server; thử hủy đánh dấu hoàn thành.

Chạy `npm.cmd test` ở gốc để kiểm tra cả HTTP client frontend và tính hợp lệ của catalog.
