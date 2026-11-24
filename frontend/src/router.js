import { state } from "./state/store.js";

let renderPage;

export function setupRouter(render) {
  renderPage = render;
}

export function currentRoute() {
  return parseRoute(location.hash);
}

export function parseRoute(hash) {
  const [path, search = ""] = hash.replace(/^#\/?/, "").split("?");
  const [page = "dashboard", id, sub] = (path || "dashboard").split("/");
  return { page, id: Number(id), sub, params: new URLSearchParams(search) };
}
export function navigate(path) {
  if (location.hash === `#/${path}`) {
    state.ready = false;
    void renderPage();
  }
  else location.hash = `/${path}`;
}

export function updateFilters(form) {
  const route = currentRoute(),
    params = new URLSearchParams(new FormData(form));
  for (const [key, value] of [...params]) if (!value.trim()) params.delete(key);
  navigate(`${route.page}${params.size ? `?${params}` : ""}`);
}
