# Frontend — CourseFlow

Ứng dụng JavaScript ES modules, CSS và HTML, dùng Vite để phát triển và build. Frontend chạy độc lập với .NET và không chứa kết nối SQL Server hoặc JWT signing key.

## Chạy

Cài dependencies tại gốc repository (`npm.cmd install` hoặc `npm.cmd ci`). Sau đó:

```powershell
# Từ thư mục frontend/
npm.cmd run dev
```

Mở http://localhost:5173/. Backend cần chạy tại http://localhost:5106 để tải dữ liệu và thực hiện các thao tác.

Từ thư mục gốc có thể dùng `npm.cmd run dev:frontend`, hoặc `npm.cmd run dev` để chạy cả hai ứng dụng.

## Cấu trúc

- `index.html`: khung trang, sidebar, topbar, vùng nội dung và dialog.
- `src/main.js`: điểm khởi tạo và import stylesheet.
- `src/app.js`: trạng thái ứng dụng, các trang, định tuyến hash, biểu mẫu và xử lý thao tác.
- `src/api/client.js`: HTTP client, JWT session, xử lý lỗi, tải file và mã hóa nội dung.
- `src/config.js`: cấu hình API công khai theo môi trường.
- `src/components/icons.js`: SVG icons dùng chung.
- `src/styles/main.css`: giao diện desktop/tablet/điện thoại.
- `public/`: file tĩnh được đưa vào kết quả build.
- `tests/`: kiểm tra hợp đồng HTTP client và cấu hình.

## Môi trường API

Sao chép `.env.example` thành `.env.local` khi cần đổi mặc định:

```dotenv
VITE_API_BASE_URL=/api
API_PROXY_TARGET=http://localhost:5106
```

Vite chuyển tiếp `/api` và `/swagger` sang backend trong chế độ development và preview. `API_PROXY_TARGET` chỉ được dùng tại Vite server; `VITE_API_BASE_URL` được đưa vào mã trình duyệt lúc build. Khởi động lại Vite sau khi thay đổi file môi trường.

Khi build để triển khai frontend và backend trên hai nguồn khác nhau:

```dotenv
VITE_API_BASE_URL=https://api.example.com/api
```

Khai báo nguồn frontend tương ứng trong `Cors:AllowedOrigins` của backend. Với deployment dùng `/api` cùng nguồn, cấu hình web server/reverse proxy chuyển `/api` sang backend; Vite proxy không tự đi cùng các file production.

## Build và kiểm thử

```powershell
npm.cmd run build
npm.cmd test
npm.cmd run preview
```

- Build tạo các file tĩnh và tài nguyên có hash trong `dist/`.
- Preview tại http://localhost:4173/ chỉ để kiểm tra bản build trên máy phát triển.
- Triển khai `dist/` bằng static hosting hoặc web server riêng; không cần ASP.NET/Razor.
- Định tuyến dùng hash (`#/courses/...`), giữ nguyên các URL màn hình hiện có.

Phiên đăng nhập nằm trong sessionStorage của từng tab; backend xác minh JWT và quyền truy cập. Số liệu và tiến độ đều lấy từ API. Khi chuyển từ giao diện cũ tại cổng 5106 sang cổng 5173, cần đăng nhập lại vì đây là hai nguồn trình duyệt khác nhau.
