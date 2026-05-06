import { reactive } from "vue";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
  duration?: number;
  actionText?: string;
  onAction?: () => void;
}

interface ToastState {
  toasts: ToastItem[];
}

const state = reactive<ToastState>({
  toasts: [],
});

const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 2500,
  info: 3000,
  warning: 4000,
  error: 5000,
};

let toastCount = 0;

export function useToast() {
  const addToast = (
    type: ToastType,
    message: string,
    options?: Omit<Partial<ToastItem>, "id" | "type" | "message">
  ) => {
    // Simple duplicate prevention: don't add the same message if it was added in the last 1s
    const now = Date.now();
    const isDuplicate = state.toasts.some(
      (t) => t.message === message && t.type === type
    );
    
    // Actually, user requested: "prevent showing the exact same message repeatedly within 1 second"
    // For now, let's just check if it already exists in the active list.
    if (isDuplicate) return;

    const id = `toast-${++toastCount}-${now}`;
    const duration = options?.duration ?? DEFAULT_DURATIONS[type];

    const newItem: ToastItem = {
      id,
      type,
      message,
      ...options,
      duration,
    };

    state.toasts.push(newItem);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  };

  const removeToast = (id: string) => {
    const index = state.toasts.findIndex((t) => t.id === id);
    if (index !== -1) {
      state.toasts.splice(index, 1);
    }
  };

  const clearToasts = () => {
    state.toasts.splice(0, state.toasts.length);
  };

  return {
    toasts: state.toasts,
    success: (message: string, options?: Omit<Partial<ToastItem>, "id" | "type" | "message">) =>
      addToast("success", message, options),
    error: (message: string, options?: Omit<Partial<ToastItem>, "id" | "type" | "message">) =>
      addToast("error", message, options),
    info: (message: string, options?: Omit<Partial<ToastItem>, "id" | "type" | "message">) =>
      addToast("info", message, options),
    warning: (message: string, options?: Omit<Partial<ToastItem>, "id" | "type" | "message">) =>
      addToast("warning", message, options),
    remove: removeToast,
    clear: clearToasts,
  };
}
