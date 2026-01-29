import axios from "axios";
import { useSessionStore } from "../stores/session.ts";

// Vite env: VITE_API_BASE_URL=https://xxx.railway.app
const baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

export const api = axios.create({
  baseURL,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  // 這裡用 URL 去抓 tripId（/api/trips/{tripId}/...）
  const url = config.url ?? "";
  const match = url.match(/\/api\/trips\/([^/]+)/);
  const tripId = match?.[1];

  if (tripId) {
    const session = useSessionStore();
    const token = session.getTripToken(tripId);
    if (token) {
      config.headers = config.headers ?? {};
      config.headers["X-Trip-Token"] = token;
    }
  }
  return config;
});
