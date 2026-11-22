# Database scripts

`seeds/` lưu các script SQL được chuyển nguyên trạng từ `SeedData/` và `seed_users.sql` tại thư mục gốc cũ.

Schema chuẩn được quản lý bởi EF Core migrations trong `backend/OnlineCourseManagement.Api/Migrations/`. Việc sắp xếp thư mục không thay đổi database, tên bảng hay lịch sử migration.

Các script seed là dữ liệu thử nghiệm chạy thủ công. Đọc script, kiểm tra database đích và dữ liệu đang có trước khi thực thi. Ứng dụng không tự chạy các script trong thư mục này.
