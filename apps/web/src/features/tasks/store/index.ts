import { create } from "zustand";
export const useTaskUiStore = create<{
  selectedId: string | null;
  select: (id: string | null) => void;
}>((set) => ({
  selectedId: null,
  select: (selectedId) => set({ selectedId }),
}));
