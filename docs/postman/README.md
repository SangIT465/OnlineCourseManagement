# Postman

Import `CourseFlow.postman_collection.json` và `Local.postman_environment.json`, chọn environment **CourseFlow Local**. Điền `adminEmail`, `adminPassword` bằng tài khoản Admin của máy đang thử. Không commit environment đã chứa mật khẩu hoặc token.

Collection dùng `baseUrl = http://localhost:5106/api`. Các request giữ JWT trong environment sau khi đăng nhập, dùng Bearer và gửi `X-Request-ID` để đối chiếu log. Có thể mở từng request hoặc chạy theo thứ tự bằng Collection Runner.

Luồng mẫu tạo danh mục/khóa/bài học có tiền tố `POSTMAN QA`, tạo sinh viên tạm, ghi danh, cập nhật tiến độ, thử thao tác bị cấm, sau đó xóa các bản ghi do collection tạo. Collection không xóa dữ liệu có sẵn. Nếu dừng giữa chừng, các bản ghi QA có thể còn lại; dùng ID đã lưu trong environment để kiểm tra và dọn đúng các bản ghi đó.

Request xóa khóa khi còn bài học phải trả **409**. Request sửa khóa bằng tài khoản sinh viên phải trả **403**. Xóa bài học có tiến độ nhưng không còn tài liệu sẽ xóa tiến độ của bài đó trong cùng giao dịch.

Upload thử bằng Swagger: đăng nhập Admin hoặc giảng viên phụ trách → Authorize → chọn `POST /api/files/lessons/{lessonId}/document`, tải PDF thật. Ảnh khóa học hỗ trợ JPG/PNG/WebP. File được kiểm tra dung lượng và chữ ký định dạng ở backend; sửa đuôi file không vượt qua được kiểm tra.
