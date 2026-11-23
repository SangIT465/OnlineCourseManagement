# Hướng dẫn kiểm thử quyền Admin qua API và đối chiếu SQL Server

Tài liệu dành cho dự án **OnlineCourseManagement**. Mỗi nhóm chức năng có thao tác trên giao diện, request API, mã HTTP mong đợi và câu lệnh SQL Server để kiểm tra dữ liệu sau thao tác.

**Quy trình sử dụng:** mở frontend và Network để quan sát request, hoặc gửi request bằng Postman/Swagger; sau mỗi thao tác, chạy truy vấn SQL của nhóm đó để so sánh dữ liệu. Các kết quả dưới đây là **kết quả mong đợi**, không phải biên bản đã thực thi.

## 1 Phạm vi quyền Admin hiện có

| Nhóm | Admin được thực hiện | Điểm cần kiểm thử đúng |
| --- | --- | --- |
| Xác thực | Đăng nhập, xem tài khoản hiện tại, kiểm tra quyền Admin | API trả JWT; không có endpoint logout riêng trong AuthController |
| Tài khoản | Tạo, xem, tìm/lọc/phân trang, đổi vai trò, đặt lại mật khẩu, xóa | Chưa có endpoint PUT /api/users/{id} để sửa họ tên/email; đổi vai trò dùng endpoint riêng |
| Danh mục | Thêm, xem, sửa, xóa | Trùng tên hoặc đang có khóa học thì không được xóa/lưu sai quy tắc |
| Khóa học | Thêm, xem, tìm/lọc/sắp xếp/phân trang, sửa, xóa | Khóa có bài học, ghi danh hoặc học liệu có thể bị chặn xóa |
| Phân công | Gán/bỏ giảng viên, gán/bỏ nhân viên | InstructorId và StaffId là hai quan hệ độc lập |
| Bài học | Thêm, xem đầy đủ nội dung, sửa, đổi thứ tự, chuyển khóa khi đủ điều kiện, xóa | Thứ tự phải duy nhất trong khóa; học liệu và tiến độ ảnh hưởng thao tác chuyển/xóa |
| Học liệu | Upload ảnh khóa, upload PDF bài học, liệt kê, download, xóa | Không có PUT/PATCH sửa file; thay file bằng upload mới và xóa file cũ |
| Ghi danh | Xem toàn hệ thống, xem học viên theo khóa | Admin không có quyền ghi danh/hủy ghi danh thay User qua endpoint dành cho người học |
| Tiến độ | Xem tiến độ học viên của khóa | Admin không trực tiếp đánh dấu hoàn thành/hủy hoàn thành bằng endpoint Learning |
| Giao diện | Xem dashboard, hồ sơ, ma trận quyền và đăng xuất | Đối chiếu các API dữ liệu mà frontend đang gọi; không suy ra endpoint mới chỉ từ tên màn hình |

**Quy tắc đọc kết quả:** 200 là xử lý thành công có response; 201 là tạo thành công; 204 là thành công không có body; 400 là dữ liệu sai; 401 là thiếu/sai/hết hiệu lực token; 403 là thiếu quyền; 404 là không có tài nguyên; 409 là trùng hoặc xung đột dữ liệu. File quá lớn có thể bị chặn ở lớp request bằng 413 hoặc ở lớp kiểm tra dung lượng bằng 400.

## 2 Chuẩn bị môi trường và dữ liệu test

### 2.1 Mở ứng dụng và công cụ

1. Mở đúng thư mục `OnlineCourseManagement`.
2. Khởi động backend và frontend bằng quy trình đang dùng của dự án. Có thể chạy `npm.cmd run dev` từ thư mục gốc khi đã cấu hình đủ.
3. Backend mặc định: `http://localhost:5106`; Swagger thường ở `/swagger` khi môi trường cho phép. Frontend dùng cổng Vite được hiển thị khi chạy.
4. Mở SSMS và kết nối SQL Server mà API đang sử dụng. Chọn đúng database theo connection string của môi trường, không chỉ chọn theo tên một database có sẵn.
5. Mở Postman hoặc Swagger. Nếu kiểm thử qua giao diện, mở Developer Tools → Network → Fetch/XHR và giữ log để xem method, URL, payload, response.
6. Chỉ thao tác thêm/sửa/xóa những bản ghi do lần test này tạo. Các câu SQL trong tài liệu dùng để đọc dữ liệu; thao tác nghiệp vụ thực hiện qua API/giao diện.

Kiểm tra kết nối database trong SSMS:

```sql
SELECT @@SERVERNAME AS ServerName, DB_NAME() AS DatabaseName;

SELECT TABLE_SCHEMA, TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_SCHEMA, TABLE_NAME;

SELECT MigrationId, ProductVersion
FROM dbo.__EFMigrationsHistory
ORDER BY MigrationId;
```

Schema nghiệp vụ hiện dùng bảy bảng: `Users`, `Categories`, `Courses`, `Lessons`, `UploadedFiles`, `Enrollments`, `LessonProgresses`. Tên bảng và cột trong tài liệu là của SQL Server, không phải schema TourGo/MySQL.

### 2.2 Biến Postman

Tạo một Environment với các biến sau. `baseUrl` không có `/api` ở cuối vì mỗi request bên dưới đã ghi `/api`.

| Biến | Giá trị hoặc nguồn lấy |
| --- | --- |
| baseUrl | http://localhost:5106 hoặc địa chỉ API thực tế |
| run | admtest20261123a; đổi thành một chuỗi mới mỗi lần chạy lại |
| adminEmail, adminPassword | Tài khoản Admin đang có của môi trường |
| adminToken, adminId | Lấy từ response đăng nhập Admin |
| userId | Tài khoản User dùng để tạo dữ liệu ghi danh/tiến độ |
| staffId | Tài khoản Staff dùng để kiểm tra phân công |
| instructorId | Tài khoản Instructor dùng để kiểm tra phân công |
| tempUserId | Tài khoản riêng để đổi vai trò/reset mật khẩu/xóa |
| tempAdminId | Admin thử nghiệm riêng, không phải Admin đang điều khiển bài test |
| userToken, tempUserToken, tempAdminToken | Token các tài khoản thử nghiệm khi cần |
| categoryId, categoryBId | Hai danh mục tạo trong phần 5 |
| courseId, courseBId | Hai khóa học tạo trong phần 6 |
| lessonId, moveLessonId | Bài chính và bài riêng để kiểm tra chuyển khóa |
| imageId, documentId | ID trả về sau upload ảnh và PDF |

Trong Postman, đặt Authorization của các request Admin thành **Bearer Token → `{{adminToken}}`**. JSON dùng Body → raw → JSON; upload dùng form-data. Request đổi sang vai trò User phải chọn rõ `{{userToken}}`, tránh kế thừa token Admin.

Các số dạng `{{courseId}}` trong JSON là biến Postman, không phải giá trị để gửi nguyên văn. Khi dùng Swagger, thay chúng bằng số ID thực tế.

### 2.3 Quy ước lấy ID và đối chiếu trước sau

Sau mỗi POST tạo tài nguyên, đọc trường `id` trong response và lưu đúng biến. Ví dụ Postman tab Scripts → Post-response:

```javascript
pm.test('Tạo danh mục thành công', () => pm.response.to.have.status(201));
pm.environment.set('categoryId', pm.response.json().id);
```

Đổi tên biến tương ứng khi tạo tài khoản, khóa, bài học hoặc file. Không sử dụng cùng một ID cho Course, Lesson và UploadedFile chỉ vì các số trùng nhau.

Ở SQL, thay các số `0` bằng ID đã ghi lại. **Nếu chưa thay ID, không dùng kết quả truy vấn để kết luận test đạt.** Mỗi block SQL có DECLARE riêng để có thể chạy độc lập; biến SQL không phải biến Postman và không tồn tại qua `GO`.

Với mỗi ca, ghi bốn bằng chứng: payload gửi, HTTP/response, dữ liệu SQL trước và sau, trạng thái frontend sau refresh. Một request lỗi phải được kiểm tra rằng dữ liệu liên quan vẫn giữ nguyên.

## 3 Đăng nhập và kiểm tra quyền

### A01 Đăng nhập Admin

**Frontend:** Đăng nhập → nhập tài khoản Admin → xác nhận.

**API:** `POST {{baseUrl}}/api/auth/login`, không cần token.

```json
{
  "email": "{{adminEmail}}",
  "password": "{{adminPassword}}"
}
```

**Mong đợi:** HTTP 200, có `token`, `user.id`, `user.role = Admin`. Response không công khai PasswordHash hay SecurityStamp.

Lưu token bằng Post-response:

```javascript
const result = pm.response.json();
pm.environment.set('adminToken', result.token);
pm.environment.set('adminId', result.user.id);
pm.test('Đúng tài khoản Admin', () => pm.expect(result.user.role).to.eql('Admin'));
```

**SQL sau đăng nhập:**

```sql
SELECT Id, FullName, Email, Role, CreatedAt
FROM dbo.Users
WHERE Role = N'Admin'
ORDER BY Id;
```

Đăng nhập chủ yếu đọc tài khoản và cấp JWT; không có bảng session/refresh-token mới trong schema này. Có thể cập nhật PasswordHash khi bộ hasher xác định cần rehash; không mong đợi xuất hiện một User mới chỉ vì đăng nhập.

### A02 đến A06 Kiểm tra token và giao diện Admin

| Mã | Thao tác/API | Kết quả mong đợi | Đối chiếu data |
| --- | --- | --- | --- |
| A02 | GET /api/auth/me bằng adminToken | 200; cùng adminId, role Admin | So sánh Users theo Id; không có PasswordHash/SecurityStamp trong JSON |
| A03 | GET /api/auth/admin-only bằng adminToken | 200 | Không ghi dữ liệu nghiệp vụ |
| A04 | GET /api/auth/admin-only không token | 401 | Không thay dữ liệu |
| A05 | GET /api/auth/admin-only bằng token User còn hợp lệ | 403 | Không thay vai trò User |
| A06 | Mở dashboard, Hồ sơ, Vai trò & quyền; sau đó thử Đăng xuất và đăng nhập lại | Hiển thị đúng vai trò; đăng xuất xóa phiên phía frontend theo triển khai | Không giả định có API logout/thu hồi token tại server; kiểm tra Network thực tế |

Không ghi mật khẩu thật hoặc JWT vào ảnh báo cáo. Chỉ dùng tài khoản thử nghiệm khi kiểm tra phiên bị vô hiệu hóa ở các phần sau.

## 4 Tài khoản Admin được quản lý

### U01 Tạo đủ các vai trò thử nghiệm

**Frontend:** Tài khoản → Tạo tài khoản → nhập thông tin → chọn vai trò → Lưu.

**API:** `POST {{baseUrl}}/api/users`, Bearer adminToken.

```json
{
  "fullName": "{{run}} - Sinh viên",
  "email": "{{run}}.user@example.test",
  "password": "Demo@123456",
  "role": "User"
}
```

**Mong đợi:** 201; lưu `id` thành `userId`. Lặp lại với thông tin riêng trong bảng để có các tài khoản còn lại:

| Biến lưu ID | Hậu tố email sau {{run}} | Vai trò | Mục đích |
| --- | --- | --- | --- |
| staffId | .staff@example.test | Staff | Phân công nhân viên |
| instructorId | .instructor@example.test | Instructor | Phân công giảng viên |
| tempUserId | .temp@example.test | User | Đổi vai trò, reset và xóa |
| tempAdminId | .admin@example.test | Admin | Thử quyền và xóa Admin không phải bản thân |

Tên mỗi tài khoản đều bắt đầu bằng `{{run}}`; mật khẩu demo dùng riêng cho môi trường test. Backend chuẩn hóa email, băm mật khẩu và lưu một dòng Users cho mỗi lần tạo thành công.

**SQL U đọc sau mỗi thao tác tài khoản:** đổi prefix nếu thay run.

```sql
SELECT Id, FullName, Email, Role, CreatedAt,
       CASE WHEN LEN(PasswordHash) > 0 THEN 1 ELSE 0 END AS HasPasswordHash,
       CONVERT(varchar(64), HASHBYTES('SHA2_256', SecurityStamp), 2) AS StampFingerprint
FROM dbo.Users
WHERE Email LIKE N'admtest20261123a.%'
ORDER BY Id;
```

`HasPasswordHash = 1` xác nhận có dữ liệu băm; không hiển thị hash nguyên văn. `StampFingerprint` dùng so sánh trước/sau đổi quyền hoặc reset mà không in SecurityStamp trực tiếp.

### U02 đến U05 Đọc danh sách và kiểm tra dữ liệu sai

| Mã | Request/thao tác | Mong đợi | SQL sau thao tác |
| --- | --- | --- | --- |
| U02 | GET /api/users?pageNumber=1&pageSize=10&searchTerm=admtest20261123a&sortBy=email&isDescending=false | 200; có items, totalCount, pageNumber, pageSize; kết quả theo từ khóa | Chạy SQL U, so sánh tập tài khoản theo email |
| U03 | GET /api/users?role=Instructor; GET /api/users/{{instructorId}} | 200; lọc đúng role và chi tiết đúng ID | Chạy SQL U |
| U04 | POST tài khoản trùng email đã tạo; POST role Manager; POST password dưới 8 ký tự hoặc email sai | Trùng email 409; role hoặc validation sai 400 | Số dòng thử nghiệm không tăng; role/hash bản ghi cũ không bị thay |
| U05 | GET /api/users/2147483647 sau khi xác nhận ID không tồn tại | 404 | SELECT theo ID trả 0 dòng |

### U06 Đổi vai trò và kiểm tra token cũ

1. Đăng nhập tài khoản `{{run}}.temp@example.test` với mật khẩu demo, lưu `token` thành `tempUserToken`.
2. Chạy SQL U, ghi lại Role và StampFingerprint của tempUserId.
3. Dùng adminToken gửi `PUT {{baseUrl}}/api/users/{{tempUserId}}/role`:

```json
{
  "role": "Instructor"
}
```

4. Mong đợi 200; chạy SQL U: Role đổi Instructor, StampFingerprint đổi, Id/email giữ nguyên.
5. Gọi `GET /api/auth/me` bằng tempUserToken cũ: mong đợi 401.
6. Đổi lại role User bằng cùng endpoint và adminToken. Token cũ ban đầu vẫn bị từ chối; đổi role về giá trị ban đầu không khôi phục SecurityStamp trước đó.
7. Gửi lại cùng role User khi role đã là User: 200; theo code hiện tại không cần đổi stamp nếu role không thực sự thay đổi.

**U07 phân công đang tồn tại:** sau phần 6 đã gán staffId/instructorId vào khóa, thử đổi những người đó sang User. Mong đợi 409; SQL U và SQL C cho thấy role và phân công không đổi. Bỏ/phân công lại hết các khóa trước khi đổi vai trò. Chỉ thử trên tài khoản của lần test.

### U08 Đặt lại mật khẩu và vô hiệu hóa phiên

**Frontend:** Tài khoản → chọn tài khoản thử nghiệm → Đặt lại mật khẩu.

**API:** `PUT {{baseUrl}}/api/users/{{tempUserId}}/reset-password`, Bearer adminToken.

```json
{
  "newPassword": "Demo@654321"
}
```

**Mong đợi:** 200; SQL U cho thấy cùng Id/role nhưng StampFingerprint đổi. Token của người bị reset trước đó trả 401; đăng nhập mật khẩu cũ trả 401; mật khẩu mới trả 200. Thử mật khẩu dưới 8 ký tự → 400, fingerprint giữ nguyên.

Admin được reset các vai trò được hỗ trợ: có thể lặp lại trên staffId, instructorId và tempAdminId; ghi lại mật khẩu mới để đăng nhập phục vụ các ca tiếp theo. Không reset tài khoản Admin thật đang dùng để điều khiển bài test.

### U09 đến U12 Bảo vệ Admin và xóa tài khoản

Các ca DELETE thành công của tài khoản chỉ thực hiện ở phần 11, sau khi đã dùng xong fixture. Giữ tempAdminId nếu cần kiểm tra UploadedById của học liệu.

| Mã | Request | Mong đợi | Kiểm tra SQL |
| --- | --- | --- | --- |
| U09 | PUT /api/users/{{adminId}}/role với role User bằng chính adminToken | 400, không tự hạ quyền | Users.Role của Admin vẫn Admin |
| U10 | DELETE /api/users/{{adminId}} bằng chính adminToken | 400, không tự xóa | Users vẫn có dòng adminId |
| U11 | DELETE tempUserId khi không có quan hệ; sau đó GET lại cùng ID | DELETE 200; GET 404 | SQL U không còn tempUserId; các tài khoản khác giữ nguyên |
| U12 | DELETE tempAdminId bằng Admin gốc, khi còn Admin gốc và không có quan hệ | 200 | Temp Admin bị xóa; vẫn tồn tại ít nhất một Admin |

Sau phần upload/ghi danh, còn phải thử xóa tài khoản đang được Courses, Enrollments hoặc UploadedFiles tham chiếu: 409 và dữ liệu giữ nguyên. Nếu khóa đang gán tài khoản, bỏ phân công trước khi thử đường xóa thành công. Không dùng SQL để xóa bỏ toàn bộ Admin nhằm kiểm tra điều kiện “Admin cuối cùng”; chỉ kiểm thử tình huống đó trên một database cô lập.

**Không có chức năng sửa hồ sơ tổng quát:** `UpdateUserDto` tồn tại trong source không có nghĩa controller hiện cung cấp `PUT /api/users/{id}`. Chưa đưa thao tác sửa FullName/Email vào checklist thành công của Admin. Nếu thử route không được triển khai, có thể nhận 405/404 theo định tuyến, không ghi nhận đó là lỗi CRUD đã có.

## 5 Danh mục

### C01 Thêm danh mục

**Frontend:** Danh mục → Thêm danh mục → nhập tên/mô tả → Lưu.

**API:** `POST {{baseUrl}}/api/categories`.

```json
{
  "name": "{{run}} - Category A",
  "description": "Danh mục kiểm thử thêm sửa xóa"
}
```

Mong đợi 201; lưu id vào categoryId. Tạo thêm Category B với cùng prefix, lưu categoryBId để thử đổi danh mục khóa học. Chuỗi tiếng Việt phải giữ đúng dấu khi đọc lại API và SQL.

**SQL CA chạy sau thêm/sửa và khi bị chặn xóa:**

```sql
SELECT Id, Name, Description
FROM dbo.Categories
WHERE Name LIKE N'admtest20261123a%'
ORDER BY Id;
```

### C02 Sửa danh mục

**API:** `PUT {{baseUrl}}/api/categories/{{categoryId}}`.

```json
{
  "name": "{{run}} - Category A updated",
  "description": "Mô tả đã được Admin chỉnh sửa"
}
```

Mong đợi **204, response không có JSON body**. SQL CA thấy cùng Id, tên/mô tả đổi; GET `/api/categories/{{categoryId}}` trả 200 và dữ liệu mới. Frontend refresh vẫn thấy nội dung đã sửa.

### C03 đến C06 Đọc validation và xóa

| Mã | Thao tác | Mong đợi | SQL |
| --- | --- | --- | --- |
| C03 | GET /api/categories và GET /api/categories/{{categoryId}} | 200 | So sánh Id, Name, Description với SQL CA |
| C04 | Tạo/sửa trùng tên danh mục khác; name trống; description quá 4.000 ký tự | Trùng tên 409; input sai 400 | SQL CA không thêm hoặc sửa sai |
| C05 | DELETE /api/categories/{{categoryId}} sau khi có khóa tham chiếu | 409 | Danh mục và khóa vẫn tồn tại |
| C06 | Xóa danh mục trống hoặc dọn hết khóa rồi DELETE | 204; GET cùng ID → 404 | Không còn dòng danh mục đó |

Đường xóa thành công thực hiện ở cuối để các phần khóa học còn đủ fixture.

## 6 Khóa học và phân công

### K01 Thêm khóa học bằng Admin

**Frontend:** Khóa học → Tạo khóa học → nhập tên, mô tả, giá và danh mục → Lưu.

**API:** `POST {{baseUrl}}/api/courses`.

```json
{
  "title": "{{run}} - Course A",
  "description": "Khóa học dùng kiểm tra API và SQL Server",
  "price": 120000,
  "categoryId": {{categoryId}}
}
```

**Mong đợi:** 201; lưu `id` thành courseId. Admin tạo khóa bình thường có InstructorId và StaffId ban đầu NULL; phân công dùng endpoint riêng. Tạo thêm Course B cùng categoryId, lưu courseBId, để thử chuyển bài giữa hai khóa.

**SQL C chạy sau mỗi thao tác khóa và phân công:**

```sql
SELECT c.Id, c.Title, c.Description, c.Price, c.CategoryId,
       ca.Name AS CategoryName, c.InstructorId,
       i.FullName AS InstructorName, i.Role AS InstructorRole,
       c.StaffId, s.FullName AS StaffName, s.Role AS StaffRole,
       c.CreatedAt
FROM dbo.Courses AS c
JOIN dbo.Categories AS ca ON ca.Id = c.CategoryId
LEFT JOIN dbo.Users AS i ON i.Id = c.InstructorId
LEFT JOIN dbo.Users AS s ON s.Id = c.StaffId
WHERE c.Title LIKE N'admtest20261123a%'
ORDER BY c.Id;
```

### K02 Sửa khóa học

**API:** `PUT {{baseUrl}}/api/courses/{{courseId}}`.

```json
{
  "title": "{{run}} - Course A updated",
  "description": "Nội dung đã sửa",
  "price": 199000.50,
  "categoryId": {{categoryBId}}
}
```

**Mong đợi:** 200; Id và CreatedAt không đổi; Title, Description, Price, CategoryId đổi. SQL C hiển thị giá decimal **199000.50**, danh mục B và giữ phân công đang có. Cập nhật khóa không được coi là cách thay InstructorId/StaffId; kiểm tra bằng endpoint phân công riêng.

### K03 đến K05 Tìm kiếm lọc sắp xếp và dữ liệu sai

| Mã | API | Mong đợi |
| --- | --- | --- |
| K03 | GET /api/courses; GET /api/courses/{{courseId}} | 200; dữ liệu khớp SQL C |
| K04 | GET /api/courses/paged?search=admtest20261123a&categoryId={{categoryBId}}&minPrice=100000&maxPrice=250000&sortBy=price&isDescending=false&pageNumber=1&pageSize=10 | 200; items đúng điều kiện, totalCount và các trường phân trang đúng |
| K05 | POST/PUT price âm; title trống; categoryId không tồn tại; minPrice lớn hơn maxPrice; sortBy không hỗ trợ | 400; SQL C không lưu thay đổi không hợp lệ |

Phân trang hiện kẹp PageNumber vào 1–1.000.000 và PageSize vào 1–100. Test pageSize lớn hơn 100 phải kiểm tra kết quả đã giới hạn, không mặc định mong đợi 400. Các lựa chọn SortBy của khóa là title, price, createdat.

### K06 Gán giảng viên và nhân viên

**Frontend:** mở chi tiết khóa → Phân công giảng viên hoặc Phân công nhân viên → chọn tài khoản → Lưu.

`PUT {{baseUrl}}/api/courses/{{courseId}}/instructor`:

```json
{
  "instructorId": {{instructorId}}
}
```

`PUT {{baseUrl}}/api/courses/{{courseId}}/staff`:

```json
{
  "staffId": {{staffId}}
}
```

**Mong đợi:** mỗi request 200. SQL C thấy InstructorId trỏ Instructor và StaffId trỏ Staff. Gán một trường không xóa/thay đổi trường còn lại. Backend kiểm tra vai trò tài khoản hiện tại trong database khi thực hiện phân công.

### K07 Bỏ phân công và kiểm tra input sai

Gửi một trong hai body tương ứng để bỏ quan hệ:

```json
{
  "instructorId": null
}
```

```json
{
  "staffId": null
}
```

Mong đợi 200; cột tương ứng thành NULL, cột còn lại giữ nguyên. Sau khi thử, gán lại để chạy U07 và các ca quyền giảng viên.

| Ca phân công sai | Mong đợi | Data |
| --- | --- | --- |
| Gán userId hoặc staffId vào instructor | 400 | InstructorId cũ không đổi |
| Gán instructorId vào staff | 400 | StaffId cũ không đổi |
| Gán ID không tồn tại hoặc ID 0/âm | 400 | Không lưu FK sai |
| Gửi `{}` thay vì trường phân công | 400 | Không tự hiểu thành bỏ phân công |
| Staff/Instructor/User tự gọi hai endpoint phân công bằng token hợp lệ | 403 | Cả hai cột không đổi |

### K08 Quyền quản lý theo phân công

Tạo một Instructor thử nghiệm thứ hai nếu muốn kiểm tra đổi người phụ trách. Gán Instructor mới cho courseId bằng Admin, sau đó thử PUT khóa bằng token của giảng viên cũ: mong đợi 403, kể cả token cũ chưa hết hạn. Giảng viên mới chỉ được quản lý khóa được giao; Admin vẫn quản lý cả Course A và Course B. SQL C xác nhận chỉ InstructorId được đổi.

`GET /api/courses/my` dành cho Staff/Instructor được phân công; token Admin hiện không thuộc AssignedOperators nên không dùng route này làm tiêu chí danh sách toàn bộ khóa của Admin. Admin dùng GET /api/courses hoặc /paged.

### K09 Xóa khóa học

1. Khi có Lesson: DELETE `/api/courses/{{courseId}}` → 409.
2. Khi không có Lesson nhưng còn Enrollment hoặc UploadedFile: DELETE → 409.
3. Sau khi dọn các quan hệ theo phần 11: DELETE → 200; GET cùng ID → 404; SQL không còn khóa đó.
4. Các lần xóa bị chặn không được làm mất một phần dữ liệu con.

## 7 Bài học

### L01 Thêm bài học

**Frontend:** chi tiết khóa → Bài học → Thêm bài học → nhập nội dung, thời lượng, thứ tự → Lưu.

**API:** `POST {{baseUrl}}/api/lessons`.

```json
{
  "title": "{{run}} - Lesson A",
  "content": "Nội dung tiếng Việt dùng để đối chiếu database",
  "videoUrl": "https://example.com/demo-video",
  "durationMinutes": 20,
  "orderIndex": 1,
  "courseId": {{courseId}}
}
```

Mong đợi 201; lưu id thành lessonId. Tạo một bài riêng `{{run}} - Lesson move`, orderIndex 3, lưu moveLessonId. Bài riêng này dùng kiểm tra chuyển khóa, không upload file hoặc tạo tiến độ cho nó trước ca chuyển thành công.

**SQL L sau thao tác bài học:**

```sql
SELECT l.Id, l.Title, l.Content, l.VideoUrl,
       l.DurationMinutes, l.OrderIndex, l.CourseId,
       c.Title AS CourseTitle, l.CreatedAt
FROM dbo.Lessons AS l
JOIN dbo.Courses AS c ON c.Id = l.CourseId
WHERE l.Title LIKE N'admtest20261123a%'
ORDER BY l.CourseId, l.OrderIndex, l.Id;
```

### L02 Sửa bài học

**API:** `PUT {{baseUrl}}/api/lessons/{{lessonId}}`.

```json
{
  "title": "{{run}} - Lesson A updated",
  "content": "Nội dung tiếng Việt đã sửa và lưu qua API",
  "videoUrl": "https://example.com/demo-video-updated",
  "durationMinutes": 45,
  "orderIndex": 2,
  "courseId": {{courseId}}
}
```

Mong đợi 200. SQL L thấy cùng Id/CreatedAt, nội dung, thời lượng và thứ tự mới; GET `/api/lessons/{{lessonId}}` bằng Admin trả đầy đủ nội dung mới.

### L03 đến L07 Đọc validation chuyển khóa và xóa

| Mã | Thao tác/API | Mong đợi | SQL L hoặc dữ liệu liên quan |
| --- | --- | --- | --- |
| L03 | GET /api/lessons; GET /api/lessons/course/{{courseId}}; GET /api/lessons/paged?courseId={{courseId}}&sortBy=order&pageNumber=1&pageSize=10 | 200; thứ tự và phạm vi đúng; danh sách công khai là metadata | Đối chiếu CourseId, OrderIndex; không yêu cầu metadata công khai phải chứa Content |
| L04 | POST/PUT trùng cặp CourseId + OrderIndex | 409 | Không tạo thêm dòng trùng và không đổi bản ghi cũ |
| L05 | courseId không có; durationMinutes âm; orderIndex 0; videoUrl javascript: hoặc URL sai | 400 | Nội dung và quan hệ cũ giữ nguyên |
| L06 | PUT moveLessonId sang courseBId, giữ đủ các trường và chọn OrderIndex chưa trùng | 200 khi bài chưa có progress/file | CourseId đổi sang B; khóa nguồn không còn bài đó |
| L07 | PUT lessonId sang khóa khác sau khi có PDF hoặc progress; DELETE khi còn học liệu | 409 | CourseId và file/progress không bị mất |

Thử DELETE bài không có học liệu: 200. Nếu bài có LessonProgresses thì service chủ động xóa các progress của bài rồi xóa Lesson trong cùng SaveChanges; khác với khóa học đang có ghi danh bị chặn xóa. Ca này làm thay đổi tiến độ học viên, nên chỉ thực hiện trên fixture của lần test.

SQL kiểm tra trước/sau xóa một bài; thay LessonId bằng ID đã ghi, không tìm lại ID qua bảng Lessons sau khi xóa:

```sql
DECLARE @LessonId int = 0; -- thay bằng lessonId thực tế

SELECT Id, Title, CourseId FROM dbo.Lessons WHERE Id = @LessonId;
SELECT Id, EnrollmentId, LessonId, IsCompleted, CompletedAt
FROM dbo.LessonProgresses WHERE LessonId = @LessonId;
SELECT Id, OriginalName, FileType, LessonId
FROM dbo.UploadedFiles WHERE LessonId = @LessonId;
```

## 8 Ảnh khóa học và học liệu PDF

### F01 Upload ảnh khóa học

**Frontend:** chi tiết khóa → chọn chức năng thêm ảnh → chọn một ảnh thật → Upload/Lưu.

**API:** `POST {{baseUrl}}/api/files/courses/{{courseId}}/image`, Bearer adminToken. Body → form-data, key **file**, type **File**, chọn ảnh. Để Postman tự tạo multipart boundary; không gán Content-Type application/json.

**Mong đợi:** 201; lưu id thành imageId. SQL có UploadedFile mới với FileType CourseImage, CourseId đúng, LessonId NULL, UploadedById bằng adminId, OriginalName là tên gốc, StoredName là tên sinh mới.

### F02 Upload tài liệu bài học

**API:** `POST {{baseUrl}}/api/files/lessons/{{lessonId}}/document`, form-data key **file**, chọn PDF thật.

Mong đợi 201; lưu id thành documentId. FileType LessonDocument, CourseId là khóa của bài, LessonId đúng, ContentType application/pdf, Size lớn hơn 0. SQL chỉ lưu metadata, nội dung file nằm ở storage trên đĩa.

**SQL F chạy sau upload/liệt kê/download/xóa:**

```sql
DECLARE @CourseId int = 0; -- thay bằng courseId thực tế

SELECT f.Id, f.OriginalName, f.StoredName, f.ContentType, f.Size,
       f.FileType, f.CourseId, f.LessonId, f.UploadedById,
       u.Email AS UploadedByEmail, f.UploadedAt
FROM dbo.UploadedFiles AS f
LEFT JOIN dbo.Users AS u ON u.Id = f.UploadedById
WHERE f.CourseId = @CourseId
ORDER BY f.UploadedAt, f.Id;
```

Storage mặc định nằm dưới content root API: `Uploads/course-images` và `Uploads/lesson-documents`; nếu FileStorage.RootPath được đổi thì kiểm tra thư mục được cấu hình thực tế. Dùng StoredName trong SQL để đối chiếu file trên đĩa.

### F03 đến F06 Liệt kê download dữ liệu sai và xóa

| Mã | Thao tác/API | Mong đợi | SQL và file trên đĩa |
| --- | --- | --- | --- |
| F03 | GET /api/files/courses/{{courseId}}; GET /api/files/lessons/{{lessonId}} bằng Admin | 200; endpoint courses chỉ trả ảnh khóa; endpoint lessons trả PDF bài | Đối chiếu FileType và CourseId/LessonId với SQL F |
| F04 | GET /api/files/{{documentId}}/download bằng Admin | 200, nội dung PDF, tên tải đúng; ảnh cũng kiểm tra download tương ứng | Số metadata không tăng; file tải xuống mở được và có thể so SHA256 với file gốc |
| F05 | Upload sai đuôi, file rỗng, PDF đổi tên thành PNG, ảnh/PDF vượt hạn | Input nội dung/định dạng 400; quá request limit có thể 413 | Không có metadata mới hoặc file rác mới của request thất bại |
| F06 | DELETE /api/files/{{documentId}} hoặc imageId; GET download lại | DELETE 200; download sau xóa 404 | Metadata và file vật lý tương ứng bị xóa; các file khác giữ nguyên |

Các đuôi được chấp nhận hiện tại: ảnh .jpg, .jpeg, .png, .webp; tài liệu .pdf. Service kiểm tra cả chữ ký đầu file. Mặc định giới hạn ảnh 5.000.000 byte, PDF 10.000.000 byte; dùng giá trị cấu hình thực tế nếu đã thay đổi.

**Thay file:** upload file mới trước, kiểm tra bằng SQL F và download; sau đó DELETE file cũ. Hệ thống không tự biến lần upload thứ hai thành UPDATE cùng UploadedFile.Id. Không thử PUT /api/files/{id} như một chức năng đã được triển khai.

**Kiểm tra ràng buộc người upload:** đăng nhập tempAdminId, dùng tempAdminToken upload thêm một file thử nghiệm và ghi lại ID. Sau đó dùng Admin gốc DELETE tempAdminId: mong đợi 409 do UploadedFiles.UploadedById đang tham chiếu. Chạy SQL F để đối chiếu. Xóa file thử nghiệm này trước khi xóa tempAdminId thành công ở phần 11. Không dùng thao tác tự xóa Admin gốc để kiểm tra ràng buộc này vì cơ chế bảo vệ bản thân sẽ trả 400 trước.

## 9 Admin xem ghi danh và tiến độ

### E01 Chuẩn bị dữ liệu bằng đúng vai trò User

Phần này cần một bước tạo dữ liệu của User để Admin có dữ liệu kiểm tra. Đăng nhập `{{run}}.user@example.test`, lưu userToken. Nếu mật khẩu đã đổi, dùng mật khẩu mới.

**Với userToken**, gọi `POST {{baseUrl}}/api/enrollments`:

```json
{
  "courseId": {{courseId}}
}
```

Mong đợi 201, xuất hiện Enrollment với StudentId = userId. Tiếp tục dùng userToken gọi `POST /api/progress/lessons/{{lessonId}}/complete` không cần body: 200, xuất hiện tiến độ hoàn thành. Gọi lại cùng request: 200, không tạo thêm progress và không thay CompletedAt của lần hoàn thành trước.

Ứng dụng hiện chưa tích hợp thanh toán ghi danh; không diễn giải Price của khóa như một giao dịch thanh toán đã được xử lý.

### E02 Admin xem danh sách ghi danh

**Frontend:** mở Ghi danh/Học viên hoặc chi tiết khóa có danh sách sinh viên.

**API Admin:** `GET /api/enrollments`; `GET /api/enrollments/course/{{courseId}}`.

Mong đợi 200; thấy userId, courseId, thời điểm ghi danh; totalStudents đúng theo tập dữ liệu. Không có bản ghi mới chỉ vì mở màn hình danh sách.

**SQL E:**

```sql
DECLARE @CourseId int = 0; -- thay courseId

SELECT e.Id AS EnrollmentId, e.StudentId, u.FullName,
       u.Email, u.Role, e.CourseId, c.Title, e.EnrolledAt
FROM dbo.Enrollments AS e
JOIN dbo.Users AS u ON u.Id = e.StudentId
JOIN dbo.Courses AS c ON c.Id = e.CourseId
WHERE e.CourseId = @CourseId
ORDER BY u.FullName, e.Id;
```

### E03 Admin xem tiến độ học viên

**API:** `GET {{baseUrl}}/api/progress/courses/{{courseId}}/students`, Bearer adminToken.

Mong đợi 200; có courseId, courseName, totalStudents, students; completedLessons, totalLessons và percentage khớp dữ liệu. Sau khi User hủy hoàn thành hoặc hủy ghi danh, Admin refresh phải nhận dữ liệu mới.

**SQL P xem chi tiết tiến độ:**

```sql
DECLARE @CourseId int = 0; -- thay courseId

SELECT p.Id, p.EnrollmentId, e.StudentId, u.Email,
       p.LessonId, l.Title, l.CourseId,
       p.IsCompleted, p.CompletedAt
FROM dbo.LessonProgresses AS p
JOIN dbo.Enrollments AS e ON e.Id = p.EnrollmentId
JOIN dbo.Users AS u ON u.Id = e.StudentId
JOIN dbo.Lessons AS l ON l.Id = p.LessonId
WHERE e.CourseId = @CourseId AND l.CourseId = e.CourseId
ORDER BY e.StudentId, l.OrderIndex, p.Id;
```

**SQL PT tính lại số hoàn thành và phần trăm để so API:**

```sql
DECLARE @CourseId int = 0; -- thay courseId

SELECT e.Id AS EnrollmentId, e.StudentId, u.Email,
       totals.TotalLessons, done.CompletedLessons,
       CASE WHEN totals.TotalLessons = 0 THEN CAST(0 AS decimal(10,2))
            ELSE CAST(ROUND(100.0 * done.CompletedLessons /
                            totals.TotalLessons, 2) AS decimal(10,2))
       END AS Percentage
FROM dbo.Enrollments AS e
JOIN dbo.Users AS u ON u.Id = e.StudentId
CROSS APPLY (
    SELECT COUNT(*) AS TotalLessons
    FROM dbo.Lessons AS l WHERE l.CourseId = e.CourseId
) AS totals
CROSS APPLY (
    SELECT COUNT(*) AS CompletedLessons
    FROM dbo.LessonProgresses AS p
    JOIN dbo.Lessons AS l ON l.Id = p.LessonId
    WHERE p.EnrollmentId = e.Id AND p.IsCompleted = 1
      AND l.CourseId = e.CourseId
) AS done
WHERE e.CourseId = @CourseId
ORDER BY e.StudentId;
```

DateTime ở backend được chuẩn hóa UTC theo cấu hình model. Khi so với giờ giao diện đã chuyển múi giờ, không yêu cầu hai chuỗi giờ phải giống nguyên văn.

### E04 Admin bị chặn các thao tác dành riêng cho người học

Gửi các request dưới đây bằng adminToken còn hợp lệ:

| Request | Mong đợi | Kiểm tra data |
| --- | --- | --- |
| POST /api/enrollments với courseId hợp lệ | 403 | Không tạo Enrollment cho Admin |
| DELETE /api/enrollments/{{courseId}} | 403 | Enrollment của User giữ nguyên |
| POST /api/progress/lessons/{{lessonId}}/complete | 403 | Không tạo/sửa progress thay User |
| DELETE /api/progress/lessons/{{lessonId}}/complete | 403 | Progress User giữ nguyên |
| GET /api/enrollments/my; GET /api/progress/my; GET /api/progress/courses/{{courseId}} | 403 | Đây là route Learning của User, không phải báo cáo Admin |

Chạy SQL E/P trước và sau để xác nhận dữ liệu không thay đổi. Admin được xem báo cáo học viên bằng endpoint `/students`, không dùng token Admin như token sinh viên.

### E05 Kiểm tra hủy ghi danh xóa tiến độ liên quan

Dùng courseBId và moveLessonId đã chuyển sang khóa B để kiểm tra độc lập: User ghi danh khóa B, hoàn thành moveLessonId, sau đó User DELETE `/api/enrollments/{{courseBId}}`. Mong đợi 200; Enrollment của User ở B và LessonProgresses thuộc enrollment đó không còn, trong khi các bài và khóa B vẫn tồn tại. Admin dùng các endpoint báo cáo và SQL E/P với courseBId để xác nhận. Ca này tạo một enrollment và progress riêng, tránh nhầm với ca Admin xóa Lesson ở phần 11.

## 10 Ma trận ca lỗi và ràng buộc cần hoàn tất

| Mã | Tình huống | HTTP mong đợi | Dữ liệu cần giữ nguyên |
| --- | --- | --- | --- |
| N01 | POST/PUT/DELETE quản trị không token | 401 | Không thêm/sửa/xóa bản ghi |
| N02 | User POST category/course/lesson hoặc DELETE file | 403 | Catalog và metadata file không đổi |
| N03 | Staff/Instructor POST hoặc DELETE tài khoản, đổi role, phân công | 403 | Users và phân công khóa không đổi |
| N04 | Staff reset password của Staff/Instructor/Admin | 403 | PasswordHash và SecurityStamp mục tiêu không đổi; có thể đối chiếu fingerprint |
| N05 | Instructor sửa/xóa khóa, bài hoặc file ngoài phân công | 403 | Khóa/bài/file giữ nguyên |
| N06 | Tạo trùng email, tên category, thứ tự bài trong cùng khóa | 409 | Không xuất hiện dòng trùng |
| N07 | DELETE category đang có course | 409 | Category và Course vẫn tồn tại |
| N08 | DELETE course đang có lesson/enrollment/file | 409 | Toàn bộ dữ liệu con còn nguyên |
| N09 | DELETE lesson đang có UploadedFile | 409 | Lesson và file còn nguyên |
| N10 | DELETE User có Enrollment; DELETE người được Course hoặc UploadedFile tham chiếu | 409 | Tài khoản và dữ liệu tham chiếu giữ nguyên |
| N11 | Đổi vai trò Staff/Instructor đang được phân công | 409 | Role và FK giữ nguyên |
| N12 | Chuyển lesson có progress hoặc file sang course khác | 409 | CourseId nguồn và dữ liệu con không đổi |
| N13 | Token tài khoản vừa bị đổi role/reset/xóa | 401 | Không tiếp tục thao tác bằng quyền cũ |
| N14 | ID dương không tồn tại cho thao tác chi tiết/sửa/xóa | 404 ở các route tài nguyên tương ứng | Không cập nhật nhầm bản ghi khác |

Với N14, chọn ID đã kiểm tra không tồn tại, ví dụ 2147483647; các endpoint nhận ID liên quan trong body có thể trả 400 thay vì 404. Không bắt mọi loại “ID không có” phải cùng một mã HTTP.

## 11 Thử xóa thành công và dọn fixture theo thứ tự

Không xóa dữ liệu SQL trực tiếp để bỏ qua một lỗi API. Thứ tự dưới đây giúp kiểm tra ràng buộc đúng và dọn các tài nguyên được tạo bởi lần test.

1. Ghi lại courseId, courseBId, lessonId, moveLessonId, imageId, documentId và toàn bộ tài khoản test trước khi xóa. ID cần được giữ ngay cả khi tài nguyên đã không còn trong API danh sách.
2. Khi còn ghi danh/progress, dùng **userToken** gọi DELETE `/api/progress/lessons/{{lessonId}}/complete`: 200; SQL P cho thấy IsCompleted = 0 và CompletedAt NULL. Dùng User POST complete lại nếu cần kiểm thử ca xóa bài có progress.
3. Dùng **adminToken** thử xóa bài đang có PDF: 409. Xóa PDF qua DELETE `/api/files/{{documentId}}`: 200; chạy SQL F và kiểm tra file đĩa không còn.
4. Dùng Admin xóa lessonId: 200; câu SQL theo ID bài và LessonProgresses trả 0 dòng cho bài đó. Bước này kiểm tra service dọn progress của bài trước khi xóa.
5. Xóa các bài còn lại của hai khóa bằng Admin, gồm moveLessonId ở khóa đích hiện tại. Nếu còn file khác thì xóa file trước.
6. Dùng Admin thử DELETE courseId khi vẫn còn Enrollment: 409; SQL E còn ghi danh.
7. Dùng **userToken** DELETE `/api/enrollments/{{courseId}}`: 200. SQL E không còn Enrollment tương ứng; các LessonProgresses thuộc enrollment bị xóa theo cascade.
8. Xóa imageId và các UploadedFiles còn lại của khóa bằng API Admin. Kiểm tra storage và SQL F.
9. Xóa Course A và Course B bằng Admin: 200; GET từng ID → 404.
10. Xóa Category A/B sau khi không còn khóa: 204; GET từng ID → 404.
11. Đảm bảo các tài khoản thử nghiệm không còn khóa phân công, Enrollment hoặc UploadedFile tham chiếu. Nếu cần giữ khóa thử thì bỏ InstructorId/StaffId bằng API trước khi xóa người được phân công.
12. Dùng Admin gốc DELETE lần lượt các tài khoản test còn lại. Không xóa adminId gốc. GET ID đã xóa → 404.
13. Kiểm tra prefix lần test không còn sót dữ liệu; dữ liệu có sẵn trước lần test vẫn được giữ.

**SQL D xác nhận xóa bằng ID đã lưu:** điền các ID thực tế; tài nguyên không tham gia một ca có thể bỏ dòng tương ứng.

```sql
DECLARE @UserId int = 0, @StaffId int = 0, @InstructorId int = 0;
DECLARE @TempUserId int = 0, @TempAdminId int = 0;
DECLARE @CategoryId int = 0, @CategoryBId int = 0;
DECLARE @CourseId int = 0, @CourseBId int = 0;
DECLARE @LessonId int = 0, @MoveLessonId int = 0;
DECLARE @ImageId int = 0, @DocumentId int = 0;

SELECT N'Users' AS Resource, COUNT_BIG(*) AS Remaining
FROM dbo.Users
WHERE Id IN (@UserId, @StaffId, @InstructorId, @TempUserId, @TempAdminId)
UNION ALL
SELECT N'Categories', COUNT_BIG(*) FROM dbo.Categories
WHERE Id IN (@CategoryId, @CategoryBId)
UNION ALL
SELECT N'Courses', COUNT_BIG(*) FROM dbo.Courses
WHERE Id IN (@CourseId, @CourseBId)
UNION ALL
SELECT N'Lessons', COUNT_BIG(*) FROM dbo.Lessons
WHERE Id IN (@LessonId, @MoveLessonId)
UNION ALL
SELECT N'UploadedFiles', COUNT_BIG(*) FROM dbo.UploadedFiles
WHERE Id IN (@ImageId, @DocumentId)
   OR CourseId IN (@CourseId, @CourseBId)
UNION ALL
SELECT N'Enrollments', COUNT_BIG(*) FROM dbo.Enrollments
WHERE CourseId IN (@CourseId, @CourseBId) OR StudentId = @UserId
UNION ALL
SELECT N'LessonProgresses', COUNT_BIG(*) FROM dbo.LessonProgresses
WHERE LessonId IN (@LessonId, @MoveLessonId);
```

Khi đã dọn hết fixture và điền đúng ID, các dòng Remaining bằng 0. Chỉ dùng tổng COUNT cả database để quan sát bổ sung: số toàn hệ thống có thể đổi nếu một người khác đang thao tác cùng lúc.

## 12 Bộ câu lệnh hiển thị dữ liệu sau thao tác Admin

### 12.1 Mở nhiều bảng cùng lúc trong SSMS

Chạy block này trước và sau mỗi thao tác cần trình diễn. Lọc theo prefix của lần test, không lấy toàn bộ PasswordHash/SecurityStamp của tài khoản thật.

```sql
DECLARE @Prefix nvarchar(100) = N'admtest20261123a';

SELECT Id, FullName, Email, Role, CreatedAt
FROM dbo.Users
WHERE Email LIKE @Prefix + N'.%'
ORDER BY Id;

SELECT Id, Name, Description
FROM dbo.Categories
WHERE Name LIKE @Prefix + N'%'
ORDER BY Id;

SELECT Id, Title, Description, Price, CategoryId,
       InstructorId, StaffId, CreatedAt
FROM dbo.Courses
WHERE Title LIKE @Prefix + N'%'
ORDER BY Id;

SELECT l.Id, l.Title, l.Content, l.VideoUrl,
       l.DurationMinutes, l.OrderIndex, l.CourseId, l.CreatedAt
FROM dbo.Lessons AS l
WHERE l.Title LIKE @Prefix + N'%'
ORDER BY l.CourseId, l.OrderIndex, l.Id;

SELECT f.Id, f.OriginalName, f.StoredName, f.FileType,
       f.ContentType, f.Size, f.CourseId, f.LessonId,
       f.UploadedById, f.UploadedAt
FROM dbo.UploadedFiles AS f
JOIN dbo.Courses AS c ON c.Id = f.CourseId
WHERE c.Title LIKE @Prefix + N'%'
ORDER BY f.Id;

SELECT e.Id, e.StudentId, u.Email, e.CourseId,
       c.Title AS CourseTitle, e.EnrolledAt
FROM dbo.Enrollments AS e
JOIN dbo.Users AS u ON u.Id = e.StudentId
JOIN dbo.Courses AS c ON c.Id = e.CourseId
WHERE c.Title LIKE @Prefix + N'%'
ORDER BY e.Id;

SELECT p.Id, p.EnrollmentId, e.StudentId, p.LessonId,
       l.Title AS LessonTitle, p.IsCompleted, p.CompletedAt
FROM dbo.LessonProgresses AS p
JOIN dbo.Enrollments AS e ON e.Id = p.EnrollmentId
JOIN dbo.Courses AS c ON c.Id = e.CourseId
JOIN dbo.Lessons AS l ON l.Id = p.LessonId
WHERE c.Title LIKE @Prefix + N'%'
ORDER BY p.Id;
```

Sau DELETE, dùng thêm SQL D với ID đã lưu. Không chỉ JOIN qua bảng cha đã xóa để kết luận mọi dữ liệu liên quan đã được dọn.

### 12.2 Xem số bản ghi từng bảng

```sql
SELECT N'Users' AS TableName, COUNT_BIG(*) AS Total FROM dbo.Users
UNION ALL SELECT N'Categories', COUNT_BIG(*) FROM dbo.Categories
UNION ALL SELECT N'Courses', COUNT_BIG(*) FROM dbo.Courses
UNION ALL SELECT N'Lessons', COUNT_BIG(*) FROM dbo.Lessons
UNION ALL SELECT N'UploadedFiles', COUNT_BIG(*) FROM dbo.UploadedFiles
UNION ALL SELECT N'Enrollments', COUNT_BIG(*) FROM dbo.Enrollments
UNION ALL SELECT N'LessonProgresses', COUNT_BIG(*) FROM dbo.LessonProgresses;
```

### 12.3 Hiển thị dữ liệu bằng terminal

Nếu máy có sqlcmd, ví dụ với Windows Authentication, server `.\SQLEXPRESS` và database `OnlineCourseDB`:

```powershell
sqlcmd -S '.\SQLEXPRESS' -d 'OnlineCourseDB' -E -C -Q "SELECT DB_NAME() AS DatabaseName; SELECT Id, FullName, Email, Role FROM dbo.Users ORDER BY Id;"

sqlcmd -S '.\SQLEXPRESS' -d 'OnlineCourseDB' -E -C -Q "SELECT Id, Title, Price, CategoryId, InstructorId, StaffId FROM dbo.Courses ORDER BY Id;"
```

Thay server/database theo môi trường. Để xem dấu tiếng Việt ổn định, ưu tiên SSMS hoặc xuất file Unicode bằng `-u -o`. Không đưa mật khẩu SQL thật vào tài liệu hoặc dòng lệnh chia sẻ.

### 12.4 Kiểm thử có sẵn của dự án

Các lệnh sau là lựa chọn chạy thêm, không phải thao tác bắt buộc để đọc dữ liệu:

```powershell
# Kiểm thử frontend và dữ liệu mẫu, không gọi CRUD trực tiếp vào SQL đang chạy.
npm.cmd test

# Unit test backend.
npm.cmd run test:backend

# Tích hợp CRUD qua API và đối chiếu SQL Server đang cấu hình cho bộ test.
npm.cmd run test:crud

# Các luồng quyền và thay đổi vai trò.
npm.cmd run test:authorization
npm.cmd run test:roles
```

Các bài tích hợp cần API, SQL Server, sqlcmd và cấu hình tài khoản phù hợp. Bộ test có quy trình tạo/dọn dữ liệu riêng; kiểm tra hướng dẫn trong backend/tests trước khi chạy. Không coi bộ test CRUD có sẵn là bằng chứng mọi ca thủ công trong tài liệu đã được thực hiện.

## 13 Mẫu ghi kết quả và checklist nghiệm thu

| Mã ca | Request hoặc click | HTTP mong đợi | HTTP thực tế | SQL trước và sau | Pass hoặc Fail | Ghi chú |
| --- | --- | --- | --- | --- | --- | --- |
| C01 | Thêm danh mục | 201 | Điền sau khi chạy | SQL CA | Chưa chạy | Ghi categoryId |
| K02 | Sửa khóa | 200 | Điền sau khi chạy | SQL C | Chưa chạy | Giá decimal và CategoryId |
| F02 | Upload PDF | 201 | Điền sau khi chạy | SQL F + storage | Chưa chạy | Ghi documentId |
| U06 | Đổi role | 200, token cũ 401 | Điền sau khi chạy | SQL U | Chưa chạy | StampFingerprint đổi |

Hoàn tất các nhóm trước khi kết luận quyền Admin đã được kiểm tra:

- Đăng nhập, xác thực quyền, thiếu/sai token và giao diện quyền.
- Tạo tài khoản đủ bốn vai trò, đọc/tìm/lọc/phân trang, đổi role, reset và xóa.
- Bảo vệ chính Admin, token cũ, tài khoản có quan hệ và vai trò đang được phân công.
- Thêm/sửa/xóa danh mục, khóa học và bài học với dữ liệu SQL đúng trước/sau.
- Gán/bỏ Instructor và Staff độc lập; dữ liệu sai vai trò không được lưu.
- Upload/liệt kê/download/xóa ảnh và PDF; đối chiếu metadata lẫn file vật lý.
- Admin xem ghi danh/tiến độ; các thao tác học tập riêng của User bị chặn đối với Admin.
- Kiểm tra dữ liệu tiếng Việt, giá decimal, thứ tự bài duy nhất và các mã lỗi ràng buộc.
- Dọn toàn bộ fixture theo đúng ID; giữ nguyên dữ liệu có sẵn và Admin gốc.

**Căn cứ API và schema:** Controllers, DTOs, Services và Models dưới `backend/OnlineCourseManagement.Api`, cấu hình quan hệ trong `Data/AppDbContext.cs`, ma trận `docs/permissions.md`. Việc kiểm tra trong tài liệu theo API hiện có; không tạo thêm endpoint CRUD chưa được triển khai.
