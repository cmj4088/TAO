import axios from "axios";
import { getAccessToken, getRefreshToken, saveTokens, clearTokens } from "@/api/tokenStore";

// VITE_API_BASE 为空字符串时表示同源请求（nginx 反代 /api），因此用 ?? 而非 ||
export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8002";

const client = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

// 请求拦截器：自动附加 Bearer token（经由统一存取层，兼容"未勾记住我"的纯内存会话）
client.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：401 自动刷新 token
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // 不是 401 或已经是重试过的请求，直接返回错误
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // 刷新 token 本身失败，不重试
    if (originalRequest.url === "/api/auth/refresh") {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return client(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      isRefreshing = false;
      // 未登录，清除残留 token，让 AuthGuard 处理重定向
      clearTokens();
      return Promise.reject(error);
    }

    try {
      const res = await axios.post(`${API_BASE}/api/auth/refresh`, {
        refresh_token: refreshToken,
      });
      const { access_token, refresh_token } = res.data.data;
      // 经统一存取层保存：是否写 localStorage 由"记住我"选择决定
      saveTokens(access_token, refresh_token);
      processQueue(null, access_token);
      originalRequest.headers.Authorization = `Bearer ${access_token}`;
      return client(originalRequest);
    } catch {
      processQueue(error, null);
      clearTokens();
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  },
);

export default client;
