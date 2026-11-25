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

test("demo confirmation is added only when allowed and preserves payOS actions", () => {
  const html = purchaseDetail({...purchase,canConfirmDemoPayment:true,checkoutUrl:"https://pay.payos.vn/web/id"});
  assert.match(html,/Đã thanh toán \(demo\)/);
  assert.match(html,/data-action="purchase-demo-confirm"/);
  assert.match(html,/Mở trang thanh toán payOS/);
  assert.match(html,/Kiểm tra thanh toán/);
  for(const status of ["Paid","Cancelled","Expired"])
    assert.doesNotMatch(purchaseDetail({...purchase,status,canConfirmDemoPayment:true}),/data-action="purchase-demo-confirm"/);
  assert.doesNotMatch(purchaseDetail(purchase),/data-action="purchase-demo-confirm"/);
});

test("confirmed demo purchase provides the learning link and identifies the payment method", () => {
  const html = purchaseDetail({...purchase,status:"Paid",paymentReference:"DEMO-123"});
  assert.match(html,/Vào học ngay/);
  assert.match(html,/Thanh toán demo/);
});
test("bill and history escape names, addresses and course content", () => {
  const data = {...purchase,buyerName:'<script>alert(1)</script>',courseTitle:'<img src=x onerror=alert(1)>'};
  for(const html of [purchaseDetail(data),purchaseList([data],true)]) {
    assert.doesNotMatch(html,/<script>|<img src=x/);
    assert.match(html,/&lt;/);
  }
});

test("Admin and User can cancel pending bills from the list and detail without losing bill links", () => {
  for (const admin of [false,true]) {
    const html=purchaseList([purchase,{...purchase,id:11,status:"Paid"},{...purchase,id:12,status:"Cancelled"},{...purchase,id:13,status:"Expired"}],admin);
    assert.equal((html.match(/data-action="purchase-cancel"/g)||[]).length,1);
    assert.match(html,/data-action="purchase-cancel" data-id="10"/);
    assert.match(html,/href="#\/purchases\/10"/);
  }
  assert.match(purchaseDetail(purchase),/data-action="purchase-cancel"/);
  for (const status of ["Paid","Cancelled","Expired"])
    assert.doesNotMatch(purchaseDetail({...purchase,status}),/data-action="purchase-cancel"/);
});
