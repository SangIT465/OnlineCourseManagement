import { request, getToken } from "../api/client.js";
import { state, view, is } from "../state/store.js";
import { currentRoute } from "../router.js";
import { purchaseDetail, purchaseList } from "../features/purchases.js";

let purchasePollTimer;
let displayedList = null;

export function stopPurchasePoll() {
  clearTimeout(purchasePollTimer);
}

export async function purchasesPage(route, version) {
  view.displayedPurchase = null;
  displayedList = null;
  if (!route.id) {
    const page = Math.max(1, Number(route.params.get("page")) || 1);
    const purchases = await request(`/purchases${is("Admin") ? "" : "/my"}?page=${page}`);
    if (version !== view.renderVersion) return "";
    displayedList = purchases;
    return purchaseList(purchases, is("Admin"), page);
  }
  const purchase = await request(`/purchases/${route.id}`);
  if (version !== view.renderVersion) return "";
  view.displayedPurchase = purchase;
  return purchaseDetail(purchase);
}
export function schedulePurchasePoll(id, version, render) {
  const pending = id ? view.displayedPurchase?.status === "PendingPayment" : displayedList?.some(p => p.status === "PendingPayment");
  if (version !== view.renderVersion || !pending) return;
  purchasePollTimer = setTimeout(async () => {
    const route = currentRoute();
    if (version !== view.renderVersion || route.page !== "purchases" || (route.id || null) !== (id || null) || !getToken()) return;
    if (document.visibilityState !== "hidden" && !document.querySelector("#app-dialog")?.open) {
      try {
        const updated = id
          ? await request(`/purchases/${id}${view.displayedPurchase.checkoutUrl ? "/sync" : ""}`, { method: view.displayedPurchase.checkoutUrl ? "POST" : "GET" })
          : await request(`/purchases${is("Admin") ? "" : "/my"}?page=${Math.max(1, Number(route.params.get("page")) || 1)}`);
        if (version !== view.renderVersion) return;
        const changed = id ? updated.status !== view.displayedPurchase.status :
          JSON.stringify(updated.map(p => [p.id, p.status])) !== JSON.stringify(displayedList.map(p => [p.id, p.status]));
        if (changed && !document.querySelector("#app-dialog")?.open) {
          state.ready = false;
          return render();
        }
      } catch { /* Keep the current bill/list visible until the next successful refresh. */ }
    }
    schedulePurchasePoll(id, version, render);
  }, 10000);
}
