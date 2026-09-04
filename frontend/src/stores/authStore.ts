import { create } from "zustand";
import client from "@/api/client";

interface UserInfo {
  id: string;
  email: string;
  display_name: string;
  role: string;
  permissions: string[];
  created_at?: string;
}

interface AuthState {
  user: UserInfo | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  loading: boolean;

  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (email: string, password: string, displayName: string, code: string) => Promise<void>;
  sendVerifyCode: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<boolean>;
  loadUser: () => Promise<void>;
  setTokens: (access: string, refresh: string) => void;
  hasPermission: (permission: string) => boolean;
}

/** 从 localStorage 恢复 token，有 token 即视为已登录 */
function loadTokens(): { access: string | null; refresh: string | null; isAuthenticated: boolean } {
  try {
    const access = localStorage.getItem("access_token");
    const refresh = localStorage.getItem("refresh_token");
    return {
      access,
      refresh,
      isAuthenticated: !!(access && refresh),
    };
  } catch {
    return { access: null, refresh: null, isAuthenticated: false };
  }
}

/** 保存 token 到 localStorage */
function saveTokens(access: string, refresh: string) {
  try {
    localStorage.setItem("access_token", access);
    localStorage.setItem("refresh_token", refresh);
  } catch {
    // localStorage 不可用
  }
}

/** 清除 localStorage 中的 token */
function clearTokens() {
  try {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  } catch {
    // localStorage 不可用
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: (() => { try { return localStorage.getItem("access_token"); } catch { return null; } })(),
  refreshToken: (() => { try { return localStorage.getItem("refresh_token"); } catch { return null; } })(),
  isAuthenticated: (() => { try { return !!(localStorage.getItem("access_token") && localStorage.getItem("refresh_token")); } catch { return false; } })(),
  loading: false,

  setTokens: (access, refresh) => {
    saveTokens(access, refresh);
    set({ accessToken: access, refreshToken: refresh, isAuthenticated: true });
  },

  login: async (email, password, rememberMe = false) => {
    set({ loading: true });
    try {
      const res = await client.post("/api/auth/login", { email, password });
      const { access_token, refresh_token } = res.data.data;
      // 只有勾选"记住我"才持久化到 localStorage
      if (rememberMe) {
        saveTokens(access_token, refresh_token);
      }
      set({
        accessToken: access_token,
        refreshToken: refresh_token,
        isAuthenticated: true,
      });
      // 登录后加载用户信息
      await get().loadUser();
      set({ loading: false });
    } catch (e: unknown) {
      set({ loading: false });
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || "登录失败，请检查邮箱和密码";
      throw new Error(detail);
    }
  },

  register: async (email, password, displayName, code) => {
    set({ loading: true });
    try {
      const res = await client.post("/api/auth/register", {
        email,
        password,
        display_name: displayName,
        code,
      });
      const { access_token, refresh_token } = res.data.data;
      saveTokens(access_token, refresh_token);
      set({
        accessToken: access_token,
        refreshToken: refresh_token,
        isAuthenticated: true,
        loading: false,
      });
      await get().loadUser();
    } catch (e: unknown) {
      set({ loading: false });
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || "注册失败";
      throw new Error(detail);
    }
  },

  sendVerifyCode: async (email) => {
    try {
      await client.post("/api/auth/send-verify-code", { email });
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || "发送失败";
      throw new Error(detail);
    }
  },

  logout: async () => {
    try {
      await client.post("/api/auth/logout");
    } catch {
      // 即使后端登出失败，也清除本地状态
    }
    clearTokens();
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  },

  refreshAuth: async () => {
    const { refreshToken } = get();
    if (!refreshToken) return false;
    try {
      const res = await client.post("/api/auth/refresh", {
        refresh_token: refreshToken,
      });
      const { access_token, refresh_token } = res.data.data;
      saveTokens(access_token, refresh_token);
      set({
        accessToken: access_token,
        refreshToken: refresh_token,
        isAuthenticated: true,
      });
      return true;
    } catch {
      clearTokens();
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
      });
      return false;
    }
  },

  loadUser: async () => {
    try {
      const res = await client.get("/api/auth/me");
      set({ user: res.data.data, isAuthenticated: true });
    } catch {
      // 不在这里清 token — 401 拦截器已经处理了 token 刷新/清除
      // 只标记用户信息加载失败，AuthGuard 会处理重定向
      set({ user: null, isAuthenticated: false });
    }
  },

  hasPermission: (permission) => {
    const { user } = get();
    if (!user) return false;
    return user.permissions.includes(permission);
  },
}));