import test from "node:test";
import assert from "node:assert/strict";
import { filePreviewKind } from "../src/features/file-preview.js";

test("preview recognizes only the PDF and raster image types accepted by the server", () => {
  assert.equal(filePreviewKind("application/pdf"), "pdf");
  assert.equal(filePreviewKind("APPLICATION/PDF; charset=utf-8"), "pdf");
  for (const type of ["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp"]) assert.equal(filePreviewKind(type), "image");
});

test("UTF-8 text and CSV are displayed as text, never interpreted as HTML", () => {
  assert.equal(filePreviewKind("text/plain; charset=utf-8"), "text");
  assert.equal(filePreviewKind("text/csv; charset=utf-8"), "text");
  assert.equal(filePreviewKind("application/msword"), null);
});

test("HTML, SVG and generic downloads cannot become inline previews", () => {
  for (const type of ["text/html", "image/svg+xml", "application/octet-stream", "application/pdf.evil", "", null])
    assert.equal(filePreviewKind(type), null);
});
