import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidthClass?: string;
}

export function Modal({
  open,
  title,
  onClose,
  children,
  maxWidthClass = "max-w-lg",
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`w-full ${maxWidthClass} bg-white nb-border nb-shadow-lg overflow-hidden`}
      >
        <div
          style={{
            backgroundColor: "var(--color-primary)",
            color: "var(--color-primary-ink)",
          }}
          className="flex items-center justify-between px-5 py-3.5 border-b-[2.5px] border-[#111111]"
        >
          <h3 className="text-sm font-black uppercase tracking-wider">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1 border-2 border-[#111111] bg-white text-[#111111] hover:bg-[#111111] hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
