export const COURSE_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
export const LESSON_DOCUMENT_EXTENSIONS = [
  ...COURSE_IMAGE_EXTENSIONS, "gif", "bmp", "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt", "csv",
];
export function uploadLimit(fileName, cover = false) {
  const extension = String(fileName).split(".").pop().toLowerCase();
  if (cover || [...COURSE_IMAGE_EXTENSIONS, "gif", "bmp"].includes(extension)) return 5_000_000;
  return ["txt", "csv"].includes(extension) ? 1_000_000 : 25_000_000;
}
