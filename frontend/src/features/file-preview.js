// Office previews arrive as PDF; the download action always requests the original file.
export function filePreviewKind(contentType) {
  const type = String(contentType || "").split(";")[0].trim().toLowerCase();
  if (type === "application/pdf") return "pdf";
  if (["text/plain", "text/csv"].includes(type)) return "text";
  return ["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp"].includes(type) ? "image" : null;
}

export function mountFilePreview(host, { name, load, download: downloadOriginal }) {
  const controller = new AbortController();
  let closed = false, objectUrl, loadingTask, renderTask, pdf, passwordProtected = false;
  let pageNumber = 1, zoom = 1, sequence = 0, resizeTimer, lastWidth = 0;
  host.innerHTML = `<p class="file-preview-status" role="status">Đang chuẩn bị bản xem tài liệu…</p>
    <div class="file-preview-toolbar">
      <div class="file-preview-pages" hidden>
        <button type="button" class="btn btn-secondary btn-sm" data-preview="previous" aria-label="Trang trước">←</button>
        <span data-preview="page" aria-live="polite"></span>
        <button type="button" class="btn btn-secondary btn-sm" data-preview="next" aria-label="Trang sau">→</button>
        <button type="button" class="btn btn-secondary btn-sm" data-preview="zoom-out" aria-label="Thu nhỏ">−</button>
        <button type="button" class="btn btn-secondary btn-sm" data-preview="zoom-in" aria-label="Phóng to">+</button>
      </div>
      <button type="button" class="btn btn-secondary btn-sm" data-preview="download">Tải bản gốc</button>
    </div><div class="file-preview-content" hidden></div>`;
  const find = (selector) => host.querySelector(selector);
  const status = find(".file-preview-status"), toolbar = find(".file-preview-toolbar");
  const pages = find(".file-preview-pages"), content = find(".file-preview-content");
  const previous = find('[data-preview="previous"]'), next = find('[data-preview="next"]');
  const smaller = find('[data-preview="zoom-out"]'), larger = find('[data-preview="zoom-in"]');
  const download = find('[data-preview="download"]');
  download.onclick = async () => {
    download.disabled = true;
    try { await downloadOriginal(); }
    catch (error) { showError(error.message || "Chưa tải được tệp gốc. Vui lòng thử lại."); }
    finally { download.disabled = false; }
  };
  const controls = [previous, next, smaller, larger];
  const showError = (message) => {
    if (closed) return;
    status.textContent = message;
    status.setAttribute("role", "alert");
    status.hidden = false;
  };
  function updateControls(busy = false) {
    previous.disabled = busy || pageNumber <= 1;
    next.disabled = busy || pageNumber >= pdf.numPages;
    smaller.disabled = busy || zoom <= 0.5;
    larger.disabled = busy || zoom >= 3;
    find('[data-preview="page"]').textContent = `Trang ${pageNumber} / ${pdf.numPages}`;
  }
  async function renderPage() {
    const current = ++sequence;
    renderTask?.cancel();
    updateControls(true);
    try {
      const page = await pdf.getPage(pageNumber);
      if (closed || current !== sequence) return;
      const width = Math.max(160, content.clientWidth - 24);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(width / base.width, 1.6) * zoom });
      const density = Math.min(window.devicePixelRatio || 1, 2, 4096 / viewport.width, 4096 / viewport.height);
      const canvas = document.createElement("canvas");
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", `Trang ${pageNumber} của ${name}`);
      canvas.width = Math.ceil(viewport.width * density);
      canvas.height = Math.ceil(viewport.height * density);
      canvas.style.width = `${Math.ceil(viewport.width)}px`;
      canvas.style.height = `${Math.ceil(viewport.height)}px`;
      content.replaceChildren(canvas);
      renderTask = page.render({ canvasContext: canvas.getContext("2d"), viewport, transform: [density, 0, 0, density, 0, 0] });
      await renderTask.promise;
      if (!closed && current === sequence) status.hidden = true;
    } catch (error) {
      if (error.name !== "RenderingCancelledException") showError("Chưa hiển thị được trang PDF. Bạn có thể thử trang khác hoặc tải tài liệu xuống.");
    } finally {
      if (!closed && current === sequence) updateControls();
    }
  }
  previous.onclick = () => { if (pageNumber > 1) { pageNumber--; void renderPage(); } };
  next.onclick = () => { if (pageNumber < pdf.numPages) { pageNumber++; void renderPage(); } };
  smaller.onclick = () => { zoom = Math.max(0.5, zoom - 0.25); void renderPage(); };
  larger.onclick = () => { zoom = Math.min(3, zoom + 0.25); void renderPage(); };
  const observer = new ResizeObserver(() => {
    const width = content.clientWidth;
    if (!pdf || closed || width === lastWidth) return;
    lastWidth = width;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (!closed) void renderPage(); }, 150);
  });
  observer.observe(content);

  async function initialize() {
    try {
      const blob = await load(controller.signal);
      if (closed) return;
      const kind = filePreviewKind(blob.type);
      if (!kind) throw new Error("Định dạng này chưa hỗ trợ xem trực tiếp.");
      toolbar.hidden = false;
      content.hidden = false;
      if (kind === "text") {
        const text = document.createElement("pre");
        text.className = "file-preview-text";
        text.textContent = await blob.text();
        if (!closed) { content.replaceChildren(text); status.hidden = true; }
        return;
      }
      if (kind === "image") {
        objectUrl = URL.createObjectURL(blob);
        const image = document.createElement("img");
        image.alt = name;
        image.src = objectUrl;
        content.replaceChildren(image);
        await image.decode();
        if (!closed) status.hidden = true;
        return;
      }
      const [engine, worker] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]);
      if (closed) return;
      engine.GlobalWorkerOptions.workerSrc = worker.default;
      const data = new Uint8Array(await blob.arrayBuffer());
      if (closed) return;
      loadingTask = engine.getDocument({ data, isEvalSupported: false, enableXfa: false });
      loadingTask.onPassword = () => {
        passwordProtected = true;
        showError("PDF này yêu cầu mật khẩu. Hãy tải xuống để mở bằng phần mềm đọc PDF.");
        void loadingTask.destroy().catch(() => {});
      };
      pdf = await loadingTask.promise;
      if (closed) return;
      pages.hidden = false;
      lastWidth = content.clientWidth;
      await renderPage();
    } catch (error) {
      if (!closed && error.name !== "AbortError") showError(passwordProtected
        ? "PDF này yêu cầu mật khẩu. Hãy tải bản gốc xuống để mở bằng phần mềm đọc PDF."
        : error.name === "InvalidPDFException"
        ? "Tệp PDF không hợp lệ hoặc đã bị hỏng. Bạn vẫn có thể tải xuống để kiểm tra."
        : error.name === "PasswordException" ? "PDF này yêu cầu mật khẩu. Hãy tải xuống để mở bằng phần mềm đọc PDF."
        : error.message || "Chưa mở được tài liệu. Vui lòng thử lại.");
    }
  }
  void initialize();
  return () => {
    closed = true;
    sequence++;
    controller.abort();
    clearTimeout(resizeTimer);
    observer.disconnect();
    renderTask?.cancel();
    void loadingTask?.destroy().catch(() => {});
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    content.replaceChildren();
    for (const control of [...controls, download]) control.onclick = null;
  };
}
