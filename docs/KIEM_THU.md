# Kiểm thử và nghiệm thu

## Đã kiểm tra trong môi trường bàn giao

- TypeScript của Web: kiểm tra kiểu bằng trình biên dịch TypeScript với khai báo kiểu React và TensorFlow.js lấy từ RAR. Những thư viện Web không có tại đây (Next, Lucide, Recharts) dùng khai báo rút gọn khi kiểm tra; đây không phải `next build`.
- Chạy bài thử Web client với HTTP mô phỏng: JWT, hợp đồng mở phiên, gửi mẫu lẻ/theo lô, thích/bỏ thích, sửa bài và xử lý 401.
- Đối chiếu 7 chuỗi điểm khớp tổng hợp và các đường dẫn API/schema. Kiểm tra toàn vẹn ZIP.
- Môi trường bàn giao thiếu .NET SDK, SQL Server, Flutter SDK và thiết bị camera. Chưa chạy biên dịch .NET/Flutter, migration SQL thật, `next build` hoặc nghiệm thu camera. Các kiểm tra dưới đây chạy trên máy phát triển.

## Cách chạy trên máy phát triển

| Phép thử | Lệnh hoặc thao tác | Kỳ vọng |
|---|---|---|
| C# góc, lọc, FSM | `dotnet run --project .\checks\CoachCore.Checks` | Đủ 7 ca phát lại, kiểm tra góc 45° trên ảnh 1920×1080, mẫu không hợp lệ, gửi lặp và cách ly phiên. |
| Web build + hợp đồng | Trong `web`: `npm ci`, `npm run check:contract`, `npm run build` | Hợp đồng qua; Next build không báo lỗi. |
| Flutter | Sau khởi tạo Android: `flutter analyze`, `flutter test` trong `mobile`; hoặc `Start-Mobile.ps1 -Check` | Không lỗi phân tích Dart; bộ lọc nhóm cơ và giải mã phản hồi đúng. |
| API + SQL | `Start-Api.ps1 -Migrate`; sau đó `Test-Api.ps1` | Health/ready 200, danh mục có đủ sáu nhóm. |
| Hai tài khoản | `Test-Api.ps1 -TestData` trên DB thử | B không chốt phiên hoặc chia sẻ buổi tập của A; gửi lại lô và chốt lần hai không đếm/lưu trùng; lượt thích lặp không tăng; A áp dụng được góp ý. |
| Camera Web/Android | Cấp quyền, thử cả Squat và Push-up | Tư thế đứng yên không tăng rep, một chu kỳ đủ biên độ tăng một lần; góc khớp khớp hướng ảnh, overlay không xoay/lật sai. |
| Mất dấu và quyền camera | Ra khỏi khung giữa rep; từ chối quyền camera; chuyển app ra nền | Hiện thiếu điểm/cảnh báo, không đếm nối nhầm sau mất dấu kéo dài; camera Android được giải phóng. |
| Dữ liệu dùng chung | Lưu buổi trên Android, mở lại Web; thêm bữa ăn trên Web, xem Android | Lịch sử không đếm đôi; nhật ký bữa ăn và hồ sơ đồng bộ. |
| Video và dữ liệu mẫu | Chọn clip hợp lệ/clip lỗi; chạy replay | Clip hợp lệ có thể lưu khi đủ dữ liệu; lỗi hiển thị rõ; replay không ghi lịch sử. |

Khi nghiệm thu camera, ghi thiết bị, góc quay, ánh sáng, số rep thủ công, số rep hệ thống, điểm mất dấu và độ trễ. Giữ riêng clip dùng chỉnh ngưỡng và clip dùng đánh giá. Chưa điền số liệu camera khi chưa đo.
