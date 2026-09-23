"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export type Formato = "excel" | "pdf";

const ITEM_LABEL: Record<Formato, string> = {
  excel: "Descargar en Excel (.xlsx)",
  pdf: "Descargar en PDF (.pdf)",
};

/** Botón con menú desplegable para elegir el formato de descarga (Excel o PDF).
 * Se cierra al hacer clic fuera o con Esc. */
export function FormatDropdown({
  children,
  onSelect,
  disabled,
  itemLabels,
}: {
  children: ReactNode;
  onSelect: (formato: Formato) => void;
  disabled?: boolean;
  itemLabels?: Partial<Record<Formato, string>>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <Button variant="outline" onClick={() => setOpen((v) => !v)} disabled={disabled} aria-haspopup="menu" aria-expanded={open}>
        {children} <span aria-hidden="true">{open ? "▴" : "▾"}</span>
      </Button>
      {open && (
        <div role="menu" className="frutiger-menu absolute right-0 top-full z-40 mt-2 min-w-full overflow-hidden">
          {(["excel", "pdf"] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSelect(f);
              }}
              className="flex w-full cursor-pointer items-center gap-2 whitespace-nowrap px-4 py-2.5 text-left text-[13px]"
            >
              {itemLabels?.[f] ?? ITEM_LABEL[f]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
