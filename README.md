# Fitness & Lifestyle — Đồ án chuyên ngành

Bản Web Next.js và API ASP.NET Core .NET 8 phát triển trực tiếp từ `DACS.rar`. App Android viết lại bằng Flutter/Dart. Cả hai dùng chung tài khoản, danh mục bài tập, hồ sơ, dinh dưỡng, lịch sử và cộng đồng trên SQL Server.

- **AI Coach:** camera Web dùng MoveNet; Android dùng ML Kit. Hai ứng dụng gửi điểm khớp, C# tính góc, lọc EMA, đếm rep và đánh giá tư thế. Có Squat, Push-up, dữ liệu phát lại và phân tích clip cục bộ trên Web.
- **Tập tại nhà:** thư viện lưng, ngực, tay, vai, chân và bụng. Bài ngoài phạm vi camera có thể ghi buổi thủ công.
- **Cộng đồng:** bài viết, lượt thích, bình luận, góp ý chỉnh sửa, đính kèm tóm tắt buổi tập của chính mình. Tác giả xem và lưu bản nháp góp ý.
- **Theo dõi:** Dashboard và tiến độ trên Web, lịch sử trên Android, hồ sơ và nhật ký dinh dưỡng dùng chung API. Quản trị qua Web.

## 1. Chuẩn bị

Giải nén vào thư mục ngắn, ví dụ `C:\FitnessDACN`. Mở PowerShell ở thư mục có `README.md`.

- Cài .NET **8 SDK**, Node.js/npm, SQL Server và quyền tạo/cập nhật database.
- Với Android: Flutter SDK, Android SDK/Studio và một emulator hoặc điện thoại thật. Kiểm tra `flutter doctor -v` và `flutter devices`.
- Lần cài đầu cần Internet để restore thư viện .NET, npm, Flutter và Gradle. Web cần tải được mô hình MoveNet khi mở camera hoặc phân tích video lần đầu.
- Gói không chứa SQL backup, mật khẩu cũ, video tập riêng, `node_modules` hay thư mục build. Dữ liệu mẫu bài tập/món ăn được tạo bởi migration và seed.

## 2. Chạy API và tạo cơ sở dữ liệu

**PowerShell 1:**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Start-Api.ps1 -SqlServer '.\SQLEXPRESS' -Migrate
```

Nếu dùng Visual Studio, có thể mở `FitnessLifestyle.sln` để đọc và debug API.

Thay `.\SQLEXPRESS` bằng **Server name** dùng khi kết nối SSMS, ví dụ `localhost` cho instance mặc định. Script dùng Windows Authentication, tạo DB riêng **FitnessLifestyle_DACN** và lưu khóa JWT phát triển tại `.local/jwt-key.txt`. DB đồ án cơ sở không được chọn mặc định. Mức tương thích truy vấn mặc định là 120 để hướng tới SQL Server 2014.

Mở [health](http://127.0.0.1:5088/health) và [ready](http://127.0.0.1:5088/ready). `health` xác nhận tiến trình API đang mở; `ready` xác nhận API truy cập được bảng cộng đồng. Lần chạy sau có thể bỏ `-Migrate` nếu không đổi schema.

Dùng SQL Authentication thì đặt `ConnectionStrings__DefaultConnection` trong môi trường PowerShell của bạn trước khi chạy script; không ghi tài khoản/mật khẩu vào file nộp. Cần quản trị Web thì cấu hình `DefaultAdmin__Enabled=true`, `DefaultAdmin__Username`, `DefaultAdmin__Email`, `DefaultAdmin__Password` trước lần chạy để tạo tài khoản quản trị mới. Mặc định không có mật khẩu quản trị đóng sẵn.

## 3. Chạy Web

**PowerShell 2:**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Start-Web.ps1
```

Mở [http://localhost:3000](http://localhost:3000), tạo tài khoản và đăng nhập. Web yêu cầu đúng cổng 3000 theo cấu hình CORS mặc định. Script cài thư viện theo lockfile khi chưa có. Có thể thêm `-Build` để chạy kiểm tra build production rồi mở bản đã build.

## 4. Chạy Android

Bật emulator trước. **PowerShell 3:**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Start-Mobile.ps1
```

Script sinh thư mục Android bằng Flutter SDK đang cài, thêm quyền camera/Internet và cấu hình HTTP cho **debug**. Không ghi đè mã Dart. API mặc định là `http://10.0.2.2:5088`. Nếu có nhiều thiết bị, lấy ID bằng `flutter devices` và thêm `-Device ID_THIET_BI`.

**Điện thoại thật:** chạy lại API với `-Lan`, kết nối chung Wi-Fi tin cậy, dùng IPv4 của máy Windows, ví dụ:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Start-Mobile.ps1 -ApiUrl 'http://192.168.1.10:5088'
```

Thay IP ví dụ bằng IP thật. Kiểm tra `http://IP_MAY_TINH:5088/health` trên trình duyệt điện thoại trước. HTTP chỉ dành cho demo nội bộ với tài khoản thử. Web camera mở ở localhost hoặc HTTPS. Nên kiểm tra camera Android trên thiết bị thật vì emulator có thể không cung cấp nguồn hình phù hợp.

## 5. Demo và kiểm tra

1. Đăng nhập cùng một tài khoản trên Web và Android. Trên app mở **Tiến độ** để đăng nhập, **Bài tập → Squat** để mở AI Coach.
2. Chọn **Thử dữ liệu mẫu**. Ca Squat đủ biên độ dự kiến cho **2 rep hoàn tất**, không ghi lịch sử thật.
3. Mở camera, đặt máy cố định nhìn ngang thân người, tập một vài rep và **Kết thúc và lưu**. Xem lịch sử ở Web/Android. Trên Web có thể dùng clip tối đa 2 phút; video đọc tại trình duyệt và chỉ gửi điểm khớp.
4. Chia sẻ buổi tập, đăng nhập tài khoản khác để thích hoặc góp ý. Tác giả dùng góp ý làm bản nháp rồi chủ động lưu.
5. Thử thêm bữa ăn và đổi hồ sơ; hai ứng dụng đọc cùng cơ sở dữ liệu.

```powershell
dotnet run --project .\checks\CoachCore.Checks
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Test-Api.ps1
```

Chạy `Test-Api.ps1 -TestData` trên DB thử nếu muốn kiểm thử có ghi dữ liệu: tạo hai tài khoản, một buổi tập, kiểm tra lưu một lần và phân quyền bài đăng. Script xóa bài viết thử sau khi chạy; hai tài khoản và buổi tập vẫn ở DB thử. Xem [ma trận kiểm thử](docs/KIEM_THU.md) và [đối chiếu mã nguồn](docs/DOI_CHIEU_MA_NGUON.md).

## Khi gặp lỗi

| Hiện tượng | Kiểm tra |
|---|---|
| `/health` không mở | Xem cửa sổ API; kiểm tra .NET 8 SDK, cổng 5088 và cấu hình instance. |
| `/health` mở, `/ready` trả 503 | Kết nối SSMS đúng instance; kiểm tra quyền, database và chạy lại với `-Migrate`. |
| Web không gọi được API | Mở Web đúng `localhost:3000`; kiểm tra API 5088. Nếu đổi cổng API, truyền `-ApiUrl` cho Web và Android. |
| Android báo không kết nối | Emulator dùng 10.0.2.2; máy thật dùng IP LAN và API phải chạy `-Lan`. Kiểm tra firewall cổng 5088. |
| Camera không cho hình / mô hình không tải | Kiểm tra quyền camera, đóng app khác đang dùng camera, dùng Android thật hoặc Web localhost; thử ca phát lại để tách lỗi camera khỏi thuật toán. |
| Không tìm thấy bài mới | Kiểm tra đúng database và migration `AddCommunityAndHomeCatalog` đã áp dụng. |
| Flutter chưa có device | Mở emulator hoặc bật USB debugging trên máy thật, chạy `flutter doctor -v` và `flutter devices`. |

Điểm form là tỷ lệ rep đạt **luật thử nghiệm** trên ảnh 2D. Các ngưỡng vẫn cần hiệu chỉnh trên video thật có nhãn; kết quả phát lại không dùng làm bằng chứng độ chính xác ngoài thực tế.
