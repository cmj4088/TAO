// 统一的 token 存取层：token 始终持有在内存中；
// 只有用户勾选"记住我"时才持久化到 localStorage（重启恢复登录）。
// axios 拦截器与 authStore 都通过本模块读写，避免"不勾也被持久化"的漏洞。

const REMEMBER_KEY = "remember_me";
const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";

// 内存中的当前 token（模块加载时先恢复"记住我"留下的会话）
let memoryAccess: string | null = null;
let memoryRefresh: string | null = null;
try {
  memoryAccess = localStorage.getItem(ACCESS_KEY);
  memoryRefresh = localStorage.getItem(REFRESH_KEY);
} catch {
  // localStorage 不可用
}

/** 用户是否勾选了"记住我" */
export function isRememberMe(): boolean {
  try {
    return localStorage.getItem(REMEMBER_KEY) === "1";
  } catch {
    return false;
  }
}

/** 记录/清除"记住我"选择 */
export function setRememberMe(value: boolean): void {
  try {
    localStorage.setItem(REMEMBER_KEY, value ? "1" : "0");
  } catch {
    // localStorage 不可用
  }
}

export function getAccessToken(): string | null {
  return memoryAccess;
}

export function getRefreshToken(): string | null {
  return memoryRefresh;
}

export function hasTokens(): boolean {
  return !!(memoryAccess && memoryRefresh);
}

/** 保存 token：始终更新内存；仅勾选"记住我"（或显式指定 persist）时写入 localStorage */
export function saveTokens(access: string, refresh: string, persist: boolean = isRememberMe()): void {
  memoryAccess = access;
  memoryRefresh = refresh;
  if (persist) {
    try {
      localStorage.setItem(ACCESS_KEY, access);
      localStorage.setItem(REFRESH_KEY, refresh);
    } catch {
      // localStorage 不可用
    }
  }
}

/** 清除 token（内存 + localStorage + 记住我标记） */
export function clearTokens(): void {
  memoryAccess = null;
  memoryRefresh = null;
  try {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(REMEMBER_KEY);
  } catch {
    // localStorage 不可用
  }
}
