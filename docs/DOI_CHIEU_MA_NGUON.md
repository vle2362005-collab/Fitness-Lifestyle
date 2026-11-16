# Đối chiếu mã nguồn DACS và bản chuyên ngành

| Thành phần cũ trong RAR | Nâng cấp |
|---|---|
| `FitnessLifestyle_API/FitnessLifestyle.API` | Thư mục `backend`: giữ mô hình tài khoản, hồ sơ, tập luyện, dinh dưỡng và migrations. Thêm `PoseCoachController`, `CoachSessions`, `PoseReplay`, bảng cộng đồng và migration bài tập tại nhà. |
| `FitnessLifestyle_Web_Frontend` | Thư mục `web`: giữ giao diện chính, Next.js, Dashboard, hồ sơ, dinh dưỡng và quản trị. Nâng AI Coach sang C# và thêm `/community`. |
| `Frontend_AppMobile` | Thư mục `mobile`: thay React Native bằng Flutter/Dart. Camera Android, thư viện bài tập, lịch sử, sức khỏe, dinh dưỡng và cộng đồng cùng dùng API cũ/mới. |
| `poseAnalyzer.ts` và logic rep cũ | Giữ mã tham chiếu Web trong `web/lib/poseAnalyzer.ts`. Tính điểm cho phiên mới ở `backend/Services/PoseCoach/PoseReplay.cs`. |

## Luồng để trình bày với giảng viên

1. **Nhận diện điểm khớp:** Web gọi MoveNet trong `web/app/(user)/trueformcoach/page.tsx`. Flutter chuyển NV21/YUV sang đầu vào ML Kit trong `mobile/lib/live_coach.dart`. Hai mô hình khác nhau nhưng gửi cùng tên khớp, tọa độ chuẩn hóa, kích thước ảnh, độ tin cậy, thứ tự và thời điểm.
2. **Chuẩn hóa và làm mượt:** C# đổi X/Y về tọa độ pixel trước khi lấy góc bằng tích vô hướng. Lọc độ tin cậy, không trộn khớp trái/phải trong cùng pha. EMA dùng trọng số theo khoảng thời gian giữa mẫu để hạn chế rung và giảm ảnh hưởng của tốc độ lấy mẫu khác nhau.
3. **Đếm rep:** FSM đợi duỗi → hạ → đủ biên độ → duỗi ổn định. Hai ngưỡng và thời gian giữ hạn chế đếm lặp. Tách rep hoàn tất, rep đạt luật form, lượt nửa chừng và mẫu mất dấu. Mất dấu quá lâu hủy chu kỳ dở.
4. **Kết quả và chia sẻ:** API tự tính và lưu `WorkoutSession` + `WorkoutAnalysis` trong một lần ghi. Cộng đồng kiểm tra quyền sở hữu kết quả rồi chỉ sao chép tóm tắt để chia sẻ. Ảnh camera không đi qua API của Coach.
5. **Kiểm chứng:** so mã cũ và mới trên cùng chuỗi khớp; sau đó kiểm thử riêng mô hình trên camera thật. Không dùng tỷ lệ rep đạt luật làm độ chính xác thực nghiệm.

Hợp đồng: `POST /api/pose-coach/sessions`, `POST /sessions/{id}/frames`, `POST /sessions/{id}/finish`, `DELETE /sessions/{id}` dưới cùng tiền tố `/api/pose-coach`. Mỗi lô tối đa 16 mẫu; gửi lặp số thứ tự đã nhận không cộng rep. Phiên đang chạy giữ trong bộ nhớ, hết hạn nếu không sử dụng và không phục hồi sau khi API khởi động lại; lịch sử đã lưu nằm trong SQL Server.

Tài liệu tham chiếu: [TensorFlow MoveNet](https://www.tensorflow.org/hub/tutorials/movenet), [Google ML Kit Pose Detection](https://developers.google.com/ml-kit/vision/pose-detection), [góc khớp và đếm động tác](https://developers.google.com/ml-kit/vision/pose-detection/classifying-poses), [Flutter camera](https://pub.dev/packages/camera).
