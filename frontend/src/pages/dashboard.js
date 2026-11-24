import { escapeHtml as esc } from "../api/client.js";
import { icon } from "../components/icons.js";
import { button, linkButton, empty, courseCard, progressBar, statCard } from "../components/ui.js";
import { count, date } from "../utils/format.js";
import { state, is, canCreate, canManage, enrolled } from "../state/store.js";
import { renderWorkspaceDashboard } from "../features/workspaces.js";

function activityChart() {
  const now = new Date(),
    months = Array.from(
      { length: 6 },
      (_, index) => new Date(now.getFullYear(), now.getMonth() - 5 + index, 1),
    );
  const data = is("Admin") ? state.enrollments : state.courses;
  const values = months.map(
    (month) =>
      data.filter((item) => {
        const d = new Date(item.enrolledAt || item.createdAt);
        return (
          d.getMonth() === month.getMonth() &&
          d.getFullYear() === month.getFullYear()
        );
      }).length,
  );
  const max = Math.max(...values, 1);
  return `<section class="side-panel"><h2>${is("Admin") ? "Hoạt động ghi danh" : "Thư viện đang phát triển"}</h2><p>Trong 6 tháng gần đây</p><div class="chart-bars" role="img" aria-label="${esc(months.map((month, index) => `Tháng ${month.getMonth() + 1}: ${values[index]}`).join("; "))}">${values.map((value) => `<div class="chart-column"><b>${count(value)}</b><div class="chart-bar" style="height:${Math.max(3, (value / max) * 86)}px"></div></div>`).join("")}</div><div class="chart-months">${months.map((month) => `<span>Th.${month.getMonth() + 1}</span>`).join("")}</div><div class="chart-legend"><i></i>${is("Admin") ? "Lượt đăng ký khóa học" : "Khóa học mới"}</div></section>`;
}

export function dashboard() {
  let stats,
    featured = state.courses.slice(0, 4),
    sectionTitle = "Khóa học dành cho bạn";
  if (is("Admin")) {
    stats = [
      [
        "Tổng khóa học",
        count(state.courses.length),
        "book",
        "Trong thư viện của bạn",
      ],
      [
        "Sinh viên",
        count(state.userCounts.students),
        "users",
        "Tài khoản sinh viên",
      ],
      [
        "Nhân viên",
        count(state.userCounts.staff),
        "user",
        "Đồng hành cùng sinh viên",
      ],
      [
        "Giảng viên",
        count(state.userCounts.instructors),
        "graduation",
        "Tài khoản giảng viên",
      ],
      [
        "Lượt ghi danh",
        count(state.enrollments.length),
        "chart",
        "Trên toàn hệ thống",
      ],
    ];
    sectionTitle = "Khóa học mới nhất";
  } else if (is("Staff")) {
    const own = state.courses.filter(
        (course) => course.staffId === state.user.id,
      ),
      ownLessons = state.lessons.filter((item) =>
        own.some((course) => course.id === item.courseId),
      );
    stats = [
      [
        "Khóa học phụ trách",
        count(own.length),
        "book",
        "Nội dung do bạn quản lý",
      ],
      [
        "Bài học",
        count(ownLessons.length),
        "layers",
        "Đã sẵn sàng cho sinh viên",
      ],
      [
        "Thời lượng",
        `${count(ownLessons.reduce((sum, item) => sum + item.durationMinutes, 0))} phút`,
        "clock",
        "Tổng thời lượng bài học",
      ],
      [
        "Danh mục phụ trách",
        count(new Set(own.map((course) => course.categoryId)).size),
        "compass",
        "Lĩnh vực của bạn",
      ],
    ];
    featured = (own.length ? own : state.courses).slice(0, 4);
    sectionTitle = own.length ? "Khóa học bạn phụ trách" : "Khóa học mới nhất";
  } else if (is("Instructor")) {
    const own = state.courses.filter((course) => canManage(course));
    const ownLessons = state.lessons.filter((lesson) => own.some((course) => course.id === lesson.courseId));
    stats = [
      ["Khóa đang giảng dạy", count(own.length), "book", "Được phân công cho bạn"],
      ["Bài học", count(ownLessons.length), "layers", "Nội dung trong khóa của bạn"],
      ["Thời lượng", `${count(ownLessons.reduce((sum, item) => sum + item.durationMinutes, 0))} phút`, "clock", "Tổng thời lượng bài học"],
      ["Lĩnh vực giảng dạy", count(new Set(own.map((course) => course.categoryId)).size), "compass", "Kiến thức bạn chia sẻ"],
    ];
    featured = own.slice(0, 4);
    sectionTitle = "Khóa học bạn giảng dạy";
  } else if (is("User")) {
    const total = state.progress.reduce(
        (sum, item) => sum + item.totalLessons,
        0,
      ),
      completed = state.progress.reduce(
        (sum, item) => sum + item.completedLessons,
        0,
      );
    stats = [
      [
        "Khóa học đã đăng ký",
        count(state.enrollments.length),
        "book",
        "Trong hành trình học tập",
      ],
      [
        "Bài học hoàn thành",
        count(completed),
        "check",
        `Trong tổng ${count(total)} bài học`,
      ],
      [
        "Khóa học hoàn thành",
        count(
          state.progress.filter(
            (item) => item.totalLessons > 0 && item.percentage === 100,
          ).length,
        ),
        "target",
        "Những cột mốc đáng nhớ",
      ],
      [
        "Tiến độ tổng thể",
        `${total ? Math.round((completed / total) * 100) : 0}%`,
        "chart",
        "Tính theo bài học hoàn thành",
      ],
    ];
    if (state.enrollments.length) {
      featured = state.courses
        .filter((course) => enrolled(course.id))
        .slice(0, 4);
      sectionTitle = "Tiếp tục hành trình của bạn";
    }
  } else {
    stats = [
      ["Khóa học", count(state.courses.length), "book", "Sẵn sàng để khám phá"],
      [
        "Danh mục",
        count(state.categories.length),
        "layers",
        "Đa dạng lĩnh vực học tập",
      ],
      [
        "Bài học",
        count(state.lessons.length),
        "play",
        "Kiến thức trong từng bước nhỏ",
      ],
      [
        "Khóa học miễn phí",
        count(state.courses.filter((item) => Number(item.price) === 0).length),
        "spark",
        "Bắt đầu theo cách của bạn",
      ],
    ];
  }
  const categoryRows = state.categories.slice(0, 4).map(item => `<a class="category-row" href="#/courses?category=${item.id}"><span class="category-icon">${icon("layers")}</span><span><span class="category-name">${esc(item.name)}</span><small>${count(state.courses.filter(course => course.categoryId === item.id).length)} khóa học</small></span><span class="category-number">${icon("next")}</span></a>`).join("");
  const featuredMarkup = featured.length ? featured.map(course => courseCard(course, is("User"))).join("") : empty("Một hành trình đang chờ bắt đầu", canCreate() ? "Tạo khóa học đầu tiên và chia sẻ kiến thức của bạn." : "Khám phá thư viện và chọn điều bạn muốn học.", canCreate() ? button("Tạo khóa học đầu tiên", "create-course") : linkButton("Khám phá khóa học", "#/courses", "primary"));
  return renderWorkspaceDashboard(state, {
    statsMarkup: stats.map(item => statCard(...item)).join(""),
    featuredMarkup, sectionTitle, categoryMarkup: categoryRows,
    chartMarkup: activityChart(), progressBar, date,
  });
}
