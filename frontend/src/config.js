// Only public, build-time frontend configuration belongs here.
export function createApiConfig(baseUrl = "/api") {
  const apiBaseUrl = (baseUrl || "/api").replace(/\/+$/, "");
  return {
    apiBaseUrl,
    docsUrl: /^https?:\/\//i.test(apiBaseUrl)
      ? new URL("/swagger", apiBaseUrl).href
      : "/swagger",
  };
}

const env = import.meta.env ?? {};
const config = createApiConfig(env.VITE_API_BASE_URL);
export const API_BASE_URL = config.apiBaseUrl;
export const API_DOCS_URL = config.docsUrl;

export function apiUrl(path) {
  return `${API_BASE_URL}/${path.replace(/^\/+/, "")}`;
}
