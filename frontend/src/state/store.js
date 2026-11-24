import { request, getToken } from "../api/client.js";
import { canCreateCourse, canManageCourse, canManageCatalog } from "../auth/permissions.js";

export const state = {
  user: null,
  courses: [],
  categories: [],
  lessons: [],
  enrollments: [],
  progress: [],
  userCounts: {},
  ready: false,
  roleError: null,
  courseDetail: null,
  lessonDetail: null,
  students: null,
  users: null,
};

// Navigation state is shared so outdated requests cannot replace the current page.
export const view = {
  renderVersion: 0,
  pendingRoute: null,
  pendingTabFocus: null,
  displayedPurchase: null,
};

export const is = (role) => state.user?.role === role;
export const canCreate = () => canCreateCourse(state.user);
export const canManage = (course) => canManageCourse(state.user, course);
export const enrolled = (courseId) =>
  is("User") && state.enrollments.some((item) => item.courseId === courseId);
export const lessonsFor = (id) => state.lessons.filter((item) => item.courseId === id);
export const progressFor = (id) => state.progress.find((item) => item.courseId === id);
export const categoryName = (course) =>
  course.categoryName ||
  state.categories.find((item) => item.id === course.categoryId)?.name ||
  "Chưa phân loại";

let loadingPromise = null;

export async function loadData() {
  if (loadingPromise) {
    await loadingPromise;
    // A sign-in or sign-out may have occurred while the previous request ran.
    if (state.ready) return;
    return loadData();
  }
  const tokenAtStart = getToken();
  loadingPromise = (async () => {
    const [courses, categories, lessons, profile] = await Promise.all([
      request("/courses"),
      request("/categories"),
      request("/lessons"),
      state.user && tokenAtStart
        ? request("/auth/me").catch((error) => {
            if (error.status === 401) return null;
            throw error;
          })
        : Promise.resolve(null),
    ]);
    state.courses = courses;
    state.categories = categories;
    state.lessons = lessons;
    state.enrollments = [];
    state.progress = [];
    state.userCounts = {};
    state.roleError = null;
    if (profile && getToken() === tokenAtStart) state.user = profile;
    if (state.user && getToken() === tokenAtStart) {
      try {
        if (is("User"))
          [state.enrollments, state.progress] = await Promise.all([
            request("/enrollments/my"),
            request("/progress/my"),
          ]);
        if (canManageCatalog(state.user)) {
          const [enrollments, students] = await Promise.all([
            request("/enrollments"),
            request("/users?Role=User&PageSize=1"),
          ]);
          state.enrollments = enrollments;
          state.userCounts = { students: students.totalCount };
          if (is("Admin")) {
            const [staff, instructors, admins] = await Promise.all([
              request("/users?Role=Staff&PageSize=1"),
              request("/users?Role=Instructor&PageSize=1"),
              request("/users?Role=Admin&PageSize=1"),
            ]);
            state.userCounts.staff = staff.totalCount;
            state.userCounts.instructors = instructors.totalCount;
            state.userCounts.admins = admins.totalCount;
          }
        }
      } catch (error) {
        state.roleError = error.message;
      }
    }
    if (getToken() !== tokenAtStart) {
      state.enrollments = [];
      state.progress = [];
      state.userCounts = {};
    }
    state.ready = getToken() === tokenAtStart;
  })().finally(() => {
    loadingPromise = null;
  });
  await loadingPromise;
  if (!state.ready) return loadData();
}
