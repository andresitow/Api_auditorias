"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function getSnapshot(): Theme {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

function getServerSnapshot(): Theme {
  return "dark";
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isLight = theme === "light";

  const toggle = () => {
    const next: Theme = isLight ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      // ignore storage errors (private browsing, disabled storage)
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isLight}
      aria-label={isLight ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
      onClick={toggle}
      className="relative inline-flex h-[26px] w-[46px] shrink-0 items-center rounded-full border border-border bg-bg3 px-[3px] transition-colors"
    >
      <span
        className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-nav-bg text-[10px] text-nav-ink transition-transform duration-200"
        style={{ transform: isLight ? "translateX(20px)" : "translateX(0)" }}
      >
        {isLight ? "☀" : "☾"}
      </span>
    </button>
  );
}
