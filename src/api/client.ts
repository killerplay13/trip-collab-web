import axios from "axios";
import { ElMessage } from "element-plus";
import i18n from "../i18n";
import { useSessionStore } from "../stores/session";

const baseURL = import.meta.env.VITE_API_BASE_URL || ""; // <-- important for proxy

export const api = axios.create({
  baseURL,
  timeout: 15000,
});

function getRequestPath(url: string) {
  try {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return new URL(url).pathname;
    }
  } catch {
    // Fall through to the relative-path parser below.
  }

  return url.split("?")[0] ?? "";
}

function getTripIdFromUrl(url?: string) {
  if (!url) return null;

  const path = getRequestPath(url);
  const match = path.match(/^\/api\/trips\/([^/]+)(?:\/.*)?$/);
  return match?.[1] ?? null;
}

function translateApiErrorMessage(message?: string) {
  const fallback = message?.trim();
  if (!fallback) return "";

  const insufficientWalletBalance = fallback.match(/^Insufficient wallet balance in ([A-Z]{3})$/);
  if (insufficientWalletBalance?.[1]) {
    return (i18n.global as any).t("apiErrors.insufficientWalletBalance", {
      currency: insufficientWalletBalance[1],
    });
  }

  return fallback;
}

function getApiErrorMessage(error: any) {
  const responseMessage = error?.response?.data?.message;
  if (typeof responseMessage === "string" && responseMessage.trim()) {
    return translateApiErrorMessage(responseMessage);
  }

  if (typeof error?.message === "string" && error.message.trim()) {
    return translateApiErrorMessage(error.message);
  }

  return (i18n.global as any).t("apiErrors.requestFailed");
}

function showApiErrorToast(error: any) {
  if (error?.code === "ERR_CANCELED") return;
  if (error?.config?.skipErrorToast) return;

  const message = getApiErrorMessage(error);
  if (!message) return;

  ElMessage({
    type: "error",
    message,
    showClose: true,
    duration: 5000,
  });
}

api.interceptors.request.use((config) => {
  const url = config.url ?? "";
  const path = getRequestPath(url);
  const method = String(config.method ?? "get").toUpperCase();
  const tripId = getTripIdFromUrl(url);

  if (!tripId) return config;

  const joinMembersPath = `/api/trips/${tripId}/members`;
  if (method === "POST" && path === joinMembersPath) return config;

  const session = useSessionStore();
  const access = session.getTripAccess(tripId);
  if (access?.memberToken) {
    config.headers = config.headers ?? {};
    config.headers["X-Member-Token"] = access.memberToken;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url;
    const tripId = getTripIdFromUrl(url);

    if (status === 401 && tripId) {
      const session = useSessionStore();
      const tripToken = session.getTripToken(tripId);
      session.clearTripAccess(tripId);

      if (typeof window !== "undefined") {
        const joinPath = `/t/${tripId}/join`;
        if (window.location.pathname !== joinPath) {
          const query = new URLSearchParams();
          if (tripToken) query.set("token", tripToken);

          const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
          if (currentPath && currentPath !== joinPath) {
            query.set("redirect", currentPath);
          }

          const nextUrl = query.size > 0 ? `${joinPath}?${query.toString()}` : joinPath;
          window.location.replace(nextUrl);
        }
      }
    } else {
      showApiErrorToast(error);
    }

    return Promise.reject(error);
  },
);
