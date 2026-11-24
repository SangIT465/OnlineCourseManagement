import { request, getToken } from "../api/client.js";
import { state, view, is } from "../state/store.js";
import { currentRoute } from "../router.js";
import { purchaseDetail, purchaseList } from "../features/purchases.js";

let purchasePollTimer;

export function stopPurchasePoll() {
  clearTimeout(purchasePollTimer);
}

export async function purchasesPage(route, version) {
  view.displayedPurchase = null;
  if (!route.id) {
    const page = Math.max(1, Number(route.params.get("page")) || 1);
    const purchases = await request(`/purchases${is("Admin") ? "" : "/my"}?page=${page}`);
    return purchaseList(purchases, is("Admin"), page);
  }
  const purchase = await request(`/purchases/${route.id}`);
  if (version !== view.renderVersion) return "";
  view.displayedPurchase = purchase;
  return purchaseDetail(purchase);
}
export function schedulePurchasePoll(id, version, render) {
  if (version !== view.renderVersion || view.displayedPurchase?.status !== "PendingPayment" || !view.displayedPurchase.checkoutUrl) return;
  purchasePollTimer = setTimeout(async () => {
    if (version !== view.renderVersion || currentRoute().page !== "purchases" || currentRoute().id !== id || !getToken()) return;
    if (document.visibilityState !== "hidden") {
      try {
        const updated = await request(`/purchases/${id}/sync`, { method: "POST" });
        if (version !== view.renderVersion) return;
        if (updated.status !== view.displayedPurchase.status) {
          state.ready = false;
          return render();
        }
      } catch { /* Keep the bill visible; the user can retry the explicit check. */ }
    }
    schedulePurchasePoll(id, version, render);
  }, 10000);
}
