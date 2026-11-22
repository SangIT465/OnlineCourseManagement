# Phân quyền: Admin, Staff, Instructor và User

| Chức năng | Admin | Staff (nhân viên) | Instructor (giảng viên) | User (sinh viên) |
| --- | --- | --- | --- | --- |
| Xem thư viện và hồ sơ của mình | Có | Có | Có | Có |
| Ghi danh, học bài, cập nhật tiến độ | Không | Không | Không | Khóa đã ghi danh, tiến độ của mình |
| Quản lý danh mục | Có | Có | Không | Không |
| Tạo khóa học | Có | Có | Có, tự phân công cho mình | Không |
| Sửa/xóa khóa học, bài học, học liệu | Tất cả khóa | Tất cả khóa | Chỉ khóa được giao | Không |
| Xem ghi danh và tiến độ sinh viên | Tất cả khóa | Tất cả khóa | Chỉ khóa được giao | Chỉ dữ liệu của mình |
| Xem danh sách tài khoản | Tất cả | Chỉ User | Không | Không |
| Tạo, xóa tài khoản, thay vai trò | Có, có bảo vệ Admin và ràng buộc dữ liệu | Không | Không | Đăng ký công khai chỉ tạo User |
| Phân công giảng viên và nhân viên | Có | Không | Không | Không |
| Đặt lại mật khẩu qua quản trị | Mọi vai trò | Chỉ User | Không | Không |

## Thao tác trên giao diện

1. Admin mở **Tài khoản** để tạo tài khoản với một trong bốn vai trò hoặc dùng **Thay đổi vai trò** cho tài khoản có sẵn.
2. Mở chi tiết khóa học, chọn **Phân công giảng viên** và **Phân công nhân viên**. Hai phân công độc lập; mỗi danh sách chỉ gồm tài khoản đúng vai trò.
3. Giảng viên có **Khóa tôi giảng dạy** và **Học viên của tôi**. Khóa do giảng viên tạo tự gán cho họ. Giảng viên quản lý bài học, học liệu và tiến độ trong các khóa được giao.
4. Nhân viên có màn hình **Sinh viên** để tìm User và đặt lại mật khẩu; không có nút tạo, xóa hoặc phân quyền tài khoản.
5. User có **Khóa học của tôi**, **Tiến độ học tập**, chỉ mở nội dung/tài liệu sau khi ghi danh.
6. **Vai trò & quyền** hiển thị ma trận quyền và vai trò hiện tại.

Đăng ký công khai luôn tạo User; yêu cầu đăng ký vai trò khác bị từ chối tại API. Mật khẩu mới tối thiểu 8 ký tự. Không thể tự hạ quyền hoặc xóa chính Admin đang đăng nhập.

## Thực thi tại backend

JWT mới có claim `permission` do `AppPermissions` sinh từ vai trò. `AppPolicies` kết hợp role/permission; `ManageCourseHandler` kiểm tra tài nguyên khóa học qua `IAuthorizationService`. Khi chuyển từ token cũ chưa có permission claims, cần đăng nhập lại. Phân công lại vẫn được kiểm tra bằng dữ liệu hiện tại trên từng request.

- `Security/AppRoles.cs` định nghĩa bốn mã và quyền quản lý từng khóa.
- Admin/Staff vận hành catalog. Instructor phải có `Courses.InstructorId` trùng định danh trong JWT. Chuyển bài học kiểm tra cả khóa nguồn lẫn khóa đích.
- Kiểm tra quan hệ áp dụng cho sửa/xóa, upload/download và báo cáo học viên. Đổi HTML hoặc ID trong request không cấp thêm quyền.
- Instructor không được xem danh sách tài khoản, ghi danh toàn hệ thống hoặc sửa danh mục. Staff chỉ được xem/hỗ trợ tài khoản User.
- Phân công lại khóa làm giảng viên cũ mất quyền quản lý ở request tiếp theo. Không thể đổi vai trò Staff/Instructor đang có khóa được giao; phải phân công lại trước.
- Đổi vai trò hoặc đặt lại mật khẩu tạo SecurityStamp mới. JWT được đối chiếu với vai trò và stamp trong database. Token cũ bị từ chối ngay, kể cả khi vai trò được đổi về giá trị ban đầu.
- Tài khoản đã xóa không tiếp tục dùng token cũ. PasswordHash và SecurityStamp không trả ra API hồ sơ/danh sách.
- Thay đổi/xóa Admin được kiểm tra trong giao dịch; phải giữ ít nhất một Admin. Các ràng buộc dữ liệu ngăn xóa tài khoản/khóa đang có dữ liệu liên quan.

## SQL Server và migration

Áp dụng toàn bộ migration từ thư mục gốc:

```powershell
$env:ASPNETCORE_ENVIRONMENT = "Development"
dotnet ef database update --project backend/OnlineCourseManagement.Api --startup-project backend/OnlineCourseManagement.Api
```

Migration cũ `SimplifyRolesAndSecureSessions` chuyển Student → User, Instructor → Staff và thêm bảo vệ phiên đăng nhập. Migration tiếp theo `AddInstructorRoleAndSeparateAssignments` bổ sung Instructor với quyền theo khóa, thêm `Courses.StaffId` và chuyển phân công Staff cũ từ InstructorId sang StaffId. ID, mật khẩu, khóa học, bài học, ghi danh và tiến độ được giữ nguyên. Không tự đổi Staff hiện có thành Instructor; Admin chủ động cấp quyền giảng viên. Phiên cũ trước migration bảo vệ phiên cần đăng nhập lại.

Trong SSMS, `Users.Role` chấp nhận Admin, Staff, Instructor, User. `Courses.StaffId` là nhân viên vận hành, `Courses.InstructorId` là giảng viên. `Enrollments.StudentId` tham chiếu tài khoản User.

- `PUT /api/courses/{id}/staff` nhận `{ "staffId": 123 }`, chỉ chấp nhận Staff.
- `PUT /api/courses/{id}/instructor` nhận `{ "instructorId": 456 }`, chỉ chấp nhận Instructor.
- Cả hai route chỉ Admin được gọi. `GET /api/courses/my` trả khóa được phân công theo vai trò Staff/Instructor.
- Downgrade migration mới bị chặn khi còn tài khoản Instructor. Cần phân công lại khóa và chuyển các tài khoản này sang vai trò tương thích trước khi downgrade.

## Kiểm thử

```powershell
# Không cần API đang chạy
npm.cmd test
# Cần API/SQL Server đã áp dụng migration
npm.cmd run test:authorization
```

Kiểm thử tích hợp tạo bản ghi QA tạm cho bốn vai trò, thử quyền cho phép/bị từ chối, chuyển bài học giữa khóa, phân công lại giảng viên, thu hồi token và quyền tải file; tự dọn dữ liệu. Thông tin Admin lấy từ COURSEFLOW_TEST_ADMIN_EMAIL/PASSWORD hoặc User Secrets AdminSeed:Email/Password. Không ghi mật khẩu hay token vào log hoặc mã nguồn.
