import { useEffect, useState } from "react";

export type MotionPreference = "system" | "full" | "reduced";

const STORAGE_KEY = "mam-chung:motion-preference";
const MOTION_CHANGE_EVENT = "mam-chung:motion-preference-changed";

/**
 * Read current motion preference from localStorage safely.
 */
export function getMotionPreference(): MotionPreference {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val === "full" || val === "reduced" || val === "system") {
      return val;
    }
  } catch {
    /* Storage unavailable */
  }
  return "system";
}

/**
 * Apply motion preference to documentElement and persist to localStorage.
 */
export function setMotionPreference(preference: MotionPreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    /* Storage unavailable */
  }

  if (typeof document !== "undefined" && document.documentElement) {
    if (preference === "system") {
      document.documentElement.removeAttribute("data-motion");
    } else {
      document.documentElement.setAttribute("data-motion", preference);
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(MOTION_CHANGE_EVENT, { detail: preference }));
  }
}

/**
 * Determine if motion should currently be reduced.
 */
export function checkIsReducedMotion(): boolean {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return false;
  }

  const attr = document.documentElement.getAttribute("data-motion");
  if (attr === "reduced") return true;
  if (attr === "full") return false;

  if (typeof window.matchMedia === "function") {
    return Boolean(window.matchMedia("(prefers-reduced-motion: reduce)")?.matches);
  }

  return false;
}

/**
 * Hook to reactively determine if animations/transitions should be reduced.
 * Responds to system setting changes and user toggle in Settings.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => checkIsReducedMotion());

  useEffect(() => {
    const update = () => {
      setReduced(checkIsReducedMotion());
    };

    update();

    // Listen to media query changes
    let mql: MediaQueryList | null = null;
    if (typeof window.matchMedia === "function") {
      mql = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (mql && typeof mql.addEventListener === "function") {
        mql.addEventListener("change", update);
      } else if (mql && typeof mql.addListener === "function") {
        mql.addListener(update);
      }
    }

    // Listen to in-app preference changes
    window.addEventListener(MOTION_CHANGE_EVENT, update);
    window.addEventListener("storage", update);

    // Observe documentElement attribute changes
    let observer: MutationObserver | null = null;
    if (typeof MutationObserver !== "undefined" && document.documentElement) {
      observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === "attributes" && m.attributeName === "data-motion") {
            update();
            break;
          }
        }
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-motion"],
      });
    }

    return () => {
      if (mql) {
        if (typeof mql.removeEventListener === "function") {
          mql.removeEventListener("change", update);
        } else if (typeof mql.removeListener === "function") {
          mql.removeListener(update);
        }
      }
      window.removeEventListener(MOTION_CHANGE_EVENT, update);
      window.removeEventListener("storage", update);
      observer?.disconnect();
    };
  }, []);

  return reduced;
}
