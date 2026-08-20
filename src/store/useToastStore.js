import { create } from 'zustand';

let toastId = 0;

export const useToastStore = create((set, get) => ({
  toasts: [],

  push: ({ type = 'info', title, description }) => {
    const id = ++toastId;
    set((state) => ({ toasts: [...state.toasts, { id, type, title, description }] }));
    setTimeout(() => get().dismiss(id), 4500);
    return id;
  },

  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (title, description) => useToastStore.getState().push({ type: 'success', title, description }),
  error: (title, description) => useToastStore.getState().push({ type: 'error', title, description }),
  info: (title, description) => useToastStore.getState().push({ type: 'info', title, description }),
  achievement: (title, description) => useToastStore.getState().push({ type: 'achievement', title, description }),
};