import { escapeHtml as esc, safeUrl } from "../api/client.js";

export const purchaseLabels = { PendingPayment: "Chờ thanh toán", Paid: "Đã thanh toán", Cancelled: "Đã hủy", Expired: "Hết hạn" };
const vnd = value => `${new Intl.NumberFormat("vi-VN").format(Number(value) || 0)} đ`;
const date = value => value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(/Z$|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`)) : "Chưa thanh toán";
export const isPaymentQr = value => typeof value === "string" && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value);
export function payOSUrl(value) {
  const url = safeUrl(value);
  return url && new URL(url).protocol === "https:" && new URL(url).hostname.endsWith(".payos.vn") ? url : null;
}
const row = (label, value) => `<div><dt>${esc(label)}</dt><dd>${esc(value || "Chưa cung cấp")}</dd></div>`;

export function purchaseDetail(purchase) {
  const p = purchase, paid = p.status === "Paid", pending = p.status === "PendingPayment", checkout = payOSUrl(p.checkoutUrl);
  const qr = pending && isPaymentQr(p.qrCodeDataUrl);
  const payment = paid
    ? `<div class="purchase-success"><strong>Thanh toán đã được xác nhận</strong><p>Khóa học đã được mở cho tài khoản của bạn.</p><a class="btn btn-primary" href="#/courses/${Number(p.courseId)}">Vào học ngay</a></div>`
    : pending ? `<section class="purchase-payment"><h2>Thanh toán an toàn qua payOS</h2>${qr ? `<img class="purchase-qr" src="${esc(p.qrCodeDataUrl)}" width="280" height="280" alt="Mã QR payOS cho đơn ${esc(p.orderCode)}"/><p>Quét mã bằng ứng dụng ngân hàng, hoặc mở trang thanh toán payOS.</p>` : `<div class="purchase-qr-empty">${p.paymentConfigured ? "Tạo liên kết để hiển thị mã QR thanh toán." : "Kênh payOS chưa được cấu hình. Đơn của bạn đã được lưu; vui lòng liên hệ quản trị viên."}</div>`}
      ${p.bankAccountNumber ? `<dl class="purchase-facts">${row("Tài khoản nhận", p.bankAccountNumber)}${row("Chủ tài khoản", p.bankAccountName)}${row("Mã ngân hàng", p.bankName)}</dl>` : ""}
      <p class="purchase-reference">Nội dung chuyển khoản: <strong>CF${esc(p.orderCode)}</strong></p>
      ${checkout ? `<a class="btn btn-primary full-width" href="${esc(checkout)}" target="_blank" rel="noopener noreferrer">Mở trang thanh toán payOS</a>` : `<button class="btn btn-primary full-width" data-action="purchase-payment-link" data-id="${Number(p.id)}" ${p.paymentConfigured ? "" : "disabled"}>Tạo QR thanh toán payOS</button>`}
      <p class="text-small text-muted">Quyền học được mở sau khi hệ thống xác minh thanh toán. Không chuyển tiền thêm nếu bạn đã thanh toán.</p></section>`
    : `<div class="form-info">Đơn này đã đóng. Bạn có thể trở lại khóa học để tạo đơn mới.</div>`;
  return `<div class="page-heading"><div><a href="#/purchases">← Đơn mua của tôi</a><h1>${paid ? "Hóa đơn mua khóa học" : "Đơn mua khóa học"}</h1><p>${esc(p.invoiceNumber)} · ${esc(date(p.createdAt))}</p></div><span class="badge ${paid ? "" : "neutral"}" data-purchase-status>${esc(purchaseLabels[p.status] || p.status)}</span></div>
    <div class="purchase-layout"><section class="panel purchase-bill"><div class="purchase-seller"><h2>${esc(p.sellerName)}</h2><p>${esc(p.sellerAddress)}</p><p>${esc(p.sellerContact)}</p></div>
    <div class="purchase-buyer"><h3>Thông tin người mua</h3><dl class="purchase-facts">${row("Họ và tên",p.buyerName)}${row("Email",p.buyerEmail)}${row("Điện thoại",p.buyerPhone)}${row("Địa chỉ",p.buyerAddress)}</dl></div>
    <div class="table-wrap"><table><thead><tr><th>Khóa học</th><th>SL</th><th>Thành tiền</th></tr></thead><tbody><tr><td><strong>${esc(p.courseTitle)}</strong><small>${esc(p.categoryName)}</small></td><td>1</td><td>${esc(vnd(p.amount))}</td></tr></tbody></table></div>
    <div class="purchase-total"><span>Tổng thanh toán</span><strong>${esc(vnd(p.amount))}</strong></div>${Number(p.originalPrice) !== Number(p.amount) ? `<p class="text-small text-muted">Học phí được làm tròn đến đơn vị đồng để thanh toán VND.</p>` : ""}
    <dl class="purchase-facts">${row("Mã đơn",p.orderCode)}${row("Phương thức",Number(p.amount)===0?"Miễn phí":"payOS")}${row("Ngày thanh toán",date(p.paidAt))}${row("Tham chiếu",p.paymentReference || "Chưa có")}</dl>
    <div class="purchase-actions"><button class="btn btn-secondary" data-action="purchase-print" data-id="${Number(p.id)}">${paid?"In bill / Lưu PDF":"In phiếu đặt mua"}</button>${pending && checkout ? `<button class="btn btn-secondary" data-action="purchase-sync" data-id="${Number(p.id)}">Kiểm tra thanh toán</button>` : ""}</div></section><aside>${payment}</aside></div>`;
}

export function purchaseList(items, admin = false, page = 1) {
  return `<div class="page-heading"><div><h1>${admin ? "Đơn mua khóa học" : "Đơn mua & hóa đơn"}</h1><p>${admin ? "Theo dõi kết quả thanh toán payOS của học viên." : "Xem lại đơn, tiếp tục thanh toán và in bill của bạn."}</p></div></div>
    ${items.length ? `<div class="table-wrap"><table><thead><tr><th>Mã đơn / ngày tạo</th><th>Khóa học${admin ? " / Người mua" : ""}</th><th>Số tiền</th><th>Trạng thái</th><th></th></tr></thead><tbody>${items.map(p=>`<tr><td><strong>${esc(p.invoiceNumber)}</strong><small>${esc(date(p.createdAt))}</small></td><td><strong>${esc(p.courseTitle)}</strong>${admin?`<small>${esc(p.buyerName)} · ${esc(p.buyerEmail)}</small>`:""}</td><td>${esc(vnd(p.amount))}</td><td><span class="badge ${p.status==="Paid"?"":"neutral"}">${esc(purchaseLabels[p.status]||p.status)}</span></td><td><a class="btn btn-secondary btn-sm" href="#/purchases/${Number(p.id)}">Xem bill</a></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state"><h3>Chưa có đơn mua</h3><p>Đơn mua và hóa đơn của bạn sẽ xuất hiện tại đây.</p><a class="btn btn-primary" href="#/courses">Khám phá khóa học</a></div>`}
    <nav class="purchase-pagination" aria-label="Phân trang đơn mua">${page>1?`<a class="btn btn-secondary" href="#/purchases?page=${page-1}">Trang trước</a>`:""}${items.length===20?`<a class="btn btn-secondary" href="#/purchases?page=${page+1}">Trang sau</a>`:""}</nav>`;
}

export async function printPurchase(html) {
  const frame = document.createElement("iframe");
  frame.setAttribute("title", "In hóa đơn mua khóa học");
  frame.setAttribute("sandbox", "allow-same-origin allow-modals");
  frame.style.cssText = "position:fixed;width:1px;height:1px;right:0;bottom:0;border:0;visibility:hidden";
  const loaded = new Promise((resolve,reject) => {
    frame.onload=()=>resolve();
    frame.onerror=()=>reject(new Error("Không mở được bản in."));
  });
  frame.srcdoc = html;
  document.body.append(frame);
  try {
    await loaded;
    await frame.contentDocument.fonts?.ready;
    await Promise.all([...frame.contentDocument.images].map(image=>image.decode().catch(()=>{})));
    frame.contentWindow.addEventListener("afterprint",()=>frame.remove(),{once:true});
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(()=>frame.remove(),60000);
  } catch(error) { frame.remove(); throw error; }
}
