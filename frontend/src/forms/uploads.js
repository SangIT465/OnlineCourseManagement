import {
  COURSE_IMAGE_EXTENSIONS,
  LESSON_DOCUMENT_EXTENSIONS,
  uploadLimit,
} from "../features/file-types.js";
import { openDialog, modalForm, previewFile } from "../components/dialog.js";

export function createUploadForms({ saved }) {
  function uploadForm(id, type) {
    const image = type === "image",
      extensions = image ? COURSE_IMAGE_EXTENSIONS : LESSON_DOCUMENT_EXTENSIONS;
    openDialog(
      image ? "Tải ảnh bìa khóa học" : "Tải tài liệu bài học",
      "Chia sẻ học liệu với sinh viên của bạn.",
      modalForm(
        `<div class="form-field"><label for="upload-file">${image ? "Chọn ảnh" : "Chọn tài liệu hoặc ảnh"}</label><input id="upload-file" type="file" name="file" accept="${extensions.map(extension => '.' + extension).join(',')}" required/><small>${image ? "JPG, PNG hoặc WebP · Tối đa 5 MB" : "Word, PowerPoint, Excel, PDF · tối đa 25 MB. Ảnh JPG/PNG/WebP/GIF/BMP · 5 MB. TXT/CSV (UTF-8) · 1 MB."}</small></div>`,
        "Tải lên",
      ),
      async (form) => {
        const data = new FormData(form),
          file = data.get("file");
        if (!file?.size) throw new Error("Vui lòng chọn một file có nội dung.");
        const max = uploadLimit(file.name, image);
        if (file.size > max)
          throw new Error(`File vượt quá ${max / 1000000} MB.`);
        if (!extensions.includes(file.name.split(".").pop().toLowerCase()))
          throw new Error("Định dạng file không được hỗ trợ.");
        const uploaded = await saved(
          image ? `/files/courses/${id}/image` : `/files/lessons/${id}/document`,
          "POST",
          data,
          "Đã tải file lên thành công.",
        );
        await previewFile(uploaded.id, uploaded.originalName);
      },
    );
  }

  return { uploadForm };
}
