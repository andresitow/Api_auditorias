"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type ToastVariant = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  show: (message: string, variant?: ToastVariant) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLES: Record<ToastVariant, { border: string; icon: string; iconColor: string }> = {
  success: { border: "border-l-green", icon: "✓", iconColor: "text-green" },
  error: { border: "border-l-red", icon: "✕", iconColor: "text-red" },
  warning: { border: "border-l-orange", icon: "!", iconColor: "text-orange" },
  info: { border: "border-l-blue", icon: "i", iconColor: "text-blue" },
};

const AUTO_DISMISS_MS = 5000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  const value: ToastContextValue = {
    show,
    success: (message) => show(message, "success"),
    error: (message) => show(message, "error"),
    warning: (message) => show(message, "warning"),
    info: (message) => show(message, "info"),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[200] flex w-full max-w-[360px] flex-col gap-2 pointer-events-none">
        {toasts.map((t) => {
          const s = VARIANT_STYLES[t.variant];
          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto animate-shell-rise flex items-start gap-2.5 rounded-xl border border-l-[3px] border-border ${s.border} bg-bg2 px-3.5 py-3 shadow-lg`}
            >
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-bg3 text-[11px] font-semibold ${s.iconColor}`}>
                {s.icon}
              </span>
              <span className="flex-1 pt-0.5 text-[13px] leading-snug text-text">{t.message}</span>
              <Button
                type="button"
                variant="ghost"
                size="iconSm"
                onClick={() => dismiss(t.id)}
                aria-label="Cerrar aviso"
                className="mt-0.5 shrink-0"
              >
                ✕
              </Button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de un ToastProvider");
  return ctx;
}
