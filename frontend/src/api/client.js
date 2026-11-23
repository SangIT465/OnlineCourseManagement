import { apiUrl } from "../config.js";

// Requests use the configured API; ASP.NET remains the authority for permissions.
const TOKEN_KEY = "courseflow.session";
export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}
export async function request(
  path,
  { method = "GET", body, signal, blob = false, timeoutMs = 30000 } = {},
) {
  const token = getToken();
  const headers = { Accept: blob ? "*/*" : "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const multipart = body instanceof FormData;
  if (body !== undefined && !multipart)
    headers["Content-Type"] = "application/json";
  let response;
  try {
    response = await fetch(apiUrl(path), {
      method,
      headers,
      credentials: "same-origin",
      body:
        body === undefined
          ? undefined
          : multipart
            ? body
            : JSON.stringify(body),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
        : AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError(
      error.name === "TimeoutError"
        ? "Máy chủ phản hồi chậm. Vui lòng thử lại."
        : "Không thể kết nối máy chủ. Kiểm tra kết nối và thử lại.",
      0,
    );
  }
  if (response.ok && blob) return response.blob();
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    if (response.status === 401 && token && getToken() === token) {
      setToken(null);
      window.dispatchEvent(new Event("session-expired"));
    }
    const validation = data?.errors
      ? Object.values(data.errors).flat().join(" ")
      : null;
    const fallback =
      {
        401: "Email hoặc mật khẩu không đúng, hoặc phiên đăng nhập đã hết hạn.",
        403: "Bạn không có quyền thực hiện thao tác này.",
        404: "Không tìm thấy dữ liệu. Dữ liệu có thể đã được xóa.",
        409: "Dữ liệu đang được sử dụng hoặc đã tồn tại.",
      }[response.status] || "Không thể xử lý yêu cầu. Vui lòng thử lại.";
    throw new ApiError(
      validation ||
        data?.message ||
        (typeof data === "string" && data.length < 250 && !/[<>\n]/.test(data)
          ? data
          : null) ||
        fallback,
      response.status,
    );
  }
  return data;
}
export function query(params) {
  return new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== "" && value != null),
  ).toString();
}
export function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
}
export function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
