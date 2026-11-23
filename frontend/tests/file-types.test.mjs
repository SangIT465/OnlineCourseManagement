import test from "node:test";
import assert from "node:assert/strict";
import { COURSE_IMAGE_EXTENSIONS, LESSON_DOCUMENT_EXTENSIONS, uploadLimit } from "../src/features/file-types.js";

test("lessons accept documents, spreadsheets, presentations and images while covers remain images", () => {
  for (const extension of ["jpg", "png", "gif", "bmp", "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt", "csv"])
    assert.ok(LESSON_DOCUMENT_EXTENSIONS.includes(extension));
  for (const extension of ["exe", "html", "svg", "js", "docm", "pptm"])
    assert.equal(LESSON_DOCUMENT_EXTENSIONS.includes(extension), false);
  assert.equal(COURSE_IMAGE_EXTENSIONS.includes("docx"), false);
});
test("file size limits match the selected format", () => {
  assert.equal(uploadLimit("slide.PPTX"), 25_000_000);
  assert.equal(uploadLimit("photo.GIF"), 5_000_000);
  assert.equal(uploadLimit("notes.txt"), 1_000_000);
  assert.equal(uploadLimit("data.csv"), 1_000_000);
});
