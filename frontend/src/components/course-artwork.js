// Match the subject before the category: an English course for developers is
// still a language course, and a SQL course can belong to several categories.
const subjects = [
  [/ti[eế]ng anh|ngo[aạ]i ng[uữ]|english|ielts|toeic/, "languages"],
  [/thuy[eế]t tr[iì]nh|presentation/, "presentation"],
  [/giao ti[eế]p|l[aà]m vi[eệ]c nh[oó]m|teamwork/, "business"],
  [/t[uự] h[oọ]c|l[oộ] tr[iì]nh c[aá] nh[aâ]n/, "study"],
  [/react/, "react"],
  [/javascript|typescript/, "javascript"],
  [/html|css|website/, "web"],
  [/python/, "python"],
  [/excel|ph[aâ]n t[ií]ch d[uữ] li[eệ]u/, "data"],
  [/h[oọ]c m[aá]y|machine learning|tr[ií] tu[eệ]|\bai\b/, "ai"],
  [/sql|entity framework|c[oơ] s[oở] d[uữ] li[eệ]u/, "database"],
  [/figma|prototype/, "figma"],
  [/ui\/ux|ux|responsive|design system|thi[eế]t k[eế]/, "ux"],
  [/content|vi[eế]t n[oộ]i dung/, "design"],
  [/marketing|seo/, "marketing"],
  [/agile|qu[aả]n l[yý] d[uự] [aá]n/, "planning"],
  [/backend|api|c#|git\b/, "backend"],
];

const categories = [
  [/bank|ng[aâ]n h[aà]ng|t[aà]i ch[ií]nh/, "banking"],
  [/ngo[aạ]i ng[uữ]|k[yỹ] n[aă]ng/, "languages"],
  [/backend|c[oơ] s[oở] d[uữ] li[eệ]u/, "backend"],
  [/d[uữ] li[eệ]u|\bai\b/, "data"],
  [/thi[eế]t k[eế]|s[aá]ng t[aạ]o/, "ux"],
  [/kinh doanh|marketing/, "marketing"],
  [/web|l[aậ]p tr[iì]nh|c[oô]ng ngh[eệ]/, "web"],
];

export function courseArtwork(course, category = "") {
  const title = (course.title || "").normalize("NFC").toLocaleLowerCase("vi");
  const name = category.normalize("NFC").toLocaleLowerCase("vi");
  const subject = subjects.find(([pattern]) => pattern.test(title))?.[1]
    || categories.find(([pattern]) => pattern.test(name))?.[1]
    || "study";
  return `/images/courses/${subject}.jpg`;
}
