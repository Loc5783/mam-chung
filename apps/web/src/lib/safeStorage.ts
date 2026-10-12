/**
 * Safe wrapper for browser Storage (localStorage / sessionStorage)
 * Guarantees zero crashes even when:
 * - Running in Safari Private Browsing (quota exceeded / security error)
 * - Quota is exhausted
 * - Stored JSON is corrupted or invalid
 */

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof window === "undefined" || !window.localStorage) return null;
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  setItem(key: string, value: string): boolean {
    try {
      if (typeof window === "undefined" || !window.localStorage) return false;
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },

  removeItem(key: string): boolean {
    try {
      if (typeof window === "undefined" || !window.localStorage) return false;
      window.localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },

  getJSON<T>(key: string, validate?: (value: unknown) => value is T): T | null {
    try {
      const raw = safeStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (validate && !validate(parsed)) return null;
      return parsed as T;
    } catch {
      return null;
    }
  },

  setJSON<T>(key: string, value: T): boolean {
    try {
      return safeStorage.setItem(key, JSON.stringify(value));
    } catch {
      return false;
    }
  },
};
