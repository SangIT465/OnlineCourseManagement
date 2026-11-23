import test from "node:test";
import assert from "node:assert/strict";
import { canAccessPage } from "../src/auth/permissions.js";
import { purchaseDetail, purchaseList, payOSUrl, isPaymentQr } from "../src/features/purchases.js";

const purchase = { id: 10, orderCode: 123, invoiceNumber: "CF-123", courseId: 2, courseTitle: "Khóa học",
  categoryName: "Backend", amount: 20000, originalPrice: 20000, buyerName: "Học viên", buyerEmail: "user@example.test",
  sellerName: "CourseFlow", status: "PendingPayment", createdAt: "2026-11-23T01:00:00Z", paymentConfigured: true };

test("purchase pages belong only to User and Admin", () => {
  for(const role of ["User","Admin"]) assert.equal(canAccessPage({role},"purchases"),true);
  for(const role of ["Staff","Instructor","Unknown"]) assert.equal(canAccessPage({role},"purchases"),false);
  assert.equal(canAccessPage(null,"purchases"),false);
});
test("QR and checkout reject untrusted content", () => {
  assert.equal(isPaymentQr('data:image/svg+xml,<svg onload=alert(1)>'),false);
  assert.equal(isPaymentQr('data:image/png;base64,iVBORw0KGgo='),true);
  assert.equal(payOSUrl("javascript:alert(1)"),null);
  assert.equal(payOSUrl("https://payos.vn.attacker.test/web/order"),null);
  assert.equal(payOSUrl("https://pay.payos.vn/web/order"),"https://pay.payos.vn/web/order");
});
test("pending bill never claims payment or grants the learning link", () => {
  const html = purchaseDetail({...purchase, checkoutUrl:"https://pay.payos.vn/web/id", qrCodeDataUrl:"data:image/png;base64,aGVsbG8="});
  assert.match(html,/Chờ thanh toán/);
  assert.match(html,/Kiểm tra thanh toán/);
  assert.match(html,/Mở trang thanh toán payOS/);
  assert.doesNotMatch(html,/Vào học ngay/);
});
test("paid bill shows learning and printing while hiding the payment QR", () => {
  const html = purchaseDetail({...purchase,status:"Paid",paidAt:"2026-11-23T02:00:00Z",qrCodeDataUrl:"data:image/png;base64,aGVsbG8="});
  assert.match(html,/Vào học ngay/);
  assert.match(html,/In bill \/ Lưu PDF/);
  assert.doesNotMatch(html,/class="purchase-qr"/);
});
test("bill and history escape names, addresses and course content", () => {
  const data = {...purchase,buyerName:'<script>alert(1)</script>',courseTitle:'<img src=x onerror=alert(1)>'};
  for(const html of [purchaseDetail(data),purchaseList([data],true)]) {
    assert.doesNotMatch(html,/<script>|<img src=x/);
    assert.match(html,/&lt;/);
  }
});
