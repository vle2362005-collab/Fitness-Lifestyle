import Link from "next/link";
import { Activity, ArrowRight, Brain, Camera, Utensils } from "lucide-react";

const features = [
  {
    icon: <Activity size={24} />,
    title: "Theo dõi thông minh",
    text: "Dashboard và Tiến độ gom dữ liệu tập luyện theo ngày, theo rep hợp lệ và mức cải thiện form."
  },
  {
    icon: <Camera size={24} />,
    title: "AI Coach chuẩn form",
    text: "MoveNet chỉ tính rep khi tư thế đủ điều kiện: đúng góc, đúng trục thân người và đúng nhịp bài tập."
  },
  {
    icon: <Brain size={24} />,
    title: "Phân tích dễ hiểu",
    text: "Xem rõ calories, thời lượng, sets, lỗi form và gợi ý cần sửa để tiến bộ an toàn hơn."
  },
  {
    icon: <Utensils size={24} />,
    title: "Dinh dưỡng theo mục tiêu",
    text: "Hệ thống kết hợp BMI, BMR, TDEE với khẩu phần ăn hằng ngày để hỗ trợ giảm cân, duy trì hoặc tăng cơ."
  }
];

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <div className="container hero-shell">
          <div className="hero-copy">
            <span className="hero-tag">AI FITNESS COACH · DINH DƯỠNG · THEO DÕI TIẾN ĐỘ</span>
            <h1>
              Luyện tập đúng form.<br />
              <span className="hero-accent">Ăn uống đúng mục tiêu.</span><br />
              Cải thiện vóc dáng bền vững.
            </h1>
            <p>
              FitnessLifestyle giúp bạn tập đúng tư thế với AI Coach, theo dõi tiến độ dễ hiểu và xây dựng chế độ ăn phù hợp để nâng tầm vóc dáng từng ngày.
            </p>
            <div className="hero-actions">
              <Link href="/login" className="btn">Bắt đầu ngay <ArrowRight size={16} /></Link>
              <Link href="/register" className="btn secondary">Tạo tài khoản</Link>
            </div>
            <div className="hero-chip-row">
              <span>MoveNet nhận diện 17 keypoints</span>
              <span>Rep chỉ được tính khi form hợp lệ</span>
              <span>Dinh dưỡng cá nhân hóa theo hồ sơ</span>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-panel">
              <h2 className="hero-panel-title">Một hệ thống đủ gọn để theo dõi, đủ thông minh để cải thiện.</h2>
              <p className="hero-panel-subtitle">
                Từ AI Coach, khẩu phần ăn đến các chỉ số như calories, reps, sets và độ chính xác — mọi thứ được hiển thị rõ ràng để người mới cũng hiểu ngay.
              </p>
              <div className="hero-panel-row">
                <div className="hero-metric">
                  <strong>12 reps</strong>
                  <span>mới tính 1 set</span>
                </div>
                <div className="hero-metric">
                  <strong>85%+</strong>
                  <span>mục tiêu form ổn định</span>
                </div>
                <div className="hero-metric">
                  <strong>TDEE</strong>
                  <span>tự động tính từ hồ sơ</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="page">
        <div className="container">
          <div className="between" style={{ marginBottom: 20 }}>
            <div>
              <h2 className="page-title" style={{ fontSize: "clamp(28px, 3vw, 42px)" }}>Những gì hệ thống tập trung nhất</h2>
              <p className="page-subtitle">Không rườm rà tính năng phụ. Trọng tâm là tập đúng, theo dõi rõ và ăn uống hợp lý.</p>
            </div>
          </div>
          <div className="grid feature-grid">
            {features.map((item) => (
              <div className="card col-3 feature-card" key={item.title}>
                <div className="feature-icon">{item.icon}</div>
                <h3>{item.title}</h3>
                <p className="muted">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
