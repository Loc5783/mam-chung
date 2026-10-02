import { create } from "zustand";
type UiState = {
  toast: string | null;
  notify: (message: string) => void;
  dismiss: () => void;
};
export const useUiStore = create<UiState>((set) => ({
  toast: null,
  notify: (toast) => set({ toast }),
  dismiss: () => set({ toast: null }),
}));
